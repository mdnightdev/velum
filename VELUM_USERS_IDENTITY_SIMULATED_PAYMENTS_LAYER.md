# VELUM USERS, IDENTITY & SIMULATED PAYMENTS LAYER (v1.0)

Extends `VELUM_MARKETPLACE_CANONICAL.md`, `VELUM_ESCROW_WALLET_LAYER.md`, and
`VELUM_CURRENCY_INVENTORY_LAYER.md`. Those three documents all foreign-key into
`users(user_id)` without it ever being defined — this closes that gap, adds KYC as a
real precondition (not just a note) for withdrawals, and builds `payment_methods` plus
a **simulated external bank/card network** so recharge and withdrawal have something
realistic to originate from and land on, instead of being a button with no source.

**One convention note up front:** the canonical doc's ID rule (Section 1, item 5) says
every ID is `VARCHAR(64)`. But every existing FK — `market_assets.seller_id`,
`escrow_transactions.buyer_id`, `user_wallets.user_id` — is typed `INTEGER`. Rather than
retype every FK across three shipped documents, `users.user_id` is defined as `INTEGER`
here to match what's already load-bearing everywhere else. Worth knowing this is a
deliberate exception, not an oversight repeated a fourth time.

---

## 0. Patch: the cascade bug, fixed here

Before adding anything new, the fix you flagged. Every financial table's `user_id` FK
changes from `ON DELETE CASCADE` to `ON DELETE RESTRICT`. This is a diff to apply against
the two existing docs, not a re-listing of them:

```sql
-- In VELUM_ESCROW_WALLET_LAYER.md and VELUM_CURRENCY_INVENTORY_LAYER.md:
-- user_wallets.user_id, wallet_ledger_entries.user_id, wallet_balances.user_id,
-- recharge_requests.user_id, withdrawal_requests.user_id, refund_requests.requested_by_user_id
-- all change from:
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
-- to:
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
```

`escrow_transactions.buyer_id`/`seller_id` in the canonical doc get the same change.
`market_assets.seller_id` stays `RESTRICT` too, for the same reason — a listing with
transaction history under it can't just vanish.

This means account "deletion" is never a hard `DELETE FROM users`. It's the soft-delete
below (Section 1) — `account_status = 'DELETED'`, financial history stays intact and
queryable, and nothing referencing it breaks.

---

## 1. `users` — the table everything else assumed existed

```sql
CREATE TABLE IF NOT EXISTS users (
    user_id           INTEGER PRIMARY KEY,
    email             VARCHAR(255) NOT NULL UNIQUE,
    email_verified_at TIMESTAMP, -- NULL = unverified. Gates nothing on its own; KYC does that.
    password_hash     VARCHAR(255) NOT NULL, -- never store raw; bcrypt/argon2 output only
    display_name      VARCHAR(64) NOT NULL,
    account_status    VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
                      CHECK (account_status IN (
                          'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED'
                      )),
    suspension_reason TEXT, -- required in app logic whenever status moves to SUSPENDED/BANNED
    deleted_at        TIMESTAMP, -- soft-delete marker. Row stays forever; this is the only "deletion".
    last_login_at     TIMESTAMP,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_status ON users (account_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE deleted_at IS NULL;
```

**Rules that follow from this shape, worth stating explicitly:**
- A `BANNED` or `SUSPENDED` user keeps all rows everywhere (wallet, listings, orders) —
  those states restrict *actions*, not *existence*. Enforce in the service layer: every
  auth middleware checks `account_status = 'ACTIVE'` before allowing a mutating request,
  independent of whatever the specific endpoint does.
- `DELETED` is soft. `deleted_at` is set, `email` is *not* released for reuse (the
  partial unique index above only enforces uniqueness among non-deleted rows, so a new
  user *can* reuse a deleted account's email — decide if that's actually what you want;
  if not, append a suffix to the deleted row's email instead of relying on the partial
  index).
- Nothing about this table lets you skip real auth session design later (password reset
  flows, session tokens, MFA) — this is the minimum shape the rest of the system needs
  to compile, not a complete identity system.

---

## 2. KYC — a real gate, not a status field nobody checks

```sql
CREATE TABLE IF NOT EXISTS kyc_verifications (
    kyc_id              VARCHAR(64) PRIMARY KEY,
    user_id             INTEGER NOT NULL UNIQUE, -- one active KYC record per user
    status              VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED'
                        CHECK (status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')),
    verification_level  VARCHAR(16) NOT NULL DEFAULT 'NONE'
                        CHECK (verification_level IN ('NONE', 'BASIC', 'FULL')),
    -- BASIC: email + name match, sandbox-simulated. FULL: simulated document check.
    -- Withdrawal limits (Section 5) key off this, not off `status` alone.
    submitted_name      VARCHAR(128),
    submitted_document_type VARCHAR(32) CHECK (submitted_document_type IN (
                        'PASSPORT_SIM', 'DRIVERS_LICENSE_SIM', 'NATIONAL_ID_SIM'
                        ) OR submitted_document_type IS NULL),
    simulated_document_ref  VARCHAR(64), -- opaque ref to a mock doc store, never a real document
    reviewed_by_admin_id VARCHAR(64),
    reviewed_at          TIMESTAMP,
    rejection_reason     TEXT,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewed_by_admin_id) REFERENCES platform_admins(admin_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_kyc_pending ON kyc_verifications (status, created_at);
```

**The gate itself — this is the part that was missing entirely, not just unenforced:**

```sql
-- withdrawal_requests (VELUM_ESCROW_WALLET_LAYER.md) gains a hard precondition:
ALTER TABLE withdrawal_requests ADD COLUMN kyc_verification_id VARCHAR(64) NOT NULL;
ALTER TABLE withdrawal_requests ADD FOREIGN KEY (kyc_verification_id)
    REFERENCES kyc_verifications(kyc_id) ON DELETE RESTRICT;
```

Application-layer rule to pair with the FK (a CHECK constraint can't reach into another
table): **no `withdrawal_requests` row may be inserted unless
`kyc_verifications.status = 'VERIFIED'` for that `user_id` at insert time.** The FK
guarantees a KYC row exists and is linked; it doesn't guarantee it *passed* — that check
belongs in the service function that creates the withdrawal, checked fresh every time,
not cached from an earlier session.

---

## 3. `payment_methods` — what a recharge actually draws from

```sql
CREATE TABLE IF NOT EXISTS payment_methods (
    payment_method_id  VARCHAR(64) PRIMARY KEY,
    user_id            INTEGER NOT NULL,
    method_type        VARCHAR(16) NOT NULL CHECK (method_type IN ('CARD', 'BANK_ACCOUNT')),
    -- Tokenized reference into the simulator below (Section 4) — never raw numbers here,
    -- same "tokenize, don't store" pattern the currency doc already calls out for the
    -- real-money future. In sandbox mode this points at a mock record, but the *shape*
    -- of "app never sees the real PAN/account number" is worth keeping from day one.
    external_account_token VARCHAR(64) NOT NULL,
    display_label      VARCHAR(64) NOT NULL, -- e.g. "Visa •••• 4242", "Chase Checking •••• 8831"
    is_default         BOOLEAN NOT NULL DEFAULT FALSE,
    status             VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
                       CHECK (status IN ('ACTIVE', 'EXPIRED', 'REMOVED')),
    added_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    removed_at         TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (external_account_token) REFERENCES external_financial_accounts(account_token) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_one_default
    ON payment_methods (user_id) WHERE is_default = TRUE AND status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods (user_id, status);
```

`payment_methods` is Velum's internal record of "the user has this saved." It never
holds the real number — that lives only in the simulator (Section 4), the same way a
real integration would only ever hold a Stripe/Plaid token, not a PAN.

---

## 4. Simulated External Bank & Card Network

This is the "outside" world — a mock version of what Stripe/a card network/a bank's
ACH rail would be. It has its own balances, its own decline logic, and its own event
log, deliberately separate from Velum's `wallet_ledger_entries` — because in a real
integration these two ledgers *are* separate systems reconciled after the fact, not one
table. Building it this way now means the eventual swap to a real processor replaces
this file's functions, not the wallet's.

```sql
-- The mock "outside" account a card or bank represents. Not owned by Velum's users
-- table conceptually — this stands in for a bank's or card network's own record.
CREATE TABLE IF NOT EXISTS external_financial_accounts (
    account_token       VARCHAR(64) PRIMARY KEY, -- opaque, this IS the token payment_methods stores
    account_kind        VARCHAR(16) NOT NULL CHECK (account_kind IN ('CARD', 'BANK_ACCOUNT')),
    simulated_institution VARCHAR(64) NOT NULL, -- e.g. 'SANDBOX_VISA', 'SANDBOX_FIRST_NATIONAL'
    masked_number        VARCHAR(32) NOT NULL, -- e.g. '•••• 4242' — display only, never the real PAN
    simulated_available_cents INTEGER NOT NULL DEFAULT 500000 CHECK (simulated_available_cents >= 0),
    -- a mock "available balance/credit" the sandbox charges against, so insufficient-funds
    -- declines are a real code path, not something that only happens in a real integration
    expires_at_sim       TIMESTAMP, -- for CARD accounts; simulated expiry, triggers DECLINED_EXPIRED
    is_active            BOOLEAN NOT NULL DEFAULT TRUE, -- flip false to simulate a closed/frozen account
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Every call "out" to this fake network is logged, mirroring a real processor's event
-- log/webhook history. This is what recharge_requests/withdrawal_requests reconcile
-- against — same relationship a real Stripe payment_intent or ACH transfer record has
-- to your own order table.
CREATE TABLE IF NOT EXISTS external_processor_events (
    event_id            VARCHAR(64) PRIMARY KEY,
    account_token       VARCHAR(64) NOT NULL,
    direction            VARCHAR(16) NOT NULL CHECK (direction IN ('CHARGE', 'PAYOUT')),
    -- CHARGE = pulling money in (recharge). PAYOUT = pushing money out (withdrawal).
    amount_cents         INTEGER NOT NULL CHECK (amount_cents > 0),
    result               VARCHAR(24) NOT NULL CHECK (result IN (
                            'APPROVED', 'DECLINED_INSUFFICIENT_FUNDS', 'DECLINED_EXPIRED',
                            'DECLINED_ACCOUNT_FROZEN', 'DECLINED_GENERIC', 'PENDING_SIMULATED_DELAY'
                        )),
    simulated_latency_ms INTEGER NOT NULL DEFAULT 0, -- fake network delay, for realistic UX testing
    related_request_id   VARCHAR(64), -- FK to recharge_requests.request_id or withdrawal_requests.request_id
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_token) REFERENCES external_financial_accounts(account_token) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_processor_events_account ON external_processor_events (account_token, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processor_events_request  ON external_processor_events (related_request_id);
```

**Wiring into the existing recharge/withdrawal tables:**

```sql
ALTER TABLE recharge_requests ADD COLUMN payment_method_id VARCHAR(64) NOT NULL;
ALTER TABLE recharge_requests ADD FOREIGN KEY (payment_method_id)
    REFERENCES payment_methods(payment_method_id) ON DELETE RESTRICT;

ALTER TABLE withdrawal_requests ADD COLUMN payout_method_id VARCHAR(64) NOT NULL;
ALTER TABLE withdrawal_requests ADD FOREIGN KEY (payout_method_id)
    REFERENCES payment_methods(payment_method_id) ON DELETE RESTRICT;
```

**Simulator logic — deterministic-but-realistic, no real network call:**

```typescript
export type ProcessorResult =
  | 'APPROVED'
  | 'DECLINED_INSUFFICIENT_FUNDS'
  | 'DECLINED_EXPIRED'
  | 'DECLINED_ACCOUNT_FROZEN'
  | 'DECLINED_GENERIC';

export interface ExternalAccountSim {
  account_token: string;
  simulated_available_cents: number;
  expires_at_sim: number | null; // epoch ms
  is_active: boolean;
}

export interface ProcessorCallResult {
  result: ProcessorResult | 'PENDING_SIMULATED_DELAY';
  simulated_latency_ms: number;
  new_available_cents?: number; // only present on APPROVED
}

// Deterministic checks first (mirrors what a real processor actually validates),
// then a small random-decline chance so integration testing sees failure paths
// without needing to hand-craft every account state.
export function simulateProcessorCharge(
  account: ExternalAccountSim,
  amountCents: number,
  nowMs: number = Date.now(),
  randomDeclineRate: number = 0.02 // 2% generic decline, tune per environment
): ProcessorCallResult {
  const latency = 300 + Math.floor(Math.random() * 900); // 300–1200ms, feels real in a UI

  if (!account.is_active) {
    return { result: 'DECLINED_ACCOUNT_FROZEN', simulated_latency_ms: latency };
  }
  if (account.expires_at_sim && nowMs > account.expires_at_sim) {
    return { result: 'DECLINED_EXPIRED', simulated_latency_ms: latency };
  }
  if (amountCents > account.simulated_available_cents) {
    return { result: 'DECLINED_INSUFFICIENT_FUNDS', simulated_latency_ms: latency };
  }
  if (Math.random() < randomDeclineRate) {
    return { result: 'DECLINED_GENERIC', simulated_latency_ms: latency };
  }

  return {
    result: 'APPROVED',
    simulated_latency_ms: latency,
    new_available_cents: account.simulated_available_cents - amountCents,
  };
}

// Payouts (withdrawals) are simulated as always eventually succeeding once approved by
// admin review — the "bank" doesn't reject a payout to a valid, active account the way
// a charge can be declined. Frozen/closed destination accounts are the one real failure mode.
export function simulateProcessorPayout(
  account: ExternalAccountSim,
  amountCents: number
): ProcessorCallResult {
  const latency = 500 + Math.floor(Math.random() * 1500);
  if (!account.is_active) {
    return { result: 'DECLINED_ACCOUNT_FROZEN', simulated_latency_ms: latency };
  }
  return {
    result: 'APPROVED',
    simulated_latency_ms: latency,
    new_available_cents: account.simulated_available_cents + amountCents,
  };
}
```

**Flow this produces, end to end (recharge example):**

```
[ User picks a saved payment_method, or adds one → creates external_financial_accounts row ]
        │
        ▼
[ recharge_requests row created, status = PENDING, linked to payment_method_id ]
        │
        ▼
[ simulateProcessorCharge() runs against that account's simulated balance ]
        │
        ├── APPROVED ──────────────► external_processor_events row (APPROVED)
        │                                  │
        │                                  ▼
        │                         recharge_requests.status = SIMULATED_COMPLETE
        │                                  │
        │                                  ▼
        │                         wallet_ledger_entries INSERT (entry_type=RECHARGE, positive)
        │                         + user_wallets.balance_cents updated, same transaction
        │
        └── DECLINED_* ────────────► external_processor_events row (decline reason)
                                           │
                                           ▼
                                  recharge_requests.status = FAILED
                                  (no ledger entry written — nothing to reverse because
                                   nothing was ever credited)
```

Withdrawal follows the same shape but gated by the KYC check (Section 2) before a
`withdrawal_requests` row can even be created, and by `platform_admins` review (existing
doc) before `simulateProcessorPayout` is ever called.

---

## 5. Withdrawal limits keyed to KYC level

Not full velocity-limiting (that's still flagged as unbuilt below), but the minimum
tie-in so KYC actually does something beyond gating on/off:

```typescript
export function maxWithdrawalCentsFor(verificationLevel: 'NONE' | 'BASIC' | 'FULL'): number {
  switch (verificationLevel) {
    case 'NONE': return 0;          // can't withdraw at all — matches the hard FK gate above
    case 'BASIC': return 50_000;    // $500 sandbox cap
    case 'FULL': return 10_000_000; // $100,000 sandbox cap
  }
}
```

Checked in the same service function that enforces the KYC gate — one place, not two
places that can drift out of sync.

### 5.1 Dynamic Limit Increases (Trust Score & Ledger Audits)
Users are not permanently locked to their default tier caps. Standard users can request a limit increase directly through their billing panel. 

Approval is governed by an automated compliance engine which calculates a **Trust Score** from active historical ledger telemetry:
1. **Dispute Rate**: Percentage of orders resulting in open disputes (must be < 2.0% over the last 30 days).
2. **Review Integrity**: Average customer star rating (must be >= 4.5) and total completed transactions (must be >= 20 independent settlements).
3. **Ledger Volume**: The total rolling transaction value settled via the escrow ledger (supports tier multiplier increments once aggregate volume exceeds 5,000.00 GBP).
4. **General Reserve Safety**: Admin approval is flagged for any request exceeding 25,000.00 GBP to safeguard Velum's core institutional starting reserves (opening balance of £150M VLM).

### 5.2 Anti-Hallucination Disconnection Guardrails (VLM Fees vs. Physical Payouts)
To prevent the application database from hallucinating real fiat clearance status, the database maintains a strict, absolute architectural separation of concerns:
- **Internal Ledger Only**: internal tables (`user_wallets`, `wallet_balances`, `wallet_ledger_entries`) record only platform-native VLM virtual currency balances, exchange spread fees collected by Velum, and ledger adjustments.
- **Physical External Routing Disconnect**: Velum does *not* track or process external ACH clearing loops, central bank settlement files, or commercial physical bank cash positions.
- All real-world currency conversions and off-chain physical cash-outs occur at external banking endpoints represented solely inside Velum by tokenized receipts (`external_processor_events`) and non-sensitive reference tokens (`external_account_token`).
- Velum only collects VLM-denominated exchange spreads and escrow fees directly to our system wallets; we never hold raw credit card numbers or process live external card payments directly.

---

## 6. Still not designed (unchanged from the currency doc's honesty about scope)

Carried forward, plus what this doc surfaces:

- **Spending/withdrawal velocity limits** — flag unusually rapid activity across
  multiple requests, not just cap a single one. Needs a rolling-window query, not a
  static column.
- **Step-up re-auth before high-value actions** — a withdrawal shouldn't succeed on a
  session that's just old, even if technically still valid. Needs a "re-enter
  password/MFA, timestamped" check the withdrawal endpoint requires fresh.
- **Real auth** — this doc defines `users.password_hash` as a column, not a login flow,
  session tokens, password reset, or MFA. Those are a real subsystem of their own.
- **Card/bank verification realism beyond decline codes** — real processors also do
  Luhn-check validation, BIN lookups, AVS/CVV matching. Not simulated here; the mock
  only distinguishes approve/decline outcomes, not why a real card would fail Luhn.
- **Data retention policy once `account_status = 'DELETED'`** — how long does a deleted
  user's financial history stay queryable by them vs. only by admins/compliance? Not
  decided yet.

Want me to wire this into actual endpoint code next (the recharge/withdrawal service
functions calling into `simulateProcessorCharge`/`Payout`), or keep going at the schema
level first?
