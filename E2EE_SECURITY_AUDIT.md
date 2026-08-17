# E2EE Security Audit & Data Integrity Analysis

## Executive Summary

This document provides a comprehensive analysis of the End-to-End Encryption (E2EE) implementation in Velum, including security vulnerabilities and critical data integrity issues affecting message functionality.

---

## Part 1: Security Vulnerabilities

### CRITICAL SEVERITY (4)

#### 1. Hardcoded Encryption Key in XOR Fallback
**File:** `src/services/encryptionService.ts:21,49`  
**Severity:** CRITICAL

**Issue:**
```typescript
const keyBytes = encoder.encode(key || 'VELUM_KEY');
```

**Impact:** Lounge messages use a static, predictable key when no key is provided. Any attacker can decrypt these messages by XORing with "VELUM_KEY".

**Attack Scenario:** Attacker intercepts lounge messages → applies XOR with known string → trivial decryption.

**Remediation:** Remove hardcoded fallback, require explicit key provision, use proper KDF.

---

#### 2. Fake Signature Verification in X3DH
**File:** `src/services/doubleRatchetService.ts:173`  
**Severity:** CRITICAL

**Issue:**
```typescript
signedPrekeySignature: 'valid_sig_p256', // In production, use actual signature
```

**Impact:** X3DH authentication completely broken. No verification of prekey bundles.

**Attack Scenario:** MITM attacker injects malicious prekey bundles → establishes separate encryption keys with both parties → full message interception.

**Remediation:** Implement actual Ed25519 signatures, verify before accepting bundles, implement TOFU/web-of-trust.

---

#### 3. Debug Logging of Cryptographic Keys
**File:** `src/services/doubleRatchetService.ts:400-408, 533-541`  
**Severity:** CRITICAL

**Issue:**
```typescript
if (true) {
  const rawKeyBytes = await window.crypto.subtle.exportKey('raw', messageKey);
  console.log('[KEYDEBUG] ENCRYPT', {
    myUserId: this.localUserId,
    peerUserId,
    n: state.sendChainLength,
    keyHex: Array.from(new Uint8Array(rawKeyBytes)).map(b => b.toString(16).padStart(2, '0')).join('')
  });
}
```

**Impact:** Raw message keys logged to console, accessible via XSS or malicious extensions.

**Attack Scenario:** XSS/malicious extension reads console logs → extracts keys → decrypts all logged messages.

**Remediation:** Remove KEYDEBUG logging, use environment-based conditional logging.

---

#### 4. Weak Nonce Generation Using Math.random()
**File:** `src/hooks/useWebSocket.ts:537`  
**Severity:** CRITICAL

**Issue:**
```typescript
const nonce = `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
```

**Impact:** Predictable nonces using non-cryptographic random number generator.

**Attack Scenario:** Attacker observes patterns → predicts future nonces → enables replay/injection attacks.

**Remediation:** Use `crypto.getRandomValues()`, ensure 128-bit entropy, use UUID v4.

---

### HIGH SEVERITY (5)

#### 5. All Cryptographic Keys Marked as Extractable
**File:** `src/services/cryptoDbStore.ts:92-93, 172-173, 254`  
**Severity:** HIGH

**Issue:**
```typescript
privateKey: await subtle.importKey('jwk', kp.privateKey, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits'])
```

**Impact:** Private keys can be exported via Web Crypto API by any malicious code.

**Attack Scenario:** XSS vulnerability → export all private keys → decrypt all messages → impersonate user.

**Remediation:** Set `extractable: false` for private keys, use non-extractable keys for operations.

---

#### 6. Zero Salt in HKDF Key Derivation
**File:** `src/services/doubleRatchetService.ts:254, 317-320, 355, 364`  
**Severity:** HIGH

**Issue:**
```typescript
const salt = new Uint8Array(32);
const newRootKey = await this.hkdfBits(rootKey, zeros, 'DoubleRatchetRoot');
```

**Impact:** HKDF uses zero-filled salt buffers instead of random salts, weakening security.

**Attack Scenario:** Related-key attacks, cross-context key recovery, weakened forward secrecy.

**Remediation:** Use random salts, derive from DH shared secret, follow Signal specification.

---

#### 7. Predictable Dummy Salts for Username Enumeration
**File:** `server/v2/controllers/authController.ts:29-30, 51-52`  
**Severity:** HIGH

**Issue:**
```typescript
const dummySalt = crypto.createHash('sha256').update(queryName.toLowerCase() + '_salt_velum_dummy').digest('hex');
```

**Impact:** Deterministic dummy salts enable username enumeration.

**Attack Scenario:** Attacker determines registered vs unregistered usernames → builds target list → credential stuffing.

**Remediation:** Use random dummy salts, constant-time responses, rate limiting.

---

#### 8. XOR Encryption Used for Lounge Messages
**File:** `src/services/encryptionService.ts:17-61`  
**Severity:** HIGH

**Issue:** Simple XOR encryption instead of authenticated encryption for lounge messages.

**Impact:** No integrity protection, no authentication, malleable ciphertext.

**Attack Scenario:** Attacker obtains room key → modifies messages in transit → injects fake messages → undetectable tampering.

**Remediation:** Use AES-GCM or ChaCha20-Poly1305, implement authentication tags, extend Double Ratchet for groups.

---

#### 9. Fallback to Plaintext on Encryption Errors
**File:** `src/services/encryptionService.ts:74-76, 124-126`  
**Severity:** HIGH

**Issue:**
```typescript
} catch (err) {
  console.error('[encryptionService] Direct message encryption failed:', err);
  return content; // Fallback to plaintext on error
}
```

**Impact:** Silent security degradation without user awareness.

**Attack Scenario:** Attacker triggers encryption failures → forces plaintext transmission → bypasses encryption.

**Remediation:** Never fallback to plaintext, fail closed, notify user, proper error recovery.

---

### MEDIUM SEVERITY (4)

#### 10. Missing Key Binding to Authentication Session
**Impact:** Compromised session token allows use of stored keys without re-authentication.

**Remediation:** Bind key operations to session validity, re-derive from session secret, implement key expiration.

---

#### 11. Client-Side Password Confirmation via window.prompt
**File:** `src/views/UserWorkspace/SettingsDrawer.tsx:333`  
**Impact:** Poor UX and security for sensitive password operations.

**Remediation:** Use proper React component, consistent UI, password strength validation.

---

#### 12. Weak Random Number Generation in Non-Cryptographic Contexts
**Files:** 
- `src/hooks/useWebSocket.ts:492` (jitter)
- `server/v2/routes/adminRoutes.ts:116,240,242` (recovery keys)
- `server/v2/controllers/authController.ts:228` (recovery key)

**Impact:** Math.random() used for security-sensitive values reduces entropy.

**Remediation:** Use crypto.randomBytes() for all security-sensitive generation.

---

#### 13. Session Token Exposed in Multiple Headers
**Impact:** Session tokens sent in both `Authorization: Bearer` and `x-session-token` headers increases exposure.

**Remediation:** Use single header, consistent handling, consider HttpOnly Secure cookies.

---

### LOW SEVERITY (2)

#### 14. Using P-256 Instead of X25519
**File:** `src/services/doubleRatchetService.ts:125, 132, 141`  
**Impact:** Deviation from Signal Double Ratchet specification, potential implementation pitfalls.

**Remediation:** Migrate to X25519 or ensure constant-time operations, document deviation.

---

#### 15. No Key Rotation Mechanism for Long-Term Identity Keys
**Impact:** Compromised identity key affects all past/future communications.

**Remediation:** Implement periodic rotation, manual rotation option, graceful handling.

---

#### 16. IndexedDB Keys Stored Without Additional Encryption
**File:** `src/services/cryptoDbStore.ts`  
**Impact:** Keys accessible on compromised devices.

**Remediation:** Encrypt at rest with user-derived key, implement key wrapping, WebAuthn option.

---

### ARCHITECTURAL CONCERNS (2)

#### 17. Split Encryption Model (Double Ratchet vs XOR)
**Impact:** Security disparity between direct and lounge messages, user confusion.

**Remediation:** Unify encryption model, extend Double Ratchet for groups, document differences.

---

#### 18. No Forward Secrecy for Vault Key Rotation
**File:** `src/services/localVaultEncryption.ts:85-95`  
**Impact:** Data loss on key rotation while providing forward secrecy.

**Remediation:** Implement re-encryption during rotation, user notification, opt-in migration.

---

## Part 2: Data Integrity Issue (URGENT - Functionality Breaking)

### Problem Description

**Symptom:** Messages appear as encrypted text after app refresh. Receivers see "failed to decrypt" errors.

**Root Cause:** Non-blocking IndexedDB state persistence with race conditions.

### Technical Analysis

#### Location of Issue
**File:** `src/services/doubleRatchetService.ts`  
**Lines:** 395, 431

```typescript
saveConversationStateToDb(this.getLocalUserIdOrThrow(), peerUserId, state).catch(e => console.error(e));
```

#### Issue Breakdown

1. **Fire-and-Forget Saves:** Conversation state saves are initiated but not awaited
2. **No Completion Guarantee:** Encryption returns success before IndexedDB save completes
3. **Race Conditions:** Rapid messages can overwrite state before previous saves complete
4. **Incomplete State on Reload:** App refresh during save → loads old/incomplete state
5. **Lost Skipped Keys:** Skipped message keys not persisted (line 167)

#### Failure Scenario

```
User sends "HI"
→ Encryption updates state in memory
→ Initiates async IndexedDB save (non-blocking)
→ User refreshes app immediately
→ Save operation may not complete
→ App reloads
→ Loads old/incomplete state from IndexedDB
→ Message shows as encrypted (wrong state)
→ Receiver can't decrypt (state desynchronization)
```

### Contributing Factors

1. **Skipped Keys Not Persisted**
   ```typescript
   // cryptoDbStore.ts:167
   skippedMessageKeys: new Map() // Will be loaded separately or ignored here
   ```
   - Skipped message keys are lost on reload
   - Causes "Skipped Key Not Found" errors after refresh

2. **No Save Validation**
   - No checksums or versioning to detect incomplete saves
   - No retry logic for failed saves

3. **Asynchronous State Management**
   - Multiple rapid messages create race conditions
   - Last write wins, potentially losing intermediate state

---

## Part 3: Performance Bottlenecks

### Identified Performance Issues

1. **Synchronous Crypto Operations**
   - Key generation and derivation can block UI
   - Large message encryption without chunking

2. **IndexedDB Transaction Overhead**
   - Opening database on every operation
   - No connection pooling or caching

3. **Redundant Key Exports/Imports**
   - Keys exported to JWK for storage
   - Re-imported on every load
   - Could use raw bytes for better performance

4. **No Batching for State Updates**
   - Each message triggers separate IndexedDB transaction
   - Could batch multiple state updates

---

## Part 4: Recommended Fix Priority

### Phase 1: Data Integrity & Performance (URGENT)
**Goal:** Fix message functionality, eliminate race conditions, improve performance

1. Make IndexedDB saves synchronous/blocking for critical operations
2. Implement proper skipped key persistence
3. Add save/load validation with checksums
4. Implement connection pooling for IndexedDB
5. Add retry logic for failed saves
6. Optimize key storage format (raw bytes vs JWK)

### Phase 2: Critical Security Fixes
**Goal:** Address CRITICAL severity vulnerabilities

1. Remove hardcoded 'VELUM_KEY'
2. Implement actual Ed25519 signature verification
3. Remove KEYDEBUG logging
4. Replace Math.random() with crypto.getRandomValues()

### Phase 3: High Priority Security Fixes
**Goal:** Address HIGH severity vulnerabilities

1. Set extractable: false for private keys
2. Add random salts to HKDF operations
3. Implement proper dummy salt generation
4. Replace XOR encryption with AES-GCM for lounge messages
5. Remove plaintext fallback on encryption errors

### Phase 4: Medium/Low Priority & Architecture
**Goal:** Complete security hardening

1. Implement key binding to authentication session
2. Replace window.prompt with proper UI
3. Use crypto.randomBytes() for all security-sensitive generation
4. Consolidate session token handling
5. Consider migrating to X25519
6. Implement identity key rotation
7. Add encryption-at-rest for IndexedDB keys
8. Unify encryption model across message types

---

## Part 5: Implementation Strategy for Phase 1

### Data Integrity Fixes

#### 1. Synchronous State Persistence
Change from fire-and-forget to awaited saves:
```typescript
// Before
saveConversationStateToDb(this.getLocalUserIdOrThrow(), peerUserId, state).catch(e => console.error(e));

// After
await saveConversationStateToDb(this.getLocalUserIdOrThrow(), peerUserId, state);
```

#### 2. Skipped Key Persistence
Implement proper skipped key storage and loading:
```typescript
// Save skipped keys with conversation state
// Load skipped keys when loading conversation state
// Implement proper key lifecycle management
```

#### 3. State Validation
Add checksums and versioning:
```typescript
interface RatchetState {
  // ... existing fields
  version: number;
  checksum: string;
}
```

#### 4. Connection Pooling
Cache IndexedDB connection:
```typescript
let dbConnection: IDBDatabase | null = null;
async function getDbConnection(): Promise<IDBDatabase> {
  if (!dbConnection) {
    dbConnection = await openCryptoDatabaseV2();
  }
  return dbConnection;
}
```

#### 5. Retry Logic
Implement exponential backoff for failed saves:
```typescript
async function saveWithRetry(key: string, data: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await saveToDb(key, data);
      return;
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 100));
    }
  }
}
```

### Performance Optimizations

#### 1. Optimize Key Storage
Use raw bytes instead of JWK for better performance:
```typescript
// Before: JWK format (JSON serialization overhead)
await subtle.exportKey('jwk', key);

// After: Raw bytes (binary format)
await subtle.exportKey('raw', key);
```

#### 2. Batch State Updates
Queue multiple state updates and flush together:
```typescript
class StateUpdateQueue {
  private queue: Map<number, RatchetState> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  
  queueUpdate(peerUserId: number, state: RatchetState) {
    this.queue.set(peerUserId, state);
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 100);
    }
  }
  
  async flush() {
    const updates = Array.from(this.queue.entries());
    this.queue.clear();
    this.flushTimer = null;
    await Promise.all(updates.map(([uid, state]) => 
      saveConversationStateToDb(this.localUserId, uid, state)
    ));
  }
}
```

#### 3. Web Workers for Crypto Operations
Offload heavy crypto operations to background threads:
```typescript
// Move key generation, encryption, decryption to Web Worker
// Keep UI responsive during crypto operations
```

---

## Part 6: Success Criteria

### Phase 1 Success Metrics
- ✅ Messages persist correctly across app refresh
- ✅ No "failed to decrypt" errors after refresh
- ✅ No race conditions in rapid message sending
- ✅ Message encryption/decryption < 50ms
- ✅ State save success rate > 99.9%
- ✅ UI remains responsive during crypto operations

### Phase 2 Success Metrics
- ✅ No hardcoded keys in codebase
- ✅ All signatures properly verified
- ✅ No key material in console logs
- ✅ All nonces use cryptographic RNG

---

## Part 7: Testing Strategy

### Data Integrity Tests
1. Test message persistence across refresh scenarios
2. Test rapid message sending (10+ messages/second)
3. Test interrupted saves (refresh during save)
4. Test skipped key persistence
5. Test recovery from corrupted state

### Performance Tests
1. Benchmark encryption/decryption latency
2. Measure IndexedDB operation timing
3. Test memory usage during extended sessions
4. Test concurrent crypto operations

### Security Tests
1. Verify no hardcoded keys
2. Test signature verification
3. Verify console logs contain no key material
4. Test nonce unpredictability
5. Verify key extractability settings

---

## Conclusion

The data integrity issue is the highest priority as it directly affects user experience and message functionality. The security vulnerabilities are serious but the system currently functions (albeit insecurely). The proposed Phase 1 fixes address both the immediate functionality issues and lay the groundwork for subsequent security hardening.

The fixes are technically feasible and can be implemented incrementally without disrupting the existing architecture.