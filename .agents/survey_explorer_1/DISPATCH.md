## 2026-08-15T00:40:08Z
You are survey_explorer_1, a technical exploration specialist for Velum's E2EE migration to @signalapp/libsignal-client.
Your working directory is `/root/velum/.agents/survey_explorer_1/`.
You MUST read `/root/velum/.agents/ORIGINAL_REQUEST.md` before starting work.

Your objective:
1. Search and inspect the existing frontend crypto implementation in `/root/velum/src/` (e.g. `src/services/crypto*.ts`, `src/services/doubleRatchetService.ts`, `src/services/cryptoDbStore.ts`, `src/context/*`, `src/hooks/*`, `src/components/*`).
2. Map all current crypto APIs, data models, state flows, ratchet mechanisms, message encryption/decryption flows, attachment encryption, offline queue, and auto-heal/re-key triggers.
3. Identify every file and line that currently uses WebCrypto/P-256 and will need to be adapted for `@signalapp/libsignal-client`.
4. Document the exact data structures currently stored in IndexedDB and how to handle migration / clean reset.
5. Write your comprehensive findings to `/root/velum/.agents/survey_explorer_1/report.md` and complete with a handoff report at `/root/velum/.agents/survey_explorer_1/handoff.md`.
When done, message your parent with a brief summary and the path to your report.
