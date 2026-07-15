# Velum Monolith Refactor Plan

The audit is solid on *what's* wrong. This plan adds the missing piece: an order of
operations that won't break production, plus the guardrails specific to Velum's own
rules (server-side auth enforcement, zero placeholders, mandatory tests per AGENTS.md).

---

## 1. Priority Order (risk-weighted, not just line-count-weighted)

Line count is a bad prioritization signal on its own — `server/controllers/auth.ts`
and the encryption logic buried in `ChatArea.tsx` are higher risk than their line
counts suggest, because a mistake there is a security incident, not a UI bug.

| Order | File | Why this order |
|---|---|---|
| 1 | `server/controllers/auth.ts` | Security-critical. Smallest blast radius to test in isolation (auth has clear input/output contracts: credentials in, session out). Do this first while the codebase is least entangled. |
| 2 | `src/components/ChatArea.tsx` — encryption layer only | Extract *only* the encrypt/decrypt calls into a service first, before touching voice/file/UI concerns. This isolates the highest-risk logic (message confidentiality) with the smallest diff. |
| 3 | `server/db.ts` | Everything else depends on data access. Do this before the two frontend dashboards so their eventual hook refactors can call clean repositories instead of the old monolith. |
| 4 | `src/components/AdminPanel.tsx` | High blast radius (admin tooling touches bans/sanctions) but not cryptographic — safe to do after db.ts lands. |
| 5 | `src/components/SidebarTabs/MarketMainDashboard.tsx` | Money-adjacent (escrow, checkout) but not auth-adjacent — sequence after admin so the pattern is proven twice already. |
| 6 | `src/views/UserWorkspace/SettingsDrawer.tsx` — remaining pieces (image compression, UI tabs) | Lowest risk: mostly presentational and client-side-only utility code. |
| 7 | `ChatArea.tsx` remainder (voice, attachments, UI) | Do last — by now `useAudioRecorder`, sub-components, and hook patterns are established conventions elsewhere in the codebase, so this extraction has precedent to follow. |

---

## 2. Non-Negotiable Guardrails for Every Hotspot

Apply these to all six extractions, not just the security-sensitive ones:

* **No big-bang rewrites.** Extract one logical unit at a time (one hook, one
  sub-component, one repository) and ship it independently. A 2,800-line file becomes
  ten small PRs, not one large one.
* **Characterization tests before extraction, not after.** For files with no existing
  test coverage (likely `db.ts`, `auth.ts`), write tests that pin down *current*
  behavior first — including bugs. Refactor, then confirm identical behavior. Fix bugs
  in a separate, clearly-labeled follow-up change.
* **Parallel-run for auth and crypto.** For `auth.ts` and the `ChatArea.tsx` encryption
  layer specifically: run the new extracted code path alongside the old one behind a
  flag, diff outputs (token payloads, ciphertext/plaintext round-trips) in a staging
  environment before cutover. Do not cut over on code review alone.
* **No behavior changes bundled with structure changes.** If you spot a bug while
  extracting (e.g. the 8-second polling interval in `MarketMainDashboard.tsx` looks
  unnecessarily aggressive), file it separately. Mixing "move code" with "fix code"
  makes both hard to review and impossible to revert cleanly.
* **Server-side authorization survives the move.** Per Velum's own security principle,
  every protected endpoint must still enforce authorization server-side after
  `auth.ts` and `db.ts` are split — verify this explicitly in the repository-pattern
  extraction, since it's easy to accidentally push an authorization check into a layer
  that's only reachable after the check should've already happened.

---

## 3. Per-Hotspot Notes Beyond the Original Audit

**`server/controllers/auth.ts`**
Add a boundary test suite before extraction that specifically covers: expired-token
rejection, malformed JWT rejection, and MFA/OTP replay — these are the cases most
likely to silently break during a refactor and least likely to be caught by casual
manual testing.

**`ChatArea.tsx` (encryption)**
Before extracting to a shared service, confirm where encryption keys currently live in
memory/scope. A naive extraction can accidentally widen key exposure (e.g., a
service imported broadly ends up holding keys reachable from unrelated components).
Scope the new service's exports narrowly — encrypt/decrypt functions only, never the
raw key material.

**`server/db.ts`**
Migrate to the repository pattern table-by-table, not all at once. Land
`userRepository.ts` first (auth depends on it), verify, then `loungeRepository.ts` and
`ticketRepository.ts`. Keep the old `db.ts` functions as thin wrappers calling the new
repositories during the transition so nothing else in the codebase breaks mid-migration.

**`AdminPanel.tsx`**
Extract `AdminDiagnosticsView.tsx` (read-only: logs, metrics) before
`AdminUsersView.tsx` (mutating: bans, sanctions). Read-only extractions are lower risk
and validate the sub-component pattern before you touch anything that can sanction a
user.

**`MarketMainDashboard.tsx`**
Extract `EscrowTransactionCard.tsx` before `ListingCreatorModal.tsx`. Escrow release is
the one action here with irreversible financial consequences — get it into an isolated,
well-tested component early rather than leaving it entangled longest.

**`SettingsDrawer.tsx`**
The `computeClientHash` (SHA-256) utility should move alongside the auth work in
priority order, not with the rest of Settings — it's cryptographic, not presentational,
even though it lives in a settings file today.

---

## 4. Definition of Done (per extraction)

A hotspot extraction isn't complete until:

1. Old monolith function/section is deleted, not just duplicated (no dead code left
   "just in case").
2. New unit tests exist and pass, covering the behavior pinned down in step 2's
   characterization tests.
3. Existing test suite and lint pass with no new failures (per AGENTS.md Section IX).
4. For auth/crypto/escrow specifically: a second person (or a second isolated review
   pass) confirms the security-relevant invariants didn't shift.
