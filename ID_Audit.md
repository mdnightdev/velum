

---

```
You are auditing a TypeScript + Node.js application to understand exactly how IDs are generated, stored, and used across the entire system. Produce a detailed, structured report.

**Scope**
- All entity IDs: user IDs, lounge IDs, transaction IDs, escrow IDs, and any other identifiable entities (orders, payments, sessions, etc.).
- Primary keys, external/public IDs, composite keys, and any custom ID formats.
- The full lifecycle: generation strategy, storage (column types, constraints), propagation through services, serialization in APIs, and cross-references between entities.

**What to examine**
1. **Database schema and migrations** – look at migration files, ORM model definitions (TypeORM, Prisma, Knex, Drizzle, etc.), raw SQL schema files, and any seed scripts.
2. **ID generation code** – find any utility functions, libraries (uuid, nanoid, crypto.randomUUID, custom generators), decorators, base entity classes, or default values in model definitions.
3. **How IDs are created on insertion** – check if IDs are generated application-side or database-side (auto-increment, UUID defaults, triggers, sequences).
4. **How IDs flow between layers** – services that create entities, controllers that return IDs, middleware that attaches IDs, and any transformations (e.g., hashing, encoding).
5. **Foreign key relationships** – how IDs are used to reference other entities, cascade rules, and whether the referenced ID type matches the definition.
6. **External exposure** – which IDs are sent to clients, used in URLs, stored in tokens, or logged. Note any sensitive exposure risks.
7. **Uniqueness guarantees and collisions** – indexes, constraints, sequences, and any potential for duplicate or predictable IDs.
8. **Environment-specific or conditional ID logic** – any branching based on environment, multi-tenancy, sharding, etc.

**Report format**
Produce a markdown report with these sections:

- **Summary**: high-level overview of the ID landscape.
- **Entity-by-entity breakdown**: for each entity type (user, lounge, transaction, escrow, ...), provide:
  - Table/collection name
  - ID column name(s)
  - Generation strategy (e.g., UUIDv4 generated in app, auto-increment bigint, prefixed nanoid)
  - Where the ID is generated (file and line references)
  - Database column type and constraints (from schema/migrations)
  - How it's exposed externally (API field name, URL parameter, etc.)
  - Cross-references (which tables hold this ID as a foreign key)
  - Any inconsistencies or risks (e.g., mismatched types, missing indexes, potential for collision)
- **Global patterns and utilities**: any shared ID module, base entity, or generator function.
- **Issues and recommendations**: list of problems found (e.g., using auto-increment as external ID, missing unique constraints, non-normalized reference) and actionable suggestions.

**Method**
1. Start by identifying the ORM/database tooling (Prisma schema, TypeORM entities, Knex migrations, etc.).
2. Globally search for keywords: `id`, `uuid`, `nanoid`, `crypto.randomUUID`, `@PrimaryGeneratedColumn`, `default(uuid`, `uuid_generate`, `serial`, `bigserial`, `varchar.*primary key`, `ObjectId`, `prefix`, `generateId`, etc.
3. Trace each entity ID from definition through creation, storage, and consumption.
4. Cross-reference types between models to spot mismatches.

Write the report as a markdown artifact. Be thorough, include file paths, and cite line numbers where possible. If you cannot find certain information, clearly state what is missing and why.
```
