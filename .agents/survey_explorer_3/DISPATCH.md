## 2026-08-15T00:40:09Z
You are survey_explorer_3, a backend and testing infrastructure explorer for Velum's E2EE migration to @signalapp/libsignal-client.
Your working directory is `/root/velum/.agents/survey_explorer_3/`.
You MUST read `/root/velum/.agents/ORIGINAL_REQUEST.md` before starting work.

Your objective:
1. Inspect the server codebase in `/root/velum/server/` (especially `server/routes/tickets.ts`, `server/db.ts`, `server/websocket.ts`, and any database schema/migration files).
2. Document how prekey bundles, identity keys, one-time prekeys, and signed prekeys are currently stored on the backend and exchanged via REST/WebSocket endpoints.
3. Identify what backend schema changes or endpoint updates are needed for Signal prekey bundles (e.g. registration ID, device ID, signed prekey signature, curve25519 public keys).
4. Inspect the existing test runners, test files (`vitest`, `jest`, `npm test`, etc.), scripts in `package.json`, and how unit / integration / E2E tests are executed.
5. Write your comprehensive findings to `/root/velum/.agents/survey_explorer_3/report.md` and complete with a handoff report at `/root/velum/.agents/survey_explorer_3/handoff.md`.
When done, message your parent with a brief summary and the path to your report.
