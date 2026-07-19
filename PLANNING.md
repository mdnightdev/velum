# Implementation Plan - Master Velum Lounge Architecture (velumlounge.md Spec)

Based on `velumlounge.md`, this plan details the single master lounge architecture with 10 sub-lounges, granular access levels (`ALL`, `ANNOUNCE`, `EXEC_ONLY`), user input locking, and admin management layout.

## Phase 1: Database Blueprint & Seeding (`server/db/index.ts` & `server/controllers/lounges.ts`)
1. **Master Lounge Seed**:
   * Master lounge: `velum_lounge` (`is_system_default: true`).
2. **SubLounge Access Matrix**:
   * **Channels 1-8 (`access_level: 'ALL'`)**:
     * `velum_general` (`# general`)
     * `velum_offtopic` (`# off-topic`)
     * `velum_support` (`# support`)
     * `velum_marketplace` (`# marketplace`)
     * `velum_trading` (`# trading-desk`)
     * `velum_alerts` (`# security-alerts`)
     * `velum_operations` (`# operations`)
     * `velum_sandbox` (`# sandbox`)
   * **Channel 9 (`access_level: 'ANNOUNCE'`)**:
     * `velum_announcements` (`# announcements`) - Public read-only for users; writeable by Admins.
   * **Channel 10 (`access_level: 'EXEC_ONLY'`)**:
     * `velum_executives` (`# executives`) - Private admin chat, hidden from regular users.

## Phase 2: User API & Input Enforcement (`server/controllers/lounges.ts` & `src/components/ChatArea.tsx`)
1. **User Fetch Query (`getUserLounges`)**:
   * Filters sublounges for regular users to include ONLY `access_level: 'ALL'` and `'ANNOUNCE'` (exactly 9 sublounges).
2. **User Chat Input Lock (`ChatArea.tsx`)**:
   * If regular user is in Channel 9 (`access_level: 'ANNOUNCE'`), disable message input and display `🔒 Only Admins can broadcast announcements here.`
3. **Executive Badges on Messages**:
   * Enhance `Message` payload to include `user_role` / `is_staff` flag so public messages sent by Executives display a distinct `[Staff]` or `[Executive]` badge.

## Phase 3: Admin Workspace Integration (`src/components/AdminPanel.tsx` & `admin.controller.ts`)
1. **Admin Fetch Query (`getAdminLounges`)**:
   * Admins fetch all 10 sublounges unconditionally.
2. **Admin Navigation Sections**:
   * Split sublounges in Admin sidebar into:
     * **Public Channels Monitoring**: Channels 1–9.
     * **Management Only**: Channel 10 (`#executives`).
3. **Unlocked Admin Inputs**:
   * Admin input bars are unlocked across all 10 sublounges.
