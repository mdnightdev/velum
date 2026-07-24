# VELUM CURRENCY & INVENTORY LAYER (v1.0)

Extends `VELUM_ESCROW_WALLET_LAYER.md`. Two additions: wallets become multi-currency
(including a native platform currency), and the inventory lifecycle gets an actual
verification pipeline instead of "seller uploads, it's live."

**One framing note, not a lecture:** VLM below is a *closed-loop* currency — it's never
redeemable for real cash, only earned/purchased and spent inside Velum. That framing
matters even in sandbox mode, because a currency you *can* cash out starts looking like
real money (and real regulation) fast, while a closed-loop points system is a much
lighter lift. Keep it closed-loop unless you deliberately decide otherwise later.

---

## 1. Multi-Currency Wallets

The old single `balance_cents` column becomes a balance *per currency*.

```sql
CREATE TABLE IF NOT EXISTS currencies (
    currency_code    VARCHAR(8) PRIMARY KEY,          -- 'VLM', 'USD_SIM', 'EUR_SIM'
    display_name     VARCHAR(64) NOT NULL,
    is_platform_native BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE only for VLM
    redeemable_for_cash BOOLEAN NOT NULL DEFAULT FALSE, -- keep FALSE for VLM, always
    decimal_places   INTEGER NOT NULL DEFAULT 2,
    active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS wallet_balances (
    user_id       INTEGER NOT NULL,
    currency_code VARCHAR(8) NOT NULL,
    balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, currency_code),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (currency_code) REFERENCES currencies(currency_code)
);
```

`wallet_ledger_entries` (from the escrow/wallet doc) gains a `currency_code` column and
one new `entry_type`: `'CURRENCY_EXCHANGE'`. Everything else about that ledger — signed
amounts, append-only, balance snapshot per row — is unchanged; it just now needs to be
read per-currency rather than assuming one global balance.

---

## 2. Simulated Exchange Rates & Currency Exchange

Rates are static/sandbox-controlled, not a live feed — flagged explicitly so nobody
mistakes this for real FX data later.

```sql
CREATE TABLE IF NOT EXISTS exchange_rates (
    rate_id          VARCHAR(64) PRIMARY KEY,
    base_currency     VARCHAR(8) NOT NULL,
    quote_currency    VARCHAR(8) NOT NULL,
    rate              DECIMAL(18,8) NOT NULL CHECK (rate > 0), -- 1 base_currency = `rate` quote_currency
    simulated_source  VARCHAR(64) NOT NULL DEFAULT 'SANDBOX_STATIC',
    effective_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (base_currency) REFERENCES currencies(currency_code),
    FOREIGN KEY (quote_currency) REFERENCES currencies(currency_code)
);

CREATE INDEX IF NOT EXISTS idx_rates_lookup ON exchange_rates (base_currency, quote_currency, effective_at DESC);
```

```typescript
export interface ExchangeResult {
  from_debited_cents: number;
  to_credited_cents: number;
  rate_used: number;
  platform_spread_cents: number; // the exchange "fee" — platform take on the conversion
  error?: string;
}

export function exchangeCurrency(
  fromBalanceCents: number,
  amountCents: number,
  rate: number,        // 1 unit `from` = `rate` units `to`
  spreadPct: number     // e.g. 0.015 = 1.5% platform take on every exchange
): ExchangeResult {
  if (amountCents > fromBalanceCents) {
    return { from_debited_cents: 0, to_credited_cents: 0, rate_used: rate, platform_spread_cents: 0, error: 'Insufficient balance.' };
  }
  const grossConverted = Math.floor(amountCents * rate);
  const spread = Math.floor(grossConverted * spreadPct);
  return {
    from_debited_cents: amountCents,
    to_credited_cents: grossConverted - spread,
    rate_used: rate,
    platform_spread_cents: spread,
  };
}
```

Every exchange writes **two** ledger rows in the same transaction: a negative entry in
the source currency, a positive entry in the destination currency, both tagged
`entry_type = 'CURRENCY_EXCHANGE'` and linked by a shared `related_transaction_id` so
they're reconcilable as one event, not two unrelated ones.

---

## 3. Wallet Security — what actually needs protecting

The balance numbers themselves don't need field-level encryption — you need to query
and sum them, so encrypting the number itself just adds overhead for no real gain. What
*does* need protecting:

1. **Anything that identifies a real-world payout destination** (a bank account number,
   a card token) once real money ever enters the picture. Store only a processor's
   opaque token, never raw account details — this is the same "tokenize, don't store"
   pattern used everywhere in payments, and it means Velum's database never holds
   something worth stealing.
2. **Session/auth security around wallet actions**, not the wallet data at rest. A
   ledger row saying "user 4821 has 3,200 VLM" isn't sensitive on its own; what's
   sensitive is making sure only user 4821 (or an authorized admin) can trigger a spend
   or withdrawal against it. That's the server-side ownership check from the escrow doc,
   applied here too.
3. **If/when a real payout destination field is added** to `withdrawal_requests`,
   encrypt it with envelope encryption: a per-record data key encrypts the field, and
   that data key is itself encrypted by a key-encryption-key held in a KMS/HSM — the
   database never holds a key capable of decrypting payout details on its own, and the
   KEK is rotated on a schedule without needing to re-encrypt every historical record.

```sql
-- Only relevant once real payouts exist — sandbox mode has no real destination to protect yet.
ALTER TABLE withdrawal_requests ADD COLUMN payout_destination_encrypted TEXT;
-- ^ ciphertext only. Decryption happens exclusively inside the payout service, never in
--   the admin UI layer, and access to the decrypting key is scoped to that one service.
```

---

## 4. Inventory Lifecycle: Add, Delete, Verify

**Add.** A new listing starts in a review-pending state — it's not searchable or
purchasable until it clears verification, so "premium" holds up: nothing goes live
unvetted.

```sql
ALTER TABLE market_assets ADD COLUMN verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (verification_status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED'));
-- Note: this is separate from `status` (ACTIVE/DISPUTED/etc.) on purpose — verification
-- is a moderation verdict, status is an operational state. A listing can be APPROVED but
-- still transition through ACTIVE → PENDING_ESCROW → COMPLETED independently.
```

```sql
CREATE TABLE IF NOT EXISTS listing_verification_checks (
    check_id       VARCHAR(64) PRIMARY KEY,
    listing_id     VARCHAR(64) NOT NULL,
    check_type     VARCHAR(32) NOT NULL CHECK (check_type IN (
                       'AUTOMATED_CONTENT_SCAN', 'DUPLICATE_DETECTION', 'MANUAL_REVIEW'
                   )),
    result         VARCHAR(16) NOT NULL CHECK (result IN ('PASS', 'FLAG', 'FAIL')),
    notes          TEXT,
    reviewed_by_admin_id VARCHAR(64),
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (listing_id) REFERENCES market_assets(listing_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by_admin_id) REFERENCES platform_admins(admin_id) ON DELETE SET NULL
);
```

Pipeline order: `AUTOMATED_CONTENT_SCAN` (prohibited content, banned keywords) →
`DUPLICATE_DETECTION` (image hash / text-similarity match against existing listings, to
catch stolen or copy-pasted listings) → `MANUAL_REVIEW`, required only if either
automated check returns `FLAG`, or the seller isn't yet `verified_seller` — an
established, clean-track-record seller can skip manual review on routine listings once
they've earned it.

**Delete.** Never a hard delete if the listing has any associated
`escrow_transactions` — dispute history, reviews, and audit trails all reference it.

```sql
ALTER TABLE market_assets ADD COLUMN deleted_at TIMESTAMP;
-- Soft-delete: status → 'DELISTED', deleted_at set. Hard DELETE is only permitted when
-- zero rows exist in escrow_transactions for that listing_id — enforce this in the
-- service layer as a precondition check, not just a suggestion.
```

**Stock management.** Decrement `inventory_count` at the moment escrow is placed
(`HELD_IN_ESCROW`), not at final release — otherwise two buyers can both "buy" the last
unit before either purchase resolves. If the transaction later reverts (sandbox
verification fails, or a refund is approved pre-release), restock in that same
reversal transaction.

---

## 5. What a real marketplace has that isn't designed yet

Flagging these rather than building all of them now — pick what's next when you're
ready, don't let the list become scope creep tonight:

- **Search & discovery** — full-text + filtered search over `market_assets`. Right now
  the schema supports lookups by status/price, not free-text search.
- **Anti-fraud beyond one-review-per-order** — fake-review rings that space purchases
  out over time aren't caught by the `UNIQUE(order_id)` constraint alone; that's a
  pattern-detection problem, not a schema one.
- **Rate limiting** on listing creation and discussion posts — nothing today stops a
  single seller from posting hundreds of listings or a user from spamming discussions.
- **Notifications** — order status changes, dispute updates, price drops on saved
  items. No table for this yet.
- **Wishlist / saved listings** — simple table, genuinely just missing.
- **Price history** — buyers currently can't see if a "sale" price was inflated first
  then discounted. A `market_asset_price_history` append-only table would close this.
- **Reported-content flow distinct from disputes** — a way for any user to flag a
  listing or review as fraudulent/abusive, independent of being a buyer in a dispute.
- **Seller reputation decay** — should a review from three years ago count as much as
  one from last week? Not addressed yet.
- **Tax handling per jurisdiction** — `net_tax_amount_cents` exists as a field, but
  there's no table mapping buyer region to tax rate; right now `taxRate` is just a
  parameter someone has to supply correctly by hand.

Happy to build any of these out next — just say which one, since a few of them
(anti-fraud, rate limiting) are meaningfully bigger design problems than the others.
