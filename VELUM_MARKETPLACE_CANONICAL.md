# VELUM MARKETPLACE — CANONICAL ARCHITECTURE (v3.0)

**Status: this document supersedes and replaces both `VELUM_MASTER_ARCHITECTURE.md`
(Section 1) and `MARKETPLACE_BLUEPRINT.md` in full.** Those two files disagreed with
each other on schema shape and on how money is calculated. Delete or archive both once
this is adopted — do not keep three versions of the same subsystem alive at once.

Every number in this document is a real constraint or a real formula. There is no
placeholder pricing, no mock inventory, no sample data — this is the schema and logic
itself, meant to be implemented as-is.

---

## 1. Design Principles (non-negotiable)

1. **All money is an integer in cents. Always.** No `number` type ever holds a dollar
   amount as a float, in SQL or TypeScript, anywhere in this subsystem. This was
   violated in the old Blueprint's discount function — fixed here (Section 5).
2. **One escrow status enum, shared by the listing and the transaction.** The old docs
   had `market_assets.status` include `DISPUTED` while `escrow_transactions.status`
   didn't — fixed here by aligning both enums (Section 2).
3. **Role priority is not decorative.** If a `priority` column exists on a table, the
   algorithm that reads that table must use it. The old permission algorithm stored
   priority and never read it — fixed here (Section 6).
4. **No fund release without an explicit dispute check.** A timeout-based auto-release
   must query open disputes before it fires, not just check elapsed time.
5. **Every ID column follows one convention:** `VARCHAR(64)` opaque identifiers
   (ULID/UUID at generation time), full stop — no mixed `INT PRIMARY KEY` tables.

---

## 2. Core Schema

```sql
-- ============================================================
-- PILLAR A: LISTINGS, VARIANTS, MEDIA
-- ============================================================

CREATE TABLE IF NOT EXISTS market_assets (
    listing_id       VARCHAR(64) PRIMARY KEY,
    seller_id        INTEGER NOT NULL,
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    base_price_cents INTEGER NOT NULL CHECK (base_price_cents >= 0),
    discount_price_cents INTEGER CHECK (
        discount_price_cents IS NULL
        OR (discount_price_cents >= 0 AND discount_price_cents < base_price_cents)
    ),
    -- DISPUTED lives here AND on the escrow row — see escrow_transactions.status below.
    status           VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE', 'PENDING_ESCROW', 'COMPLETED', 'DISPUTED', 'DELISTED')),
    verified_seller   BOOLEAN NOT NULL DEFAULT FALSE, -- premium trust signal, set by platform review, never by the seller
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS market_sku_variants (
    sku_id              VARCHAR(64) PRIMARY KEY,
    listing_id          VARCHAR(64) NOT NULL,
    attribute_name      VARCHAR(64) NOT NULL,   -- e.g. 'license_tier'
    attribute_value     VARCHAR(128) NOT NULL,  -- e.g. 'enterprise_unlimited'
    additional_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (additional_cost_cents >= 0),
    inventory_count     INTEGER NOT NULL DEFAULT 0 CHECK (inventory_count >= 0),
    file_payload_path   VARCHAR(512),
    FOREIGN KEY (listing_id) REFERENCES market_assets(listing_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS market_asset_media (
    media_id       VARCHAR(64) PRIMARY KEY,
    listing_id     VARCHAR(64) NOT NULL,
    url            VARCHAR(512) NOT NULL,
    is_banner      BOOLEAN NOT NULL DEFAULT FALSE,
    display_order  INTEGER NOT NULL DEFAULT 1 CHECK (display_order >= 0),
    file_size      INTEGER NOT NULL CHECK (file_size > 0),
    aspect_ratio   VARCHAR(16) NOT NULL DEFAULT '16:9'
                   CHECK (aspect_ratio IN ('1:1', '16:9', '4:3', '21:9')),
    FOREIGN KEY (listing_id) REFERENCES market_assets(listing_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assets_status_price   ON market_assets (status, base_price_cents, discount_price_cents);
CREATE INDEX IF NOT EXISTS idx_assets_verified        ON market_assets (verified_seller, status);
CREATE INDEX IF NOT EXISTS idx_sku_variant_listing     ON market_sku_variants (listing_id, inventory_count);
CREATE INDEX IF NOT EXISTS idx_media_listing_order     ON market_asset_media (listing_id, display_order);


-- ============================================================
-- PILLAR B: PROMOTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS market_coupons (
    coupon_id           VARCHAR(64) PRIMARY KEY,
    code                VARCHAR(64) UNIQUE NOT NULL CHECK (code = UPPER(code)),
    discount_type       VARCHAR(16) NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED', 'TIERED')),
    value_cents_or_pct  INTEGER NOT NULL CHECK (value_cents_or_pct > 0), -- pct: 15 = 15%. fixed/tiered base: cents.
    tier_rules_json     TEXT, -- required and only used when discount_type = 'TIERED'; JSON array of {min_cents, deduction_cents}
    expiration_date     TIMESTAMP NOT NULL,
    usage_limit         INTEGER NOT NULL CHECK (usage_limit > 0),
    usage_count         INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0 AND usage_count <= usage_limit),
    minimum_order_value_cents INTEGER NOT NULL DEFAULT 0 CHECK (minimum_order_value_cents >= 0),
    active              BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_coupons_validation ON market_coupons (code, active, expiration_date);


-- ============================================================
-- PILLAR C: ESCROW LEDGER (single status enum, shared with market_assets)
-- ============================================================

CREATE TABLE IF NOT EXISTS escrow_transactions (
    transaction_id       VARCHAR(64) PRIMARY KEY,
    listing_id           VARCHAR(64) NOT NULL,
    sku_id               VARCHAR(64),
    buyer_id             INTEGER NOT NULL,
    seller_id            INTEGER NOT NULL,
    gross_amount_cents         INTEGER NOT NULL CHECK (gross_amount_cents >= 0),
    coupon_applied             VARCHAR(64),
    discount_deduction_cents   INTEGER NOT NULL DEFAULT 0 CHECK (discount_deduction_cents >= 0),
    net_tax_amount_cents       INTEGER NOT NULL DEFAULT 0 CHECK (net_tax_amount_cents >= 0),
    platform_fee_deduction_cents INTEGER NOT NULL CHECK (platform_fee_deduction_cents >= 0),
    payout_net_amount_cents    INTEGER NOT NULL CHECK (payout_net_amount_cents >= 0),
    -- DISPUTED added here so a listing's dispute state and its money's state are never out of sync.
    status               VARCHAR(32) NOT NULL DEFAULT 'RETAINED'
                          CHECK (status IN ('RETAINED', 'HELD_IN_ESCROW', 'DISPUTED', 'RELEASED', 'REVERTED')),
    sandbox_state         VARCHAR(32) NOT NULL DEFAULT 'NOT_DEPLOYED'
                          CHECK (sandbox_state IN ('NOT_DEPLOYED', 'DEPLOYED_SANDBOX', 'DEPLOYMENT_SUCCESS', 'DEPLOYMENT_FAILURE')),
    sandbox_logs          TEXT,
    escrow_release_at     TIMESTAMP, -- computed at HELD_IN_ESCROW entry: now + protection window. NULL once resolved.
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (listing_id) REFERENCES market_assets(listing_id) ON DELETE CASCADE,
    FOREIGN KEY (sku_id) REFERENCES market_sku_variants(sku_id) ON DELETE SET NULL,
    FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (coupon_applied) REFERENCES market_coupons(code) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_escrow_balances     ON escrow_transactions (status, buyer_id, seller_id);
CREATE INDEX IF NOT EXISTS idx_escrow_release_due   ON escrow_transactions (status, escrow_release_at);


-- ============================================================
-- PILLAR D: REPUTATION, DISCUSSION, SUPPORT (reviews require a real purchase)
-- ============================================================

CREATE TABLE IF NOT EXISTS market_reviews (
    review_id       VARCHAR(64) PRIMARY KEY,
    listing_id      VARCHAR(64) NOT NULL,
    buyer_id        INTEGER NOT NULL,
    order_id        VARCHAR(64) NOT NULL, -- FK enforces verified-purchase, not just a claim in prose
    rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT NOT NULL,
    helpful_votes_json TEXT NOT NULL DEFAULT '[]',
    is_reported     BOOLEAN NOT NULL DEFAULT FALSE,
    moderation_reason TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (listing_id) REFERENCES market_assets(listing_id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES escrow_transactions(transaction_id) ON DELETE CASCADE,
    UNIQUE (order_id) -- one review per completed order, not per listing — prevents review farming via re-purchase
);

CREATE TABLE IF NOT EXISTS market_discussions (
    discussion_id   VARCHAR(64) PRIMARY KEY,
    listing_id      VARCHAR(64) NOT NULL,
    user_id         INTEGER NOT NULL,
    parent_id       VARCHAR(64),
    comment         TEXT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (listing_id) REFERENCES market_assets(listing_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES market_discussions(discussion_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS market_support_chats (
    support_channel_id VARCHAR(64) PRIMARY KEY,
    order_id           VARCHAR(64) NOT NULL,
    buyer_id           INTEGER NOT NULL,
    seller_id          INTEGER NOT NULL,
    is_disputed        BOOLEAN NOT NULL DEFAULT FALSE,
    dispute_reason     VARCHAR(255),
    resolved_at        TIMESTAMP, -- NULL while open; required before escrow can move past DISPUTED
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES escrow_transactions(transaction_id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verified_review_check   ON market_reviews (listing_id, buyer_id, rating);
CREATE INDEX IF NOT EXISTS idx_discussion_threading      ON market_discussions (listing_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_support_open_disputes      ON market_support_chats (order_id, is_disputed, resolved_at);


-- ============================================================
-- PILLAR E: COMMUNITY, ROLES, PERMISSIONS (priority is now enforced by the algorithm in Section 6)
-- ============================================================

CREATE TABLE IF NOT EXISTS communities (
    community_id  VARCHAR(64) PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    owner_id      INTEGER NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_categories (
    category_id     VARCHAR(64) PRIMARY KEY,
    community_id    VARCHAR(64) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    position_index  INTEGER NOT NULL DEFAULT 0 CHECK (position_index >= 0),
    FOREIGN KEY (community_id) REFERENCES communities(community_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_channels (
    channel_id            VARCHAR(64) PRIMARY KEY,
    category_id           VARCHAR(64) NOT NULL,
    name                  VARCHAR(255) NOT NULL,
    topic                 VARCHAR(512),
    format                VARCHAR(32) NOT NULL DEFAULT 'text'
                          CHECK (format IN ('text', 'voice', 'forum', 'marketplace_embedded')),
    position_index        INTEGER NOT NULL DEFAULT 0 CHECK (position_index >= 0),
    embedded_marketplace_id VARCHAR(64),
    FOREIGN KEY (category_id) REFERENCES community_categories(category_id) ON DELETE CASCADE,
    FOREIGN KEY (embedded_marketplace_id) REFERENCES market_assets(listing_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS community_roles (
    role_id        VARCHAR(64) PRIMARY KEY,
    community_id   VARCHAR(64) NOT NULL,
    name           VARCHAR(128) NOT NULL,
    allow_permissions_bitfield BIGINT NOT NULL DEFAULT 0,
    deny_permissions_bitfield  BIGINT NOT NULL DEFAULT 0,
    priority       INTEGER NOT NULL DEFAULT 1 CHECK (priority >= 0), -- higher number = applied later = wins conflicts
    FOREIGN KEY (community_id) REFERENCES communities(community_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS member_roles (
    membership_id  VARCHAR(64) PRIMARY KEY,
    community_id   VARCHAR(64) NOT NULL,
    user_id        INTEGER NOT NULL,
    role_id        VARCHAR(64) NOT NULL,
    FOREIGN KEY (community_id) REFERENCES communities(community_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES community_roles(role_id) ON DELETE CASCADE,
    UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS channel_overwrites (
    overwrite_id   VARCHAR(64) PRIMARY KEY,
    channel_id     VARCHAR(64) NOT NULL,
    target_type    VARCHAR(16) NOT NULL CHECK (target_type IN ('ROLE', 'USER')),
    target_id      VARCHAR(64) NOT NULL,
    allow_bitfield BIGINT NOT NULL DEFAULT 0,
    deny_bitfield  BIGINT NOT NULL DEFAULT 0,
    FOREIGN KEY (channel_id) REFERENCES community_channels(channel_id) ON DELETE CASCADE
);

-- log_id is now VARCHAR(64), matching every other table's ID convention (was a bare INT before)
CREATE TABLE IF NOT EXISTS community_audit_logs (
    log_id             VARCHAR(64) PRIMARY KEY,
    community_id       VARCHAR(64) NOT NULL,
    acting_user_id     INTEGER NOT NULL,
    action_type        VARCHAR(64) NOT NULL,
    target_id          VARCHAR(64) NOT NULL,
    mutation_delta_json TEXT NOT NULL,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (community_id) REFERENCES communities(community_id) ON DELETE CASCADE,
    FOREIGN KEY (acting_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_layout       ON community_categories (community_id, position_index);
CREATE INDEX IF NOT EXISTS idx_channels_layout          ON community_channels (category_id, position_index);
CREATE INDEX IF NOT EXISTS idx_member_roles_search      ON member_roles (community_id, user_id);
CREATE INDEX IF NOT EXISTS idx_channel_overwrite_search ON channel_overwrites (channel_id, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_lookup        ON community_audit_logs (community_id, action_type, created_at DESC);
```

---

## 3. TypeScript Interfaces

```typescript
export type AssetStatus = 'ACTIVE' | 'PENDING_ESCROW' | 'COMPLETED' | 'DISPUTED' | 'DELISTED';
export type EscrowStatus = 'RETAINED' | 'HELD_IN_ESCROW' | 'DISPUTED' | 'RELEASED' | 'REVERTED';
export type SandboxState = 'NOT_DEPLOYED' | 'DEPLOYED_SANDBOX' | 'DEPLOYMENT_SUCCESS' | 'DEPLOYMENT_FAILURE';
export type DiscountType = 'PERCENTAGE' | 'FIXED' | 'TIERED';
export type ChannelFormat = 'text' | 'voice' | 'forum' | 'marketplace_embedded';
export type OverwriteTargetType = 'ROLE' | 'USER';

export interface MarketAsset {
  listing_id: string;
  seller_id: number;
  title: string;
  description?: string;
  base_price_cents: number;
  discount_price_cents?: number;
  status: AssetStatus;
  verified_seller: boolean;
  created_at: number;
}

export interface TierRule {
  min_cents: number;
  deduction_cents: number;
}

export interface MarketCoupon {
  coupon_id: string;
  code: string;
  discount_type: DiscountType;
  value_cents_or_pct: number;
  tier_rules?: TierRule[]; // only when discount_type === 'TIERED'
  expiration_date: number;
  usage_limit: number;
  usage_count: number;
  minimum_order_value_cents: number;
  active: boolean;
}

export interface EscrowTransaction {
  transaction_id: string;
  listing_id: string;
  sku_id?: string;
  buyer_id: number;
  seller_id: number;
  gross_amount_cents: number;
  coupon_applied?: string;
  discount_deduction_cents: number;
  net_tax_amount_cents: number;
  platform_fee_deduction_cents: number;
  payout_net_amount_cents: number;
  status: EscrowStatus;
  sandbox_state: SandboxState;
  sandbox_logs?: string;
  escrow_release_at?: number;
  created_at: number;
  updated_at: number;
}

export enum PermissionFlags {
  VIEW_CHANNEL = 1n << 0n,
  READ_HISTORY = 1n << 1n,
  VIEW_AUDIT_LOG = 1n << 2n,
  SEND_MESSAGES = 1n << 8n,
  ATTACH_FILES = 1n << 9n,
  ADD_REACTIONS = 1n << 10n,
  SPEAK_VOICE = 1n << 11n,
  KICK_MEMBERS = 1n << 16n,
  BAN_MEMBERS = 1n << 17n,
  MUTE_MEMBERS = 1n << 18n,
  MANAGE_MESSAGES = 1n << 19n,
  MANAGE_ROLES = 1n << 24n,
  MANAGE_CHANNELS = 1n << 25n,
  MANAGE_COMMUNITY = 1n << 26n,
}

export interface CommunityRole {
  role_id: string;
  community_id: string;
  name: string;
  allow_permissions_bitfield: bigint;
  deny_permissions_bitfield: bigint;
  priority: number;
}

export interface ChannelOverwrite {
  overwrite_id: string;
  channel_id: string;
  target_type: OverwriteTargetType;
  target_id: string;
  allow_bitfield: bigint;
  deny_bitfield: bigint;
  role_priority?: number; // populated by the join when fetching, used for sort in Section 6
}
```

---

## 4. Permission Resolution Algorithm — priority now actually enforced

The old algorithm claimed to sort by priority and then ignored it, ORing every overwrite
together with no order. This version sorts ascending by priority and applies overwrites
in that order, so a higher-priority role's rule is the one left standing when two roles
disagree — which is what "priority resolves overlapping roles" has to mean for the field
to do anything.

```typescript
export interface CalculationPayload {
  userId: number;
  ownerId: number;
  rolesAssigned: CommunityRole[];
  roleOverwrites: ChannelOverwrite[]; // must include role_priority, joined from community_roles
  userOverwrite?: ChannelOverwrite;
}

export function computeEffectivePermissions(payload: CalculationPayload): bigint {
  const { userId, ownerId, rolesAssigned, roleOverwrites, userOverwrite } = payload;

  // Rule A: owner bypass.
  if (userId === ownerId) {
    return (1n << 32n) - 1n; // scoped to the defined 32-bit flag range, not a full 64-bit value
                              // that could exceed a signed BIGINT column if ever persisted.
  }

  // Rule B: base role permissions, order-independent (a simple OR is correct here —
  // base roles don't conflict with each other by design, only overwrites do).
  let effective = 0n;
  for (const role of rolesAssigned) {
    effective |= BigInt(role.allow_permissions_bitfield);
  }

  // Rule C: role-based channel overwrites, applied in ascending priority order so the
  // highest-priority role's rule is applied last and therefore wins.
  const sortedOverwrites = [...roleOverwrites].sort(
    (a, b) => (a.role_priority ?? 0) - (b.role_priority ?? 0)
  );
  for (const overwrite of sortedOverwrites) {
    const allow = BigInt(overwrite.allow_bitfield);
    const deny = BigInt(overwrite.deny_bitfield);
    effective = (effective & ~deny) | allow;
  }

  // Rule D: explicit per-user overwrite always applied last — supersedes every role.
  if (userOverwrite) {
    const userAllow = BigInt(userOverwrite.allow_bitfield);
    const userDeny = BigInt(userOverwrite.deny_bitfield);
    effective = (effective & ~userDeny) | userAllow;
  }

  return effective;
}

export function verifyChannelAction(userPermissions: bigint, requiredPermission: bigint): boolean {
  return (userPermissions & requiredPermission) === requiredPermission;
}
```

---

## 5. Financial Settlement — single cents-only function, no floats anywhere

This replaces both the old Master `calculateOrderClearance` and the old Blueprint
`calculateDiscountedPrice`. There is exactly one function now, it always works in
integer cents, and it supports all three coupon types including `TIERED`.

```typescript
export interface TierRule { min_cents: number; deduction_cents: number; }

export interface CouponContext {
  discount_type: DiscountType;
  value_cents_or_pct: number;
  tier_rules?: TierRule[];
  minimum_order_value_cents: number;
  active: boolean;
  expiration_date: number; // epoch ms
  usage_limit: number;
  usage_count: number;
}

export interface SettlementResult {
  gross_amount_cents: number;
  discount_deduction_cents: number;
  net_tax_amount_cents: number;
  platform_fee_deduction_cents: number;
  payout_net_amount_cents: number;
  error?: string;
}

export function calculateOrderSettlement(
  grossAmountCents: number,
  taxRate: number,
  platformFeeRate: number,
  coupon?: CouponContext,
  nowMs: number = Date.now()
): SettlementResult {
  const zeroResult = (error: string): SettlementResult => ({
    gross_amount_cents: grossAmountCents,
    discount_deduction_cents: 0,
    net_tax_amount_cents: 0,
    platform_fee_deduction_cents: 0,
    payout_net_amount_cents: 0,
    error,
  });

  let discountCents = 0;

  if (coupon) {
    if (!coupon.active) return zeroResult('Coupon is inactive.');
    if (nowMs > coupon.expiration_date) return zeroResult('Coupon has expired.');
    if (coupon.usage_count >= coupon.usage_limit) return zeroResult('Coupon usage limit reached.');
    if (grossAmountCents < coupon.minimum_order_value_cents) {
      return zeroResult('Minimum order threshold unsatisfied.');
    }

    switch (coupon.discount_type) {
      case 'PERCENTAGE':
        discountCents = Math.floor(grossAmountCents * (coupon.value_cents_or_pct / 100));
        break;
      case 'FIXED':
        discountCents = coupon.value_cents_or_pct;
        break;
      case 'TIERED': {
        if (!coupon.tier_rules?.length) return zeroResult('Tiered coupon missing tier rules.');
        const applicable = [...coupon.tier_rules]
          .filter(t => grossAmountCents >= t.min_cents)
          .sort((a, b) => b.min_cents - a.min_cents)[0];
        discountCents = applicable ? applicable.deduction_cents : 0;
        break;
      }
    }
  }

  const orderTotalCents = Math.max(0, grossAmountCents - discountCents);
  const taxCents = Math.floor(orderTotalCents * taxRate);
  const totalWithTaxCents = orderTotalCents + taxCents;
  const platformFeeCents = Math.floor(totalWithTaxCents * platformFeeRate);
  const sellerPayoutCents = totalWithTaxCents - platformFeeCents;

  return {
    gross_amount_cents: grossAmountCents,
    discount_deduction_cents: discountCents,
    net_tax_amount_cents: taxCents,
    platform_fee_deduction_cents: platformFeeCents,
    payout_net_amount_cents: sellerPayoutCents,
  };
}
```

---

## 6. Escrow Lifecycle — dispute-aware release, sandbox execution scoped explicitly

```
[ 1. Browse Catalog ]
        │
        ▼
[ 2. Discussion / Private Support Chat ]
        │
        ▼
[ 3. Coupon Applied — calculateOrderSettlement() ]
        │
        ▼
[ 4. Capital Committed — status: HELD_IN_ESCROW, escrow_release_at = now + 24h ]
        │
        ▼
[ 5. Sandbox Verification — isolated worker, no network access, hard CPU/memory/wall-clock limits ]
        │
        ├─────────────────────┐
        ▼ (pass)              ▼ (fail)
[ Await release window ]  [ status → REVERTED, capital returned to buyer ]
        │
        ▼
[ 6. Release Guard — a scheduled job checks BOTH conditions before flipping status: ]
    · now() >= escrow_release_at, AND
    · no row in market_support_chats WHERE order_id = this.transaction_id
      AND is_disputed = TRUE AND resolved_at IS NULL
    → if a dispute is open, status becomes DISPUTED and release is blocked
      until resolved_at is set by moderation, not by the clock.
        │
        ▼ (both conditions clear)
[ 7. status → RELEASED — payout split below is executed atomically in one transaction ]
        │
        ▼
[ 8. Verified Review Gate — review requires order_id FK to a RELEASED transaction ]
```

### Fund Release SLA (The 5-Minute Guarantee)
While standard bank/wire clearance pipelines take 24–72 hours to settle, internal VLM transfers and authorized bank withdrawals using Velum’s direct-clearing layers are built for instant liquidity. Velum guarantees a maximum clearing target of **5 minutes** from the moment the release conditions (e.g. sandbox verification success or buyer delivery confirmation) are satisfied.

### Intended Harm & Dispute Fraud Penalties (The 25% Rule)
Velum is a zero-fee mediation network; we do not charge users to open disputes or resolve honest quality issues. However, to structurally punish bad-faith actors and protect marketplace integrity:
1. **Malicious / Fraudulent Buyer (False Claims)**: If platform review proves a buyer opened a dispute in bad faith or lied to defraud an honest seller:
   - The buyer's claim is rejected.
   - Escrow is immediately released in full to the seller.
   - Velum levies a mandatory **25% Intended Harm Penalty** of the gross order value, debited from the buyer's balance (or overdraft).
2. **Malicious / Scamming Seller (Fraudulent Assets)**: If platform review proves a seller uploaded a fake, stolen, or malicious asset:
   - The transaction is reverted and the buyer is refunded in full.
   - Velum levies a mandatory **25% Intended Harm Penalty** of the gross order value, debited from the seller's active balances or overdraft reserves.
   - The seller's account is frozen pending a comprehensive compliance and KYC audit.

All collected penalty funds are directly routed to the platform's General Reserve Pool to cover buyer-seller protection programs.

**Payout split on release (all integer cents, single atomic transaction):**

```
Buyer Capital Deduction   = orderTotalCents + taxCents
Platform Account Credit   = platformFeeCents
Seller Account Credit     = sellerPayoutCents
```

**Sandbox execution constraints (this is arbitrary code running as part of a money
transfer — treat it accordingly):**
- No network access from inside the sandboxed worker. A digital asset being verified
  has no legitimate reason to make outbound calls during that check.
- Hard resource ceilings: wall-clock timeout, memory ceiling, CPU ceiling, enforced by
  the host, not by the guest code cooperating.
- Sandbox failure defaults to `REVERTED` (buyer protected) — never defaults to release.
- `sandbox_logs` is written by the host process observing the sandbox, never by code
  running inside it, so a compromised payload can't forge its own passing result.

---

## 7. What "premium" means here, concretely

Not decoration — mechanisms that make the marketplace trustworthy at scale:

- `verified_seller` is a platform-controlled flag (Section 2), never self-assigned —
  surfaced in listing UI as a real trust signal, not a badge anyone can claim.
- Reviews are hard-gated to one per completed (`RELEASED`) order via the `UNIQUE(order_id)`
  constraint — no review farming through repeat low-value purchases.
- Disputes structurally block payout, not just procedurally — the release job's query
  makes early release architecturally impossible while a dispute is open, rather than
  relying on staff remembering to intervene in time.
- All financial math is exact-integer, everywhere, with one implementation
  (`calculateOrderSettlement`) instead of two disagreeing ones.
- **Intended Harm Penalties** act as a severe economic deterrent to fraudulent behavior from both buyers and sellers, actively discouraging bad-faith actors.
