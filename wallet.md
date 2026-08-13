# Wallet & Banking V2 Optimization Plan

This document outlines the architectural plan to optimize the V2 wallet, banking, and currency conversion systems. We will use the V1 design patterns to restore complete auditability, live CLI administration, dynamic UI layouts, and wipe resilience to V2.

---

## Phase 1: Database Schema & Seeding (Completed)
- **12 Currencies:** Added `CAD`, `AUD`, `CHF`, `SGD`, and `HKD` currencies.
- **`exchange_rates` Database Table:** Created Drizzle schema table for `exchange_rates` and seeded all 132 permutations dynamically.
- **Institutional Reserves Consolidation:** Auto-migrated old duplicate reserve tables (`CLEARING`, `TREASURY`, `ESCROW`) to space-separated names (`VELUM CENTRAL BANK`, `SENTRY BANK`, `VELUM TRADING ACCOUNT`).

## Phase 2: Currency Converter & Exchange Logic (Completed)
- **Database Caching:** Loaded rates from Postgres `exchange_rates` table on startup.
- **Platform Spread Swap Fees:** Implemented custom 3% (VLM) / 4% (other fiat) exchange conversion fee.
- **Double-Entry Ledger Log:** Logged withdrawal and deposit transaction entries linked by a shared transaction reference ID (`exc_${generateRandomToken(12).toLowerCase()}`).

## Phase 3: CLI Administrative Controls & Card Limits (Not Started)
- **Dynamic Rate Updates:** Re-enable the `/sys/rate <base> <quote> <rate>` CLI command.
- **Card Limit Adjustments:** Implement `/cards/cardad <token_or_tier> <limit_cents>` CLI command.
- **Reserve Balance Adjustments:** Implement `/bank/bankad <account_id> <amount_cents> <reason>` CLI command.

## Phase 4: Dynamic Wallet Interface & Geolocation (Not Started)
- **Dynamic Box 2 (Primary Fiat):** Render the user's active geolocated `preferredFiat` currency.
- **Dynamic Box 3 (Secondary Fiat):** Render the first non-preferred fiat wallet with balance > 0.
- **Consolidated Balance Bridging:** Sum all 12 currencies dynamically in the UI.
- **Geolocation-Based Currency Assignment:** Geolocation IP currency assignment on sign-up.

## Phase 5: Interbank Funding Flow & Reserve Signs Correction (Not Started)
- **Reserve Flow Sign Correction:** 
  - **Recharge (Velum Credit Card):** Backed by VCB. Deducts VCB (`-amount`) -> Credits User Wallet (`+amount`). Matches user currency deposits are free.
  - **Recharge (Regular Credit/Debit/Bank):** Backed by Sentry Bank. Deducts Sentry Bank (`-amount`) -> Credits User Wallet (`+amount`). Matches user currency deposits are free.
  - **Recharge (Cross-Currency):** Charges standard 3% (VLM) / 4% (fiat) swap fees.
  - **Withdrawal (Debit/Bank Card):** Deducts User Wallet (`-amount`) -> Credits Sentry Bank (`+amount`). Charges **1.5% withdrawal fee** retained by Sentry Bank reserve.
- **CLI Interbank Funding & Reserve Rules:**
  - Only `fundc` (to `VELUM CENTRAL BANK`) mints money.
  - `fundt` and `funde` verify VCB liquidity, **deduct from VCB**, and credit `SENTRY BANK` / `VELUM TRADING ACCOUNT` respectively.
  - Set default interest rates: regular credit cards at **`7.5%`**, Velum credit cards at **`5.0%`**. Escrow fees remain in `VELUM TRADING ACCOUNT`.

## Phase 6: Database Ledger Healing & Reconciliation Script (Not Started)
- **Reconciliation Engine:** Create a script `server/v2/services/reconciler.ts` to audit the `transactions` table, recalculate true user balances, delete empty ghost wallets, and correct system reserves.

## Phase 7: Admin Dashboard Accounts & Currency Conversions (Not Started)
- **System Bank Visibility:** Include the three reserves (`VELUM CENTRAL BANK`, `SENTRY BANK`, `VELUM TRADING ACCOUNT`) in `/v2/bank/accounts`.
- **Consolidated Liquidity Base Conversion:** Convert all account balances to USD using `CurrencyConverter` before summing, preventing direct non-base currency addition in `AdminBank.tsx`.

## Phase 8: Cryptographical Ledger Signatures & Bot Injection Defense (Not Started)
- **Integrity Columns:** Add `signature` columns to `wallets` and `transactions` tables.
- **HMAC Verification:** Calculate HMAC-SHA256 on every balance change and transaction creation.
- **Intrusion Audit Daemon:** Audit daemon that freezes tampered accounts and alerts the admin logs panel upon signature validation failure.
