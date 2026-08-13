# VELUM RECOVERY & DURESS PIPELINE RECTIFICATION PLAN

## Root Cause Analysis
1. **Panic Phrase Hash Mismatch on Registration vs Login**:
   - During registration, `panicPhrase` is pre-hashed on the client using SHA-256 (`salt + panicPhrase`), then Argon2id-hashed on the server.
   - During login, entering the panic phrase into the password field sends the raw string. `verifyInputHash` was attempting multi-format comparisons, but missing direct SHA256 pre-hash matching against raw input in Argon2id verification.
2. **Duress Trigger Behavior & Compromised Account Isolation**:
   - When a user triggers duress, `executePanicCascade` marks the account as `isCompromised = true`, purges all active sessions, and generates a support ticket.
   - However, when the user subsequently attempted to log in with their authentic password, the login handler was not preventing normal workspace session creation if `isCompromised` was checked after credential validation.
3. **Admin Dashboard Ticket Synchronization**:
   - The admin tickets route (`/v2/admin/tickets`) requires all fields (`ticket_id`, `tracking_id`, `credibility_score`, `messages`) to align with the frontend Admin Desk interface so new tickets appear immediately upon creation.

---

## Implementation Phases

### Phase 1: Duress & Panic Phrase Matching Rectification
- Update `verifyInputHash` in `server/v2/services/duress/duressAuth.ts` to compute client SHA-256 hash (`SHA256(salt + input)`) and verify it against `storedHash` via Argon2id.
- Ensure `checkDuressOnLogin` correctly triggers `executePanicCascade` when panic phrase is provided in the password field.

### Phase 2: Compromised Account Session Gate & Stealth Quarantine
- Ensure `authController.login` checks `duressResult.isCompromised` FIRST before attempting normal password validation.
- When an account is compromised, prevent session token generation and redirect the user directly to the Account Recovery / Ticket view with their active `ticketId`.

### Phase 3: Admin Ticket Desk Synchronization & Live Updates
- Ensure `/v2/admin/tickets` returns formatted ticket records including `id`, `ticket_id`, `tracking_id`, `username`, `credibilityScore`, `status`, and `messages`.
- Verify frontend Admin Desk ticket polling / event updates display all submitted duress and recovery tickets in real time.
