
Recommendation A: Decouple Persistence and Implement Incremental Table Serialization
The current persistence engine in server/db/persistence.ts relies on bulk table serialization. We recommend splitting this into domain-specific repositories:
Proposed Structure:
server/db/repositories/userRepository.ts
server/db/repositories/loungeRepository.ts
server/db/repositories/marketRepository.ts
Implementation Benefit: Instead of writing the entire database memory state to disk on a single modification, maintain a dirty-flag map. Only serialize the dirty tables individually during the throttled commit window to reduce CPU overhead.
Recommendation B: Isolate Connection Lifecycle from Schema Definitions
Currently, server/db/index.ts contains schema shapes, memory variables, and connection initialization.
Proposed Structure: Extract SQLite/PostgreSQL connection handlers, connection state tracking, and schema migrations into a dedicated database driver provider, e.g., server/db/connection.ts.
Implementation Benefit: This cleanly isolates startup database operations from business-level queries and facilitates mock database injection during test phases.
Recommendation C: Enforce the Service-Repository-Controller Pattern
Thin out the thick controllers (e.g., server/controllers/payments.ts, server/controllers/auth.ts) by extracting business domain logic:
Proposed Structure:
Controllers: Handle HTTP request extraction, request payload schema validation, and HTTP response mapping.
Services: Manage transaction isolation, state validation, authorization policies, and mutation sequencing.
Repositories: Execute storage queries and abstract persistence details.
Implementation Benefit: Isolates the Express router/HTTP layer from the core application state, making domain workflows fully unit-testable without requiring simulated network payloads or running HTTP servers.
