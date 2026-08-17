## 2026-08-15T01:30:18Z

You are E2E Test Challenger 1 (Gen 2) for Velum.
Your working directory is `/root/velum/.agents/e2e_challenger_1_gen2/`.
You MUST read `/root/velum/.agents/ORIGINAL_REQUEST.md`, `/root/velum/PROJECT.md`, and `/root/velum/TEST_INFRA.md` before starting.

Scope: Adversarial stress testing of the E2E test suite in `tests/e2e/`:
1. Check if tests are flaky, have timing race conditions, or unhandled promise rejections.
2. Check if mutating key assertions causes tests to properly fail (mutation testing check).
3. Execute `npx vitest run tests/e2e/`.
4. Determine verdict: APPROVE or REQUEST_CHANGES.
5. Write your handoff report to `/root/velum/.agents/e2e_challenger_1_gen2/handoff.md`.
6. Send a message to your parent with your verdict and report path.
