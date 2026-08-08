# Velum Architectural Refinement & Feature Restoration Plan

## Overview
This document outlines the systematic, multi-phase plan to address all structural, behavioral, security, and UI/UX issues across Velum Lounge, Chat, Admin systems, and Responsive Layouts, adhering strictly to the Velum Master Agent Protocol (`docs/AGENTS.md`).

---

## Phase 1: System Admin Roles & Lounge Access Control Infrastructure
- **System Admin Identification**: Ensure system admins (e.g. `Lexie`, `Midnight`) are properly recognized with system-level roles (`ADMIN`, `BANK_ADMIN`, etc.) in session payloads and backend checks.
- **Velum Official Lounge Boundaries**:
  - Restrict Velum Lounge sub-lounge creation: System-owned lounge managed strictly by System Admins (`Lexie` & `Midnight`). Completely disable sub-lounge creation UI and return `403 Forbidden` on backend endpoints if non-system admin attempts creation in Velum Lounge.
  - Sub-lounge Capacity & Visibility: Exactly 10 sub-lounges total (8 public/visible to all users, 2 locked/hidden for System & Support Admins only).
  - Deterministic Ordering: Enforce strict deterministic sorting (by `order_index` or fixed priority slug) on Velum sub-lounges so they never shift randomly across renders.
- **User-Created Lounge Privileges**:
  - Allow higher sub-lounge capacity for user-created lounges.
  - Fix Auto-Promotion Bug: When lounge creators add users, default their role strictly to `member` (never auto-promote to `admin`).
  - Privacy Boundaries: Non-members cannot view member lists, private rooms, or message contents — only the public "About / Join" preview card. Hide `+` create sub-lounge buttons from non-members/non-admins.

---

## Phase 2: Lounge & Room Management, Deletion & Avatar Uploads
- **Lounge & Sub-lounge Deletion**:
  - Implement full backend and UI deletion flow for individual sub-lounges and parent lounges (with complete cascading deletion of messages, members, and invites).
- **Lounge Avatar Upload**:
  - Unify lounge icon/avatar upload logic to match the user avatar upload system (file selection, image validation, preview, and server-side/state persistence).

---

## Phase 3: Interactive Search, User Actions & Profile Drawer
- **Functional Lounge Search**:
  - Fix dead-code search bar: connect backend/frontend filtering to search public lounges by title, description, or slug.
- **User Actions Execution**:
  - Implement functional handlers for Block, Mute, and Report actions in user profile cards.
- **Animated Lounge Settings Overlay**:
  - Extract Lounge Settings into a clean custom hook (`useLoungeSettings`) and smooth full-height overlay transition over the workspace.

---

## Phase 4: Chat Area UX, Instant Messaging & Textarea Flow
- **Optimistic Instant Messaging**:
  - Implement client-side optimistic message insertion in both lounge channels and direct messages so sending messages feels instantaneous without lag.
- **Chat Layout & Spacing Overhaul**:
  - Eliminate dead void space, optimize paddings, update message item cards, and improve typography density.
  - Auto-growing composer textarea with max-height scrolling for long pasted text.
- **Clean Human Copy**:
  - Remove all tech-larping jargon ("nodes", "cyber", "daemons", etc.) and generic placeholder text; replace with humble, clean, human-readable labels.

---

## Phase 5: Mobile-First Touch Experience & App-Native Feel
- **Mobile-First Responsive Layout**:
  - Optimize drawers, sidebars, navigation tabs, and touch targets (>=44px) for mobile-first, followed by tablet and desktop views.
- **Native App Touch Callouts**:
  - Disable default web text selection callouts (`-webkit-touch-callout: none; user-select: none;`) across UI controls and cards while retaining text selection inside chat message content.

---

## Phase 6: System Integrity & Self-Healing Diagnostic Engine
- **Velum Self-Healing Script**:
  - Create an automated diagnostic engine (`npm run heal` / `server/self-healing.ts`) that validates DB tables, fixes orphaned room/member references, repairs missing default sub-lounges, and verifies role integrity automatically.

---

## Authorization & Next Steps
Per `docs/AGENTS.md` Section III & IV:
- Code modifications are paused in the Brainstorming/Planning phase.
- To begin execution, please provide one of the explicit authorization triggers:
  - `start working`
  - `implement phase 1`
  - `execute plan`
