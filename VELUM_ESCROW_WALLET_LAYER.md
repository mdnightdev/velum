# VELUM ESCROW & WALLET LAYER (v1.0)

Extends `VELUM_MARKETPLACE_CANONICAL.md`. That document handles a single transaction's
pricing and release. This document handles the money sitting around it: where user
balances live, how they go up and down, who at Velum is allowed to touch that, and what
happens when nobody's around to make a call.

**Framing:** everything below is built as a real double-entry ledger from day one, even
while recharge/withdrawal are simulated. That's deliberate — if this ever moves to real
money later, you're swapping out the recharge/withdrawal *source* (a payment processor
call instead of a simulated instant credit), not rebuilding the ledger. One line to keep
in mind for that future day: once real money is involved, Velum acting as direct
custodian of user balances is the kind of thing that usually needs a money transmitter
license or a licensed processor sitting underneath you — not a blocker today, just don't
let "it's simulated" quietly become "it's live" without that conversation happening.

---

## 1. Wallet & Ledger Schema

```sql
-- One row per user, cached balance for fast reads. The ledger below is the source of truth;
-- this table is a derived total that must always equal SUM(wallet_ledger_entries.amount_cents)
-- for that user — reconcile it, don't just trust it.
CREATE TABLE IF NOT EXISTS user_wallets (
    user_id         INTEGER PRIMARY KEY,
    balance_cents   INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Append-only. Never UPDATE or DELETE a row here — corrections are new rows, always.
CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
    entry_id            VARCHAR(64) PRIMARY KEY,
    user_id             INTEGER NOT NULL,
    entry_type          VARCHAR(32) NOT NULL CHECK (entry_type IN (
                            'RECHARGE', 'WITHDRAWAL', 'ESCROW_HOLD', 'ESCROW_RELEASE',
                            'ESCROW_REFUND', 'PLATFORM_FEE', 'AUTOMATED_ADJUSTMENT'
                        )),
    amount_cents        INTEGER NOT NULL, -- signed: positive = credit, negative = debit
    balance_after_cents INTEGER NOT NULL CHECK (balance_after_cents >= 0), -- snapshot at write time
    related_transaction_id VARCHAR(64), -- FK to escrow_transactions when applicable
    actor_type          VARCHAR(16) NOT NULL CHECK (actor_type IN ('USER', 'ADMIN', 'SYSTEM_AUTOMATION')),
    actor_id            VARCHAR(64), -- user_id, admin_id, or automation job name
    is_simulated        BOOLEAN NOT NULL DEFAULT TRUE, -- flip to FALSE only once real money is wired in
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (related_transaction_id) REFERENCES escrow_transactions(transaction_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_user_time ON wallet_ledger_entries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_txn        ON wallet_ledger_entries (related_transaction_id);


-- Simulated deposit. In sandbox mode this completes instantly; the table exists so the
-- eventual real flow (processor webhook confirms funds before crediting) drops in cleanly.
CREATE TABLE IF NOT EXISTS recharge_requests (
    request_id      VARCHAR(64) PRIMARY KEY,
    user_id         INTEGER NOT NULL,
    amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
    status          VARCHAR(32) NOT NULL DEFAULT 'SIMULATED_COMPLETE'
                    CHECK (status IN ('SIMULATED_COMPLETE', 'PENDING', 'FAILED')),
    simulated_method VARCHAR(64) DEFAULT 'SANDBOX_INSTANT_CREDIT',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Withdrawal always goes through a review state, even simulated — this is the habit you want
-- baked in before real money makes it non-optional.
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    request_id       VARCHAR(64) PRIMARY KEY,
    user_id           INTEGER NOT NULL,
    amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
    status            VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW'
                      CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED')),
    reviewed_by_admin_id VARCHAR(64),
    reviewed_at       TIMESTAMP,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_pending ON withdrawal_requests (status, created_at);
```

**Invariant that must hold after every operation:** `user_wallets.balance_cents` for a
user equals the running sum of that user's `wallet_ledger_entries.amount_cents`. Every
wallet-affecting operation writes the ledger row and updates the cached balance in the
same transaction — never one without the other.

---

## 1.5 Transactional Reference Codes (TRC)

To simulate a professional central banking and payment clearance architecture, every ledger entry, fund movement, and operational request MUST generate a unique, alphanumeric **Transactional Reference Code (TRC)**. These codes are exposed in UI ledgers, receipt exports, and administrative consoles as the immutable receipt identifier.

TRC formats are strictly standardized based on the movement type:
1. **Recharge / Deposit**: `DEP-VLM-<SURCHARGE_TYPE>-<8_HEX_CHARS>`
   - *Example*: `DEP-VLM-INST-A3F8B2C9` (Instant card credit)
   - *Example*: `DEP-VLM-ACH-7C21E90F` (Bank transfer clearance)
2. **Withdrawal**: `WTH-VLM-<KYC_LEVEL>-<8_HEX_CHARS>`
   - *Example*: `WTH-VLM-BASIC-E209BC11` (Basic KYC limited withdrawal)
   - *Example*: `WTH-VLM-FULL-4D8830FF` (Fully verified compliance withdrawal)
3. **Escrow Placement (Hold)**: `ESC-HLD-<ASSET_PREFIX>-<8_HEX_CHARS>`
   - *Example*: `ESC-HLD-AST48-9F12B5C0`
4. **Escrow Release**: `ESC-REL-<ASSET_PREFIX>-<8_HEX_CHARS>`
   - *Example*: `ESC-REL-AST48-3A88DC12`
5. **Escrow Reversal / Refund**: `ESC-RFD-<ASSET_PREFIX>-<8_HEX_CHARS>`
   - *Example*: `ESC-RFD-AST48-BB77CC88`
6. **Dispute Penalty (Intended Harm)**: `PEN-HRM-<VIOLATOR_ROLE>-<8_HEX_CHARS>`
   - *Example*: `PEN-HRM-BUYER-8E20D5F1` (25% penalty charged on malicious dispute claim)
   - *Example*: `PEN-HRM-SELLER-11A0D4E2` (25% penalty charged on fraudulent asset upload)

All transactional tables and service-layer ledger logs must store this TRC in the `entry_id` or `transaction_id` fields to maintain complete traceability.

---

## 2. Platform Escrow Authority (distinct from community roles)

Community roles (`community_roles`, bitwise permissions) govern chat/community
moderation. Money decisions are platform-wide and need their own, separate authority
table — don't reuse community permission bits for this, or a community moderator role
could accidentally end up adjacent to withdrawal approval.

```sql
CREATE TABLE IF NOT EXISTS platform_admins (
    admin_id       VARCHAR(64) PRIMARY KEY,
    user_id        INTEGER NOT NULL UNIQUE,
    can_approve_withdrawals BOOLEAN NOT NULL DEFAULT FALSE,
    can_resolve_disputes    BOOLEAN NOT NULL DEFAULT FALSE,
    can_override_escrow     BOOLEAN NOT NULL DEFAULT FALSE, -- manual release/reversal outside normal flow
    granted_by_user_id      INTEGER NOT NULL, -- who gave this admin their powers — always someone, never self-granted
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

-- Every escrow-authority action gets its own audit trail, separate from community_audit_logs,
-- because these need to survive even if the community that generated the transaction is deleted.
CREATE TABLE IF NOT EXISTS platform_financial_audit_logs (
    log_id              VARCHAR(64) PRIMARY KEY,
    acting_admin_id     VARCHAR(64) NOT NULL,
    action_type         VARCHAR(64) NOT NULL, -- 'WITHDRAWAL_APPROVED', 'ESCROW_MANUAL_OVERRIDE', etc.
    related_transaction_id VARCHAR(64),
    reason              TEXT NOT NULL, -- required, not optional — no silent manual overrides
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (acting_admin_id) REFERENCES platform_admins(admin_id) ON DELETE RESTRICT,
    FOREIGN KEY (related_transaction_id) REFERENCES escrow_transactions(transaction_id) ON DELETE SET NULL
);
```

The CLI console and admin panel referenced in `AGENTS.md`'s directory map are the two
surfaces that call into this table — both should require `platform_admins` membership,
checked server-side, before exposing any withdrawal-approval or escrow-override action.

---

## 3. Automation Acting on Behalf of Buyer or Seller

This is the part worth being most careful with — code making financial decisions for
absent humans. The design constraint: **the automation may only ever execute an action
that a human could also have taken through the normal flow, using the existing rules.**
It never invents a new outcome; it just applies the existing settlement/dispute rules
when a timer expires and nobody responded.

```sql
CREATE TABLE IF NOT EXISTS automation_actions (
    action_id             VARCHAR(64) PRIMARY KEY,
    escrow_transaction_id VARCHAR(64) NOT NULL,
    action_type           VARCHAR(32) NOT NULL CHECK (action_type IN (
                              'AUTO_RELEASE', 'AUTO_REFUND', 'AUTO_DISPUTE_ESCALATION'
                          )),
    acted_on_behalf_of    VARCHAR(16) NOT NULL CHECK (acted_on_behalf_of IN ('BUYER', 'SELLER', 'BOTH')),
    trigger_reason        TEXT NOT NULL, -- e.g. "buyer unresponsive 72h post-delivery, seller confirmed delivery"
    executed_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    human_reviewed         BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by_admin_id    VARCHAR(64),
    reviewed_at             TIMESTAMP,
    reversed                BOOLEAN NOT NULL DEFAULT FALSE,
    reversal_ledger_entry_id VARCHAR(64), -- if reversed, points at the compensating ledger row, never edits history
    FOREIGN KEY (escrow_transaction_id) REFERENCES escrow_transactions(transaction_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by_admin_id) REFERENCES platform_admins(admin_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_pending_review ON automation_actions (human_reviewed, executed_at);
```

**Guardrails, non-negotiable:**

1. **Trigger conditions are narrow and time-boxed.** Automation only fires after a
   defined inactivity window (e.g. dispute open with no party response for 72h) — never
   as a first response to a dispute. A human always gets the first chance.
2. **Scope-limited actions only.** The automation can release funds per the existing
   settlement math, or refund per the existing refund rules (Section 4) — it cannot set
   a custom amount, cannot waive the platform fee, cannot act outside the three
   enumerated `action_type` values.
3. **Every action is logged before it takes effect**, with `human_reviewed = FALSE` by
   default. This isn't optional after-the-fact logging — write the row, then act.
4. **A standing review queue**, not just a database column. Whatever admin surface you
   build should default-open to `automation_actions WHERE human_reviewed = FALSE`,
   sorted oldest first, so nothing decided while people were away sits unreviewed
   indefinitely.
5. **Reversible within a grace window.** If review finds the automation got it wrong,
   reversal is a new compensating ledger entry (`AUTOMATED_ADJUSTMENT`, signed opposite
   the original), never an edit to the original entries. History stays intact either way.

---

## 4. Refund vs. Dispute — two different paths, not one

Right now the canonical doc only has one reversal path (sandbox failure → `REVERTED`).
Add a second, lighter path for "I made a mistake" that doesn't require the heavyweight
dispute machinery:

```sql
CREATE TABLE IF NOT EXISTS refund_requests (
    request_id            VARCHAR(64) PRIMARY KEY,
    escrow_transaction_id VARCHAR(64) NOT NULL,
    requested_by_user_id   INTEGER NOT NULL, -- must be the buyer_id on the referenced transaction
    reason                 VARCHAR(255) NOT NULL,
    status                 VARCHAR(32) NOT NULL DEFAULT 'PENDING'
                           CHECK (status IN ('PENDING', 'AUTO_APPROVED', 'ADMIN_APPROVED', 'DENIED')),
    -- auto-approved only if transaction status is still HELD_IN_ESCROW and pre-release —
    -- i.e. before the seller has been paid at all. Post-release refunds always require
    -- can_override_escrow admin action, since real money already moved.
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at             TIMESTAMP,
    FOREIGN KEY (escrow_transaction_id) REFERENCES escrow_transactions(transaction_id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
```

The distinction that matters: a **refund request** is buyer-initiated, self-service
where possible, and only auto-approvable before the seller has been paid. A **dispute**
(`market_support_chats.is_disputed`) is for disagreements about what was delivered, is
never auto-approved, and is the thing that blocks the release job in the canonical doc's
Section 6. Don't let a mistyped quantity turn into a full dispute workflow, and don't let
a real quality complaint get resolved by a refund's lighter auto-approval path.

---

## 5. Ownership Enforcement (the one that's application logic, not schema)

Add this as a hard rule in the service layer, since no CHECK constraint can express it
across a request boundary:

> Every mutating endpoint on `market_assets`, `market_sku_variants`, and
> `market_asset_media` must verify `seller_id === session.user_id` (or
> `platform_admins.can_override_escrow` for admin overrides) server-side before
> executing, and must return the same generic "not found" response for both "doesn't
> exist" and "exists but isn't yours" — don't leak which one it was.

This is the one piece of this whole design that lives in code, not tables — flag it in
the PR review checklist for every marketplace endpoint you write.
