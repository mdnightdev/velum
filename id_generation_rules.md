# Velum ID Generation Rules

## 1. Users & Admins
- **`user_id`**: Auto-incrementing integer (e.g., `1`, `2`, `1001`).
  - **Logic:** `Math.max(...users.map(u => Number(u.user_id)), 0) + 1`
  - **File:** `server/db/userRepository.ts`
- **Admins**: Share the same `user_id` pool (differentiated by `role` field like `CLI_ADMIN` or `SUPPORT_ADMIN`).
- **`profile_id`**: Custom string prefix `p_` + `user_id` (e.g., `p_1`).

## 2. Lounges & Rooms
- **Sublounges / Community Channels (`lounge_id`)**: Custom string prefix `comm_` + Timestamp + 5 random base36 chars.
  - **Format:** `comm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
  - **File:** `server/controllers/lounges.ts`
- **User Discussions / DM Rooms (`room_id` in lounge_rooms)**: 20-character ULID (Crockford Base32 format without a prefix).
  - **Format:** E.g., `01KWP874XCPDK4H5G2EK`
  - **Logic:** `generateUlid()` which combines 10 chars of time-part and 10 chars of crypto-random part.
  - **Files:** `server/utils/ulid.ts` and fallback generation in `server/db/index.ts`.
- **Lounge Invites (`invite_id`)**: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`

## 3. Products & Marketplace
- **Listings (`listing_id`)**: Custom string prefix `list_`
  - **Format:** `list_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
  - **File:** `server/controllers/marketplace.ts`
- **SKUs / Variants (`sku_id`)**: `sku_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`
- **Media (`media_id`)**: `med_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
- **Reviews (`review_id`)**: `rev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
- **Coupons (`coupon_id`)**: `cpn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`

## 4. Escrow Transactions & Ledgers
- **Escrow Transactions (`transaction_id`)**: Custom string prefix `esc_`
  - **Format:** `esc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
  - **File:** `server/controllers/marketplace.ts`
- **Ledger Entries (`entry_id`)**: Highly detailed custom string prefix `led_` + Timestamp + Action Context + Random String.
  - **Format:** `led_${Date.now()}_[CONTEXT]_${Math.random().toString(36).substr(2, 5)}`
  - **Context Tags:**
    - `rf` (Standard Refund)
    - `mr` / `mf` / `mrf` (Manual Release / Manual Fee / Manual Refund by Admin)
    - `ar` / `af` (Auto Release / Auto Fee by Settlement Job)
    - `srel` / `sfee` (Seller Release / Seller Fee)
    - `spen` / `bpen` (Seller Penalty / Buyer Penalty)
    - `brewd` / `srewd` (Buyer Reward / Seller Reward)
    - `bref` (Buyer Refund)
- **Refund Requests (`request_id`)**: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
- **Audits (`log_id`)**: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
