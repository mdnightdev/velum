# Velum E2EE Signal Protocol Implementation Analysis

**Documented:** 2026-08-15  
**Implementation:** Signal Protocol with @signalapp/libsignal-client + Custom Double Ratchet

---

## Architecture Overview

Velum implements a hybrid E2EE approach combining:
1. **@signalapp/libsignal-client** for key generation and protocol primitives
2. **Custom Double Ratchet implementation** using Web Crypto API
3. **IndexedDB** for persistent cryptographic storage
4. **PostgreSQL** for prekey bundle distribution

---

## Component Structure

### Client-Side Cryptography (`src/services/`)

#### 1. `signalKeyUtils.ts` - Signal Protocol Primitives
**Purpose:** Key generation, serialization, and verification using Signal's native library

**Key Functions:**
- `generateIdentityKeyPair()` - Creates Curve25519 identity key pair
- `generateSignedPreKey()` - Generates signed prekey with identity signature
- `generateOneTimePreKeys()` - Batch of single-use prekeys
- `serializePrekeysForPublish()` - Converts keys to Base64 for API transport
- `deserializePreKeyBundle()` - Reconstructs PreKeyBundle from server DTO
- `verifySignedPreKey()` - Validates signed prekey signatures

**Data Types:**
```typescript
interface SignalPrekeyBundleDTO {
  userId: number;
  registrationId: number;
  deviceId: number;
  identityKey: string;           // Base64 (33 bytes)
  signedPrekeyId: number;
  signedPrekey: string;          // Base64 (33 bytes)
  signedPrekeySignature: string; // Base64 (64 bytes)
  oneTimePrekey?: { keyId: number; publicKey: string } | null;
  oneTimePrekeysLeft?: number;
}
```

**Analysis:**
- Uses official Signal library for cryptographic primitives
- Base64 encoding for transport compatibility
- Proper separation of generation and serialization
- Includes signature verification for authenticity

---

#### 2. `cryptoDbStore.ts` - IndexedDB Storage Adapter
**Purpose:** Implements Signal Protocol Store interfaces for persistent key storage

**Stores Implemented:**
- `IndexedDbIdentityKeyStore` - Identity keys (local + remote)
- `IndexedDbPreKeyStore` - One-time prekeys
- `IndexedDbSignedPreKeyStore` - Signed prekeys
- `IndexedDbKyberPreKeyStore` - Kyber KEM prekeys (PQ encryption)
- `IndexedDbSessionStore` - Double ratchet session states
- `IndexedDbSenderKeyStore` - Group messaging sender keys

**Database Schema:**
```typescript
const DB_NAME = 'velum_crypto_vault';
const DB_VERSION = 30;
const STORE_IDENTITY_KEYS = 'identity_keys';
const STORE_PRE_KEYS = 'pre_keys';
const STORE_SIGNED_PRE_KEYS = 'signed_pre_keys';
const STORE_KYBER_PRE_KEYS = 'kyber_pre_keys';
const STORE_SESSIONS = 'sessions';
const STORE_SENDER_KEYS = 'sender_keys';
const STORE_VAULT_METADATA = 'vault_metadata';
```

**Key Features:**
- User-scoped key storage with `localUserId` prefix
- Trust-on-first-use (TOFU) for remote identity keys
- Automatic schema migration with legacy cleanup
- Connection pooling and blocking handling
- Vault metadata for local encryption keys

**Analysis:**
- Comprehensive Signal Protocol Store implementation
- Proper isolation between users
- Includes Kyber post-quantum support
- IndexedDB provides browser-native persistent storage
- Version control for schema evolution

---

#### 3. `doubleRatchetService.ts` - Custom Double Ratchet
**Purpose:** Implements X3DH handshake and Double Ratchet algorithm using Web Crypto API

**Architecture:**
```typescript
class DoubleRatchetService {
  private localIdentityKeyPair: KeyPair | null = null;
  private localSignedPrekeyPair: KeyPair | null = null;
  private localOneTimePrekeys: KeyPair[] = [];
  private conversationStates: Map<number, RatchetState> = new Map();
  private localUserId: number | null = null;
}
```

**State Management:**
```typescript
interface RatchetState {
  dhRatchetKeyPair: KeyPair | null;
  dhRatchetPublicKey: CryptoKey | null;
  rootKey: ArrayBuffer | null;
  sendChainKey: ArrayBuffer | null;
  receiveChainKey: ArrayBuffer | null;
  sendChainLength: number;
  receiveChainLength: number;
  receiveChainGeneration: number; // Disambiguates skipped keys across chains
  previousChainLength: number;
  skippedMessageKeys: Map<string, CryptoKey>;
  version: number;
  checksum?: string; // SHA-256 integrity validation
}
```

**Key Operations:**

**X3DH Handshake:**
```typescript
private async x3dhHandshake(peerBundle: PrekeyBundle, usedOneTimePrekey?: string): Promise<ArrayBuffer> {
  // Performs 4-5 DH exchanges:
  // DH1: IK_A * IK_B
  // DH2: SPK_A * IK_B  
  // DH3: IK_A * SPK_B
  // DH4: SPK_A * SPK_B
  // DH5: IK_A * OPK_B (if OTP available)
  
  // Combines outputs with HKDF using SHA-256
  // Lexicographic sorting ensures both sides derive same key
}
```

**Chain Determinism:**
```typescript
// Critical: Ensures both peers assign send/receive chains correctly
const infoSend = localUserId < peerUserId ? 'DoubleRatchetChain_A' : 'DoubleRatchetChain_B';
const infoRecv = localUserId < peerUserId ? 'DoubleRatchetChain_B' : 'DoubleRatchetChain_A';
```

**Message Encryption:**
```typescript
async encryptDirectMessage(plaintext: string, peerUserId: number): Promise<string> {
  // 1. Derive message key from send chain key
  // 2. Ratchet chain key for next message
  // 3. Encrypt with AES-GCM (256-bit)
  // 4. Generate HMAC for integrity
  // 5. Return envelope: ratchet:v2:{header,iv,ciphertext,tag,hmac}
}
```

**Message Decryption:**
```typescript
async decryptDirectMessage(envelope: string, peerUserId: number): Promise<string> {
  // 1. Parse envelope header
  // 2. Perform DH ratchet if peer key changed
  // 3. Handle skipped message keys for out-of-order delivery
  // 4. Derive appropriate message key
  // 5. Verify HMAC integrity
  // 6. Decrypt with AES-GCM
}
```

**Optimizations:**
- State update batching (100ms window) to reduce IndexedDB writes
- Prekey bundle caching to reduce server requests
- Checksum validation for state integrity
- Force rekey capability for desync recovery

**Analysis:**
- Custom implementation vs using Signal's native Double Ratchet
- Uses Web Crypto API (P-256 ECDH, AES-GCM, HKDF, HMAC)
- Proper deterministic chain assignment prevents state collision
- Comprehensive skipped key handling for out-of-order messages
- Performance optimizations with batching and caching
- Includes integrity checks and recovery mechanisms

---

#### 4. `skippedKeysStore.ts` - Out-of-Order Message Support
**Purpose:** Stores message keys for late-arriving messages

**Storage Strategy:**
- Primary: IndexedDB with key format `{roomId}:{senderUserId}:{chainLength}:{messageIndex}`
- Fallback: In-memory Map if IndexedDB unavailable
- Single-use: Keys deleted upon consumption

**Interface:**
```typescript
interface SkippedMessageKeyRecord {
  roomId: string;
  senderUserId: number;
  messageIndex: number;
  chainLength: number;
  keyJwk: string; // Serialized CryptoKey
  createdAt: string;
}
```

**Analysis:**
- Enables proper handling of network reordering
- Dual storage ensures reliability
- Proper cleanup on key consumption
- Peer-specific purging for rekey scenarios

---

#### 5. `localVaultEncryption.ts` - Local Data Protection
**Purpose:** Encrypts sensitive local data (message history, etc.)

**Features:**
- AES-GCM 256-bit encryption
- Automatic key generation and rotation (24-hour intervals)
- Salt-based key versioning for forward secrecy
- Cryptographic shredding on key rotation

**Key Rotation:**
```typescript
public static async rotateVaultKey(): Promise<void> {
  // Generates new key and salt
  // Old data becomes inaccessible (forward secrecy)
  // Forces re-encryption of any needed historical data
}
```

**Analysis:**
- Provides additional layer of security for local storage
- Periodic rotation ensures forward secrecy
- Salt-based versioning prevents accidental decryption
- Integrates with IndexedDB for key persistence

---

### Server-Side Cryptography (`server/v2/`)

#### 1. `prekeyVaultService.ts` - Prekey Bundle Management
**Purpose:** Server-side storage and distribution of prekey bundles

**Database Schema:**
```typescript
export const userPrekeys = pgTable('user_prekeys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  deviceId: integer('device_id').default(1).notNull(),
  registrationId: integer('registration_id').default(1).notNull(),
  identityKey: text('identity_key').notNull(),
  signedPrekeyId: integer('signed_prekey_id').default(1).notNull(),
  signedPrekey: text('signed_prekey').notNull(),
  signedPrekeySignature: text('signed_prekey_signature').notNull(),
  oneTimePrekeys: text('one_time_prekeys').default('[]').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});
```

**Key Operations:**
- `publishPrekeyBundle()` - Upload or update user's prekey bundle
- `fetchPrekeyBundle()` - Retrieve and consume one-time prekey
- `generateSafetyNumber()` - Create safety number from identity keys

**One-Time Prekey Consumption:**
```typescript
// Atomic transaction ensures OTP is only used once
// Removes consumed key from pool to prevent reuse
// Returns remaining count for client-side rotation trigger
```

**Analysis:**
- Atomic prekey consumption prevents reuse
- Device support (multiple devices per user)
- Timestamp tracking for key rotation
- Safety number generation for identity verification

---

#### 2. `keys.ts` - Database Schema
**Purpose:** Drizzle ORM schema for prekey storage

**Indexes:**
- Unique on `(userId, deviceId)` - One bundle per device
- Index on `userId` - Fast user lookup

**Analysis:**
- Proper relational design with user cascade deletion
- Optimized for common query patterns
- JSON storage for one-time prekey array

---

## Protocol Flow

### 1. Initial Setup
```
Client Registration:
1. Generate identity key pair (long-term)
2. Generate signed prekey (medium-term) 
3. Generate 100 one-time prekeys (single-use)
4. Upload bundle to server via /v2/user/keys/prekey-bundle
5. Server stores in user_prekeys table
```

### 2. X3DH Handshake
```
Alice wants to message Bob:
1. Alice fetches Bob's prekey bundle from server
2. Server returns bundle + consumes one OTP
3. Alice performs X3DH DH exchanges (4-5 rounds)
4. Alice derives initial root key via HKDF
5. Alice initializes Double Ratchet state
6. Alice sends first message with ratchet header
```

### 3. Ongoing Communication
```
Message Exchange:
1. Sender derives message key from send chain
2. Sender ratchets chain key forward
3. Sender encrypts with AES-GCM
4. Sender generates HMAC for integrity
5. Sender transmits envelope via WebSocket
6. Receiver validates HMAC
7. Receiver derives matching message key
8. Receiver decrypts with AES-GCM
9. Receiver stores skipped keys if out-of-order
```

### 4. Key Rotation
```
Prekey Rotation:
1. Client monitors one-time prekey count
2. When < 20, generate new batch
3. Upload new bundle to server
4. Server replaces existing bundle

Local Vault Rotation:
1. Timer triggers every 24 hours
2. Generate new AES-GCM key
3. Old data becomes inaccessible
4. New data uses new key
```

---

## Security Analysis

### Strengths
1. **Signal Protocol Primitives** - Uses audited cryptographic library
2. **Forward Secrecy** - Double ratchet ensures past messages protected
3. **Post-Quantum Ready** - Kyber prekey support included
4. **Integrity Protection** - HMAC on all encrypted messages
5. **Identity Verification** - Safety numbers for manual verification
6. **Compromise Resilience** - Force rekey for state recovery
7. **Local Protection** - Vault encryption for at-rest data

### Weaknesses & Concerns
1. **Custom Double Ratchet** - Not using Signal's native implementation
2. **P-256 vs X25519** - Uses NIST curve instead of Signal's Curve25519
3. **Debug Logging** - Key material logged in console (security risk)
4. **Signed Prekey Signature** - Hardcoded 'valid_sig_p256' instead of real signature
5. **No PQ in Ratchet** - Only prekeys use Kyber, ongoing messages still classical
6. **State Version Control** - Manual versioning vs Signal's built-in mechanisms

### Critical Security Issues
```typescript
// IN doubleRatchetService.ts line 259
signedPrekeySignature: 'valid_sig_p256', // In production, use actual signature
```
This bypasses the entire signature verification system - identity keys cannot be authenticated.

```typescript
// IN doubleRatchetService.ts lines 494-502
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
Production code logs actual encryption keys to console - critical security vulnerability.

---

## Testing Coverage

### E2E Test Suite (`tests/e2e/e2ee-signal.test.ts`)
**Comprehensive Coverage:**
1. Prekey bundle generation and exchange
2. X3DH handshake verification
3. 20-turn bidirectional conversation
4. Tri-party multi-peer network
5. Offline outbox queue integration
6. Out-of-order message delivery
7. Local vault encryption and rotation
8. Auto-healing and re-synchronization

**Test Infrastructure:**
- Mock server vault for prekey storage
- Test participant abstraction
- WebSocket transmitter simulation
- IndexedDB test environment

### Unit Tests
- `libsignal-primitives.test.ts` - Signal library primitives
- `libsignal-stress.test.ts` - Performance and concurrency
- `libsignal-concurrency-bundler.test.ts` - Batching behavior

---

## Integration Points

### Client → Server
```
POST /v2/user/keys/prekey-bundle
- Upload identity key, signed prekey, one-time prekeys
- Headers: Authorization: Bearer {sessionId}

GET /v2/user/{userId}/prekey-bundle  
- Retrieve peer's prekey bundle
- Server consumes one OTP atomically
- Returns remaining count
```

### Client → IndexedDB
```
Signal Protocol Store Implementation:
- IdentityKeyStore: Local/remote identity keys
- PreKeyStore: One-time prekeys
- SignedPreKeyStore: Signed prekeys
- KyberPreKeyStore: Post-quantum prekeys
- SessionStore: Ratchet state
- SenderKeyStore: Group messaging
```

### WebSocket Integration
```
Message Envelope Format:
ratchet:v2:{
  "header": {
    "dhPublicKey": "...",
    "pn": 0,
    "n": 1
  },
  "ivHex": "...",
  "ciphertextHex": "...",
  "tagHex": "...",
  "hmacHex": "..."
}
```

---

## Recommendations

### Immediate Security Fixes
1. **Remove debug logging** - Delete console.log statements exposing key material
2. **Implement real signatures** - Replace hardcoded signature with actual identity key signing
3. **Add secure random** - Ensure all key generation uses cryptographically secure RNG

### Architecture Improvements
1. **Use Signal's Double Ratchet** - Replace custom implementation with @signalapp/libsignal-client's native ratchet
2. **Adopt Curve25519** - Switch from P-256 to match Signal's exact curve
3. **Add full PQ support** - Extend Kyber usage to ongoing ratchet operations
4. **Implement CRL/Revocation** - Add mechanism to revoke compromised keys

### Operational Enhancements
1. **Prekey monitoring** - Server-side alerts for low prekey counts
2. **Safety number UI** - User-facing identity verification interface
3. **Audit logging** - Cryptographic event logging for security analysis
4. **Key backup** - Secure key recovery mechanism

---

## Conclusion

Velum's E2EE implementation demonstrates a sophisticated understanding of modern cryptographic protocols, with proper integration of Signal's key management primitives and a comprehensive storage architecture. However, the custom Double Ratchet implementation and critical security issues (key logging, fake signatures) present significant risks that should be addressed before production deployment.

The hybrid approach (Signal primitives + custom ratchet) provides flexibility but sacrifices the audit benefits of using the full Signal Protocol stack. For a production system targeting maximum security assurance, migrating to the complete @signalapp/libsignal-client implementation would be advisable.
