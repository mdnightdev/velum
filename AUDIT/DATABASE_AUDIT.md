# Velum Server Files & Database Audit Report

**Audit Date**: 2026-07-17  
**Auditor**: Professional Data Analyst  
**Scope**: Server architecture, database design, security implementation, and operational practices

---

## I. DATABASE ARCHITECTURE ANALYSIS

### Storage Layer
**Hybrid approach with SQLite (relational) + encrypted JSON fallback**

- **Primary**: SQLite database (`data/velum_db.sqlite`) with 40+ relational tables
- **Legacy fallback**: Encrypted JSON binary (`data/velum_state_v3.bin`)
- **Cloud backup**: Neon PostgreSQL integration for disaster recovery

### Schema Structure
**Domain-driven design with clear separation**

#### Core Identity
- users, profiles, sessions, devices, ip_addresses

#### Social Graph
- messages, user_blocks, user_mutes, friend_requests, peer_relationships

#### Security Events
- admin_sanctions, suspicious_events, recovery_events, audit_logs

#### Community System
- lounges, lounge_rooms, lounge_members, lounge_invites, lounge_sanctions

#### Marketplace
- market_listings, escrow_transactions, market_reviews, market_coupons

#### Financial
- bank_accounts, bank_transactions, user_wallets, wallet_ledger_entries, recharge_requests

### Schema Migration Strategy
**Progressive ALTER TABLE approach**

- Extensive use of `ALTER TABLE ADD COLUMN` with try-catch blocks for backward compatibility
- Index creation for performance optimization (idx_lounges_owner, idx_market_listings_seller, etc.)
- Closure table pattern for hierarchical node structures (node_closure)

---

## II. SECURITY IMPLEMENTATION AUDIT

### Cryptographic Standards
**Strong modern cryptography**

- **Password Hashing**: Argon2id (OWASP ASVS v4.0 compliant)
  - Memory: 15MiB, Iterations: 3, Parallelism: 1
- **Data Encryption**: AES-256-GCM with randomized IV per encryption
- **Key Management**: Scrypt-based key derivation with environment variable + file fallback
- **Session Tokens**: SHA-256 hashed session IDs with 7-day expiration

### Authentication Flow
**Multi-layered security**

- **Challenge-Response**: Single-use nonce system (90-second TTL) preventing replay attacks
- **Rate Limiting**: IP-based and username-based progressive backoff (30s → 2m → 10m → 30m)
- **Session Management**: 30-minute idle timeout with sliding window
- **Device Fingerprinting**: Tracking trusted devices and IP addresses for anomaly detection

### Security Headers
**Comprehensive web security**

- CSP: `'self'` script execution with WebSocket support
- HSTS: 1-year preload configuration
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

### Panic Protocol
**Duress code implementation**

- Separate panic_phrase_hash for emergency triggers
- SQL WAL cascade deletion on panic activation
- Automatic support ticket generation for compromised accounts

---

## III. DATA PERSISTENCE & ENCRYPTION AUDIT

### Encryption Architecture
**Dual-key system with legacy fallback**

- **Primary Key**: Environment variable `DB_ENCRYPTION_KEY` + `DB_ENCRYPTION_SALT`
- **Fallback Key**: File-based `.key` storage in `data/` directory
- **Legacy Support**: Multiple decryption attempts for migration compatibility
- **Cache Management**: LRU cache (5000 entries) for encryption/decryption operations

### Persistence Strategy
**Write-through caching**

- **In-Memory**: Primary database object (`db`) for fast access
- **SQLite**: Relational persistence with encrypted payload columns
- **Cloud Backup**: Automated gzip-compressed PostgreSQL backups (60-second cooldown)
- **Fallback Chain**: SQLite → Legacy JSON → Default schema

### Data Integrity
**Multiple validation layers**

- Schema validation on load with error handling
- Automatic balance reconstruction from transaction history
- Orphaned record cleanup during migration
- Audit log proxy for change tracking

---

## IV. API ARCHITECTURE AUDIT

### Route Organization
**Modular Express router structure**

- `/api/auth/*`: Authentication, registration, recovery
- `/api/bank/*`: Administrative banking operations (admin-only)
- `/api/marketplace/*`: E-commerce functionality
- `/api/lounges/*`: Community management
- `/api/tickets/*`: Support ticket system

### Middleware Stack
**Layered security approach**

- `securityHeaders`: CSP, HSTS, XSS protection
- `fileProtection`: Directory traversal prevention
- `authRateLimiter`: Brute force protection
- `authenticateUser`: Session validation
- `authenticateAdmin`: Role-based access control

### Controller Pattern
**Clean separation of concerns**

- Controllers handle HTTP request/response
- Services contain business logic
- Repositories manage data access
- Utilities provide common functions

---

## V. BANKING & FINANCIAL SYSTEMS AUDIT

### Bank Store Architecture
**Isolated financial module**

- **Mutex Concurrency**: Mutex-protected financial operations
- **Redis Integration**: Optional Redis backend with local fallback
- **Account Types**: Member trust, Central reserve, Escrow holdings
- **Transaction Types**: Deposit, withdrawal, escrow hold/release

### Security Measures
**Financial-grade protection**

- Encrypted account numbers and routing numbers
- Automatic balance reconciliation from transaction history
- Admin-only access to banking operations
- Comprehensive transaction logging

### Escrow System
**Secure marketplace transactions**

- Multi-state transaction workflow
- Platform fee calculation
- Coupon and SKU variant support
- Dispute resolution tracking

---

## VI. BACKUP & RECOVERY AUDIT

### Cloud Backup Strategy
**PostgreSQL-based disaster recovery**

- **Compression**: Gzip compression for bandwidth optimization
- **Cooldown**: 60-second minimum between backups
- **Failure Handling**: Automatic disable on connection failure
- **Startup Restore**: Asynchronous cloud restore on server startup

### Recovery Mechanisms
**Multiple recovery pathways**

- **Standard**: Safe word + recovery key + new password
- **Safeword**: Safe word only (requires admin approval)
- **Restore Code**: One-time codes from support tickets
- **Panic**: Emergency phrase with data destruction

---

## VII. CRITICAL SECURITY CONCERNS

### High Priority Issues

1. **SQLite File Permissions**
   - **Issue**: `fs.chmodSync(SQLITE_FILE, 0o777)` sets world-writable permissions
   - **Location**: `server/db/index.ts:98`
   - **Risk**: Any system user can modify database file
   - **Recommendation**: Use `0o600` for owner-only access

2. **Hardcoded Bank Details**
   - **Issue**: Taiwan Cooperative Bank details in seed function
   - **Location**: `server/services/bankStore.ts:96`
   - **Risk**: Operational inflexibility, potential confusion
   - **Recommendation**: Move to configuration file

3. **Fallback Security**
   - **Issue**: Ephemeral nonce cache when SQLite unavailable
   - **Location**: `server/db.ts:207-210`
   - **Risk**: Reduced replay protection during database outages
   - **Recommendation**: Reject authentication during database failures

4. **Environment Variable Exposure**
   - **Issue**: Admin credentials in environment variables
   - **Location**: `server/db/schema.ts:81-116`
   - **Risk**: Process environment exposure to debugging tools
   - **Recommendation**: Use proper secrets management system

### Medium Priority Issues

1. **Schema Drift**
   - **Issue**: Extensive ALTER TABLE usage indicates poor migration planning
   - **Location**: Multiple files in `server/db/index.ts`
   - **Risk**: Schema inconsistency, difficult rollbacks
   - **Recommendation**: Implement proper migration system

2. **Cache Size**
   - **Issue**: Unlimited cache growth potential in rate limiter
   - **Location**: `server/middlewares/auth.ts:5-38`
   - **Risk**: Memory exhaustion under attack
   - **Recommendation**: Implement cache size limits

3. **Error Handling**
   - **Issue**: Some try-catch blocks swallow errors without logging
   - **Location**: Various files
   - **Risk**: Silent failures, difficult debugging
   - **Recommendation**: Implement comprehensive error logging

4. **Type Safety**
   - **Issue**: Extensive use of `any` types throughout codebase
   - **Location**: Multiple files
   - **Risk**: Runtime errors, reduced IDE support
   - **Recommendation**: Replace with proper TypeScript interfaces

### Low Priority Issues

1. **Code Duplication**
   - **Issue**: Similar nonce generation in multiple files
   - **Location**: `server/crypto.ts` and `server/db.ts`
   - **Risk**: Maintenance burden, potential inconsistencies
   - **Recommendation**: Consolidate to single utility

2. **Legacy Code**
   - **Issue**: Deprecated lounge_rooms table still maintained
   - **Location**: `server/db/index.ts:229-238`
   - **Risk**: Code complexity, storage overhead
   - **Recommendation**: Plan deprecation migration

3. **Documentation**
   - **Issue**: Limited inline comments for complex logic
   - **Location**: Various files
   - **Risk**: Difficult onboarding, knowledge loss
   - **Recommendation**: Add comprehensive code documentation

---

## VIII. PERFORMANCE CONSIDERATIONS

### Database Optimization
- Comprehensive indexing strategy for common queries
- Closure table pattern for hierarchical data
- Connection pooling for PostgreSQL
- In-memory caching for encryption operations

### Potential Bottlenecks
- Full database loads on startup
- Synchronous database writes
- Large transaction history calculations
- Cloud backup compression overhead

---

## IX. COMPLIANCE & REGULATORY

### Data Protection
- GDPR-like right to be forgotten (account deletion requests)
- Audit logging for administrative actions
- Data encryption at rest and in transit
- Geographic location tracking for compliance

### Financial Regulations
- KYC verification framework
- Transaction logging for audit trails
- Escrow hold/release workflow
- Platform fee tracking

---

## X. RECOMMENDATIONS

### Immediate Actions
1. Remove `0o777` file permissions, use `0o600` for database files
2. Implement proper secrets management for admin credentials
3. Add database connection pooling for SQLite
4. Restrict fallback nonce cache usage

### Short-term Improvements
1. Implement proper migration system (like Knex.js or TypeScript migrations)
2. Add comprehensive error logging and monitoring
3. Replace `any` types with proper TypeScript interfaces
4. Implement rate limiting on a per-endpoint basis

### Long-term Architecture
1. Consider microservices architecture for banking module
2. Implement event sourcing for audit trails
3. Add comprehensive integration test suite
4. Implement proper secrets rotation policy

---

## XI. OVERALL ASSESSMENT

The Velum system demonstrates **strong security fundamentals** with modern cryptographic practices including Argon2id password hashing, AES-256-GCM encryption, and comprehensive session management. The hybrid database architecture provides good resilience with multiple fallback mechanisms.

However, the system requires **operational hardening** around:
- File permissions and access controls
- Secrets management and credential handling
- Database migration practices
- Type safety and error handling

The banking and financial modules show good security consciousness with mutex protection and audit trails, but would benefit from dedicated microservices architecture as the system scales.

**Security Rating**: B+ (Strong cryptography, needs operational hardening)  
**Architecture Rating**: B- (Good domain design, needs migration strategy)  
**Compliance Rating**: B (Good foundation, needs formal validation)

---

## XII. AUDIT METADATA

**Files Analyzed**: 25+ TypeScript files  
**Database Tables**: 40+ relational tables  
**Security Mechanisms**: 12+ distinct security layers  
**Cryptographic Algorithms**: Argon2id, AES-256-GCM, SHA-256, Scrypt  
**Backup Systems**: 3-tier (SQLite, JSON, PostgreSQL)

**Key Personnel**: System Architect, Principal Engineer  
**Next Audit Recommended**: 2026-10-17 (90-day cycle)