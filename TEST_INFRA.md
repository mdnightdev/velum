# E2E Test Infra: Velum E2EE Migration to @signalapp/libsignal-client

## Test Philosophy
- **Opaque-box & Requirement-driven**: Tests derive strictly from user requirements in `ORIGINAL_REQUEST.md`, testing observable cryptographic and messaging behaviors without depending on private implementation details.
- **Methodology**: Systematic 4-tier testing hierarchy utilizing Category-Partition, Boundary Value Analysis (BVA), Pairwise Combinatorial Testing, and Realistic Workload Simulations.

## Feature Inventory & Tier Mapping
| # | Feature | Source (Requirement) | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Real-World) |
|---|---------|----------------------|:----------------:|:-----------------:|:----------------------:|:-------------------:|
| 1 | Identity Generation & Registration ID | ORIGINAL_REQUEST §R2, §R3 | 5 tests | 5 tests | ✓ | ✓ |
| 2 | Prekey & Bundle Management | ORIGINAL_REQUEST §R2, §R3 | 5 tests | 5 tests | ✓ | ✓ |
| 3 | X3DH Session Building | ORIGINAL_REQUEST §R3, §R4 | 5 tests | 5 tests | ✓ | ✓ |
| 4 | Message Encryption & Decryption | ORIGINAL_REQUEST §R4, §R5 | 5 tests | 5 tests | ✓ | ✓ |
| 5 | Media & Attachment Encryption | ORIGINAL_REQUEST §R4, §R5 | 5 tests | 5 tests | ✓ | ✓ |
| 6 | Offline Outbox & Queueing | ORIGINAL_REQUEST §R4, §R5 | 5 tests | 5 tests | ✓ | ✓ |
| 7 | Session Healing & Desync Handling | ORIGINAL_REQUEST §R4, §R5 | 5 tests | 5 tests | ✓ | ✓ |

## Test Architecture
- **Test Runner**: Vitest (`npx vitest run tests/e2e/e2ee-protocol-tiers.test.ts` or `npm run test:e2e`).
- **Environment**: Node / jsdom environment with Web Crypto (`crypto.subtle`) and IndexedDB polyfills (`fake-indexeddb` / `idb` mock / memory store).
- **Pass/Fail Semantics**: Exit code 0 on 100% assertions passing with zero unhandled promise rejections.
- **Directory Layout**:
  - `tests/e2e/e2ee-protocol-tiers.test.ts`: Complete Tier 1, 2, 3, 4 test suites structured by feature areas and scenarios.
  - `tests/e2e/e2ee-signal.test.ts`: High-level multi-turn conversation and integration test harness.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Multi-turn Bidirectional Conversation | Identity, Bundles, X3DH, Continuous Ratchet, Decryption | High |
| 2 | Mixed Media (Text + Voice Notes + Attachments) | Attachments, Encryption Pipeline, Large Payloads | High |
| 3 | Intermittent Offline Outbox Reconnect | Outbox Queueing, Reconnect Draining, Ratchet Sync | High |
| 4 | Asynchronous Out-of-Order Message Delivery | Skipped Keys, Session Store, Out-of-Order Delivery | High |
| 5 | Cross-Device & Session Reset Recovery | Storage Purge, Prekey Re-publish, Auto-healing | High |

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: ≥ 35 test cases (≥5 per feature across 7 features)
- **Tier 2 (Boundary & Corner Cases)**: ≥ 35 test cases (≥5 per feature across 7 features)
- **Tier 3 (Cross-Feature Combinations)**: ≥ 10 test cases (pairwise ratchet, out-of-order, outbox)
- **Tier 4 (Real-World Application Scenarios)**: ≥ 5 multi-turn realistic workload simulations
- **Total Minimum Target**: ≥ 85 test cases
