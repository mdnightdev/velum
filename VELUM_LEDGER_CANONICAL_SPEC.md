# VELUM CANONICAL LEDGER & MARKETPLACE SPECIFICATION

This canonical reference document consolidates and supersedes all prior specifications regarding the database schemas, mathematical formulas, user identity validations, transaction escrow life cycles, and simulated clearing network constraints of the Velum ecosystem.

---

## 1. Architectural & Database Rules

### 1.1 Integer Cents Constraint
* **No Float Currency Values**: All currency amounts (wallet balances, transaction sizes, transaction fees, and exchange spreads) MUST be stored, calculated, and processed strictly as **integers in cents** (e.g., £10.00 is represented as `1000`).
* **Implementation Standard**: This rule applies globally across SQL definitions, TypeScript typings, backend route math, and client-side calculations.

### 1.2 Identifiers and Primary Keys
* **Id Column Standard**: Table identifier columns (except user identifiers) use `VARCHAR(64)` opacity tokens generated at execution (ULIDs or UUIDs).
* **User Identifier Exception**: The core `user_id` identifier is stored and passed as an `INTEGER` (not VARCHAR) to preserve foreign-key integrity constraints matching legacy user routes.
* **Cascade Safeguard**: All foreign keys pointing to `users(user_id)` on financial ledger or transaction tables MUST employ `ON DELETE RESTRICT` constraints (never `ON DELETE CASCADE`) to prevent catastrophic loss of transaction footprints during user sanitization.

---

## 2. Double-Entry Accounting and Central Reserves

### 2.1 The Closed-Loop System
* **Native Exchange Medium**: Powered by Velum Token (**VLM**), an internal virtual currency.
* **Fiat Equivalents**: Supports simulated multi-currency ledger balances pegged to real-world fiat counterparts (USD, EUR, GBP).
* **Reserve Treasury**: Backed by a starting central reserve pool of **£150,000,000 VLM** to secure platform liquidity, deposits, and settlement clearing.

### 2.2 Dynamic Fees and Spreads
* **Standard Platform Fee**: Automatically deducted from the gross transaction value at the moment of escrow release.
* **Currency Conversion Spread**: Every internal exchange process carries a flat **1.5% platform spread** collected automatically into Velum's reserve treasury.
* **Mediation Auditing**: Administrative ticket handling, dispute mediation, and general support channels carry zero surcharge fees.

---

## 3. Marketplace Escrow Lifecycle

### 3.1 Transaction States
Escrow and listing transactions flow through a unified state matrix:
* `PENDING`: Escrow initialized; awaiting buyer payment confirmation.
* `HELD_IN_ESCROW`: Funds secured in isolated storage; unreachable by either buyer or seller.
* `DISPUTED`: Transaction locked due to mediation request.
* `RELEASED`: Funds settled and credited directly to the seller's active wallet balance.
* `REFUNDED`: Funds returned to the buyer's wallet balance.

### 3.2 The 5-Minute Clearing SLA
* **Automated Worker**: A background clearing worker scans the database every 5 minutes (`PM2_INSTANCE_ID === "0"`).
* **Auto-Release Trigger**: Any transaction marked `HELD_IN_ESCROW` that has existed for more than 5 minutes (and has no active flag for `is_disputed = 1`) is automatically settled and released to the seller.
* **Dispute Lock**: If a dispute is actively flag-locked, the automated release is bypassed, keeping the funds frozen in custody until manual support mediation resolves the incident.

### 3.3 The 25% Intended Harm Penalty
To prevent fraud and malicious behavior, a flat **25% dispute penalty** is enforced upon mediation resolution:
* **Buyer Bad-Faith Infraction**: If a buyer opens a dispute in bad faith or attempts chargeback loops, they are assessed a penalty of **25% of the transaction value**. The dispute is closed, and the remaining 75% is released to the seller.
* **Seller Malicious Payload Infraction**: If a seller provides malicious files, empty downloads, or violates terms, they are assessed a penalty of **25% of the transaction value**. The transaction is reversed, refunding 100% of the funds to the buyer from the seller's holdings.
* **Negative Overdraft**: If the balance is insufficient to satisfy the 25% penalty, the user's active wallet balance enters a negative overdraft state, restricting platform interaction until reconciled.

---

## 4. Simulated Bank Network & KYC Integration

### 4.1 Automated Sandbox Scans
* **Payload Verification**: Uploaded digital goods undergo simulated file scans. Results are logged to the transaction history for auditor tracking.

### 4.2 KYC Withdrawal Gates
* **Verification Constraint**: Withdrawals are strictly gated behind user verification. An account MUST possess `VERIFIED` KYC status to execute withdrawals.
* **Tiered Limits**: Verification tiers impose structured transaction limits on deposits and withdrawals:
  * *Unverified (Tier 0)*: Deposits capped at $500, withdrawals blocked.
  * *Verified (Tier 1)*: Single-day transaction limits up to $10,000.

### 4.3 Simulated Payment Rails
* **Recharge and Withdraw**: Simulated credit/card network APIs simulate transaction clearance from external banks into internal ledger wallets via standardized Transaction Record Codes (TRC).
