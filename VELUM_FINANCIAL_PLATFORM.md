# VELUM FINANCIAL PLATFORM — TERMS OF SERVICE, PRIVACY POLICY & FAQ (v1.0)

Welcome to Velum. We operate a highly secure, centralized digital asset escrow and closed-loop ledger clearing system. This document outlines the legal, financial, and operational guidelines governing your Velum account, wallet balances, transaction processing, and dispute resolution.

---

## PART 1: TERMS OF SERVICE (TOS)

### 1. The Velum Ledger Ecosystem
1.1 **Closed-Loop Nature of VLM**: Velum is powered by Velum Tokens (**VLM**), our native ecosystem digital utility. VLM acts as an internal, high-velocity virtual exchange medium.
1.2 **Fiat Pegs and Equivalency**: For user convenience, Velum supports multi-currency accounts mirroring real-world fiat counterparts (GBP, EUR, USD). Internal balances in these simulated currencies represent real-world escrow claims.
1.3 **Reserve Pools**: The platform is backed by Velum's institutional starting reserves of **£150M VLM** to guarantee aggregate liquidity, settlement, and instant clearing across our user base.

### 2. Transaction Settlement & The 5-Minute Guarantee
2.1 **Instant Clearing SLA**: While traditional commercial banks and clearing networks require 1 to 3 business days for fund settlement, Velum utilizes an off-chain instant double-entry ledger.
2.2 **The 5-Minute Release Target**: We guarantee that once all transaction validation criteria are met (including successful automated sandbox scans or explicit buyer delivery receipts), escrow funds will be cleared and credited to the seller's active wallet balance in **under five (5) minutes**.
2.3 **Escrow Retainment**: All buyer payments are securely held in isolated escrow custody (`status = 'HELD_IN_ESCROW'`) and are structurally unreachable by both the seller and the platform's standard operational accounts until the 5-minute clearing window triggers.

### 3. Fee Structure and Dynamic Spreads
3.1 **Standard Platform Fee**: A platform fee (governed by the active marketplace tier) is automatically deducted from the gross order value at the moment of escrow release.
3.2 **Currency Exchange Spread**: All internal currency exchange transactions are subject to a standard platform spread of **1.5%** of the gross converted amount. This spread is collected automatically into Velum’s reserve treasury.
3.3 **No Surcharges on Honest Disputes**: Velum does not charge any administrative or arbitration fees to resolve disputes, open support channels, or request manual mediation.

### 4. Dispute Resolution & Intended Harm Penalties (The 25% Rule)
4.1 **Mediation Standard**: In the event of an open dispute (`is_disputed = TRUE`), both parties must cooperate with Velum compliance officers. Payout of the held escrow is frozen.
4.2 **The 25% Fraud Penalty**: To maintain market trust and strictly deter fraudulent behaviors, Velum imposes an **Intended Harm Penalty equal to 25% of the transaction value**:
   - **Buyer Infraction**: If a buyer opens a dispute in bad faith, lies about delivery condition, or attempts to abuse the refund loop, they are charged a 25% penalty fee, the dispute is closed, and funds are released to the seller.
   - **Seller Infraction**: If a seller uploads a malicious payload, copy-pasted/stolen files, or attempts to substitute listing content, they are charged a 25% penalty fee, the transaction is reversed to refund the buyer, and the seller’s account is frozen.
4.3 **Overdraft & Collections**: If the offending party’s active wallet balance is insufficient to cover the 25% penalty, their account balance will enter a negative overdraft state. Normal platform capabilities will be restricted until the debt is reconciled.

---

## PART 2: PRIVACY & DATA PROTECTION POLICY

### 1. Tokenization and Card Security
1.1 **Tokenize, Don't Store**: Velum does not store raw credit card numbers (PANs), debit card security codes (CVV), or direct bank account passwords in our application database.
1.2 **Opaque External References**: Any saved bank or card payment method is tokenized immediately through our external bank simulator. The database only retains an opaque reference token (`external_account_token`) and a masked descriptor (e.g., `Visa •••• 4242`).

### 2. KYC Document Retention and Processing
2.1 **Identification Requirements**: Withdrawals are strictly gated behind Know Your Customer (KYC) standards. Basic KYC requires name and email verification; Full KYC requires a government-issued identification check.
2.2 **Mock Reference Vaults**: All uploaded documents are matched to virtual references in our isolated compliance vault. The production application never exposes or logs raw document images.
2.3 **Audit Logs**: Every administrative override, withdrawal approval, or limit adjustment generates a cryptographic, immutable entry in the `platform_financial_audit_logs` table, detailing the administrator ID, the action, and the regulatory justification.

---

## PART 3: FREQUENTLY ASKED QUESTIONS (FAQ)

### Q1: What is the Velum 5-Minute Guarantee?
Traditional payment platforms let sellers wait days for credit card settlement. Because Velum acts as the direct clearing vault and balances are backed by our institutional reserves, we guarantee to complete the internal transfer and update your wallet ledger within **5 minutes** of clearing escrow checks.

### Q2: Why does Velum charge a 25% penalty on disputes?
We believe in a fair and secure marketplace. Standard disputes due to honest technical mistakes are resolved with no penalties. However, bad-faith disputes (scamming or lying about delivery) damage the entire network. The 25% Intended Harm Penalty acts as an economic deterrent to keep fraud rates close to zero.

### Q3: How do I increase my transaction and withdrawal limits?
Your account limit is determined by your KYC Verification level (None: £0, Basic: £500, Full: £100,000). To request a higher custom limit:
1. Navigate to your billing profile.
2. Submit an "Increase Limit Request".
3. Our compliance engine will review your **Trust Score** (derived from 30+ days of dispute-free transaction volume, high customer review ratings, and clean ledger logs) and issue a decision within 24 hours.

### Q4: Are my bank details safe on Velum?
Yes, absolutely. By using advanced bank tokenization, your sensitive financial routing information never touches our primary database. If our database is ever compromised, there are zero raw card numbers or bank account PINs stored within it.
