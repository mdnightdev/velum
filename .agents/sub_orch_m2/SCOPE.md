# Scope: Milestone 2 (Signal Protocol Store Adapter)

## Objective
Implement production-grade IndexedDB storage adapters (`src/services/cryptoDbStore.ts`) conforming to the official `@signalapp/libsignal-client` abstract store contracts or compatible Signal protocol store specifications.

## Key Requirements
1. **Stores**:
   - `IdentityKeyStore`: Local identity key pair, local registration ID, trusted remote identities (`saveIdentity`, `isTrustedIdentity`, `getIdentityKeyPair`, `getLocalRegistrationId`).
   - `PreKeyStore`: One-Time PreKeys (`loadPreKey`, `storePreKey`, `removePreKey`).
   - `SignedPreKeyStore`: Signed PreKeys (`loadSignedPreKey`, `storeSignedPreKey`, `loadSignedPreKeys`).
   - `SessionStore`: Session records per remote address (`loadSession`, `storeSession`).
   - `SenderKeyStore`: Sender key records per group / sender address (`loadSenderKey`, `storeSenderKey`).
2. **Multi-Account Namespacing**:
   - Support `${localUserId}` prefix or user-specific store instances/databases to guarantee complete isolation across user accounts.
3. **Reset & Migration Handling**:
   - `purgeCryptoVault(userId?: string)` to cleanly delete or clear stores.
   - Upgrade handling to safely reset old WebCrypto P-256 databases without crashing.
4. **Type Safety & Native / WASM Interop**:
   - Use official `@signalapp/libsignal-client` data structures (`PrivateKey`, `PublicKey`, `IdentityKeyPair`, `PreKeyRecord`, `SignedPreKeyRecord`, `SessionRecord`, `SenderKeyRecord`, `ProtocolAddress`, etc.) or appropriate byte buffers/arrays conforming to libsignal-client interfaces.
5. **Testing**:
   - Unit tests covering all store methods, key serialization/deserialization, multi-user isolation, purge operations, and schema upgrade resiliency.
