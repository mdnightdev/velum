# VELUM REFINEMENT & DIAGNOSTICS ARCHITECTURE PLAN

## Overview
This document tracks the technical design decisions for Settings Drawer repolishing, About page simplification, Diagnostic log collection & admin inspection, i18n translation strategy, and Appearance settings cleanup.

---

## Phase 1: About Page Simplification & Version Scope Lock
- **About Page UI**: Revert to clean, minimal layout (Velum logo mark, uppercase brand header, "Secure conversations, refined.", static base version `2.1.51`, copyright notice). Remove progress build stream box.
- **Global Version Purge**: Remove version indicators from:
  - `UserSidebar.tsx` (sub-header under Velum logo)
  - `SettingsDrawer.tsx` (bottom-right watermark)
  - Any remaining sidebar / footer components.
- **Version Reference**: Version `2.1.51` remains exclusively within the About tab.

---

## Phase 2: Settings Drawer Clean Architecture & Repolish
- Remove all grey explanatory sub-text, redundant subheadings, "LIVE PREVIEW" badges, and decorative pseudo-labels across all Settings views.
- Clean inputs, cards, and buttons: high-contrast labels, tight padding (`px-3 py-2 bg-velum-750 border-velum-600`), and clean hover/focus rings without filler.

---

## Phase 5: Appearance Tab Direct Clean-up
- Remove all dead code, non-functional light mode toggles, and grey descriptive paragraphs.
- Keep strictly functional, working state controls:
  - **Message Density**: Cozy / Compact
  - **Font Scale**: Small / Medium / Large
- Eliminate all filler cards, "Enforced" badges, and non-functional toggles.

---

## Execution Phases
- **Phase 1**: About Page & Version Lock
- **Phase 2**: Settings Repolish & Appearance Cleanup
- **Phase 3**: Diagnostic Log Pipeline (Client, API, Admin, CLI)
- **Phase 4**: Language / i18n Engine
