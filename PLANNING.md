# DM Deletion vs Clear Chat Investigation

## Problem Summary

User reports two issues with DM conversation management:

1. **Cross-user deletion bug**: When user A deletes their conversation with user B, it also deletes for user B (should only delete for user A)
2. **Delete vs Clear confusion**: 
   - Delete should unmount the user from UI (remove conversation from view)
   - Clear should wipe messages but keep conversation shell in UI
   - New messages after deletion should start fresh conversation (not pull old messages)

## Current Implementation Analysis

### Files Involved in DM Logic

**Frontend:**
- `src/components/SidebarTabs/DirectMainDashboard.tsx` - Main DM list view
- `src/components/ChatArea.tsx` - Chat message display
- `src/components/ProfileCard.tsx` - Profile actions including "Clear Chat"
- `src/components/DashboardLayout.tsx` - Profile card integration
- `src/components/SidebarTabs/LoungeWorkspace.tsx` - Member profile actions
- `src/components/AdminUsersView.tsx` - Admin user actions

**Backend:**
- `server/v2/routes/userRoutes.ts` - DELETE /v2/user/:id/chat endpoint
- `server/v2/services/loungeService.ts` - clearUserChatHistory function
- `server/v2/db/schema/chat_clears.ts` - user_chat_clears table
- `server/websocket/handlers/messageHandler.ts` - Message sync with clear logic

### Current Delete Operation Flow

**Frontend (DirectMainDashboard.tsx):**
```typescript
const handleDeleteConversation = async (peerId: number, peerName: string, dmRoomId: string) => {
  // 1. Set local deletion timestamp in localStorage
  setDeletedDms(prev => {
    const next = { ...prev, [peerId]: now };
    localStorage.setItem(`velum_deleted_dms_${currentUserId}`, JSON.stringify(next));
    return next;
  });

  // 2. Wipe local cache for this DM room
  await flushLoungeCache(dmRoomId, currentUserId);

  // 3. Call server to purge messages from DB
  await fetch(`/v2/user/${peerId}/chat`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${sId}` }
  });
}
```

**Backend (userRoutes.ts):**
```typescript
userRouter.delete('/:id/chat', authMiddleware, async (req, res) => {
  const currentUserId = req.user.userId;
  const targetUserId = parseInt(req.params.id, 10);
  
  // Resolve DM lounge IDs
  const matchedLounges = await db.select().from(lounges).where(eq(lounges.slug, dmSlug));
  const targetLoungeIds = new Set(matchedLounges.map(l => l.id));
  
  // Find common lounges between users
  const members = await db.select().from(loungeMembers).where(inArray(loungeMembers.userId, [currentUserId, targetUserId]));
  const userLounges = new Set(members.filter(m => m.userId === currentUserId).map(m => m.loungeId));
  const targetLounges = new Set(members.filter(m => m.userId === targetUserId).map(m => m.loungeId));
  
  // Add shared lounges
  for (const lId of userLounges) {
    if (targetLounges.has(lId)) {
      targetLoungeIds.add(lId);
    }
  }
  
  // Call clearUserChatHistory for each lounge
  for (const lId of allLoungeIds) {
    await clearUserChatHistory(currentUserId, lId);
  }
});
```

**Backend (loungeService.ts - clearUserChatHistory):**
```typescript
export async function clearUserChatHistory(userId: number, loungeId: number) {
  // 1. Upsert userChatClears record (USER-SPECIFIC)
  await db.insert(userChatClears).values({
    userId,
    loungeId,
    clearedAt: now,
    updatedAt: now
  });
  
  // 2. Update read cursor (USER-SPECIFIC)
  await db.update(userReadCursors)
    .set({
      clearedSeq: currentSeq,
      clearedAt: now,
      lastReadSeq: currentSeq,
      updatedAt: now
    })
    .where(and(eq(userReadCursors.userId, userId), eq(userReadCursors.loungeId, loungeId)));
}
```

### Current Clear Operation Flow

**Frontend (ProfileCard.tsx & DashboardLayout.tsx):**
- ProfileCard shows "Clear chat" button
- DashboardLayout onDeleteChat handler:
  1. Calls DELETE /v2/user/:id/chat (same endpoint as delete!)
  2. Wipes local cache with flushLoungeCache
  3. Sets localStorage deletion timestamp
  4. Navigates away from room

**Problem**: Both "delete" and "clear" use the same server endpoint and logic!

## Root Cause Analysis

### Issue 1: Cross-User Deletion Bug

**Actual Behavior**: Server-side clear is correctly user-specific via `userChatClears` table, but frontend calls same endpoint for both operations.

**Investigation Finding**: The server-side `clearUserChatHistory` function IS user-specific:
- It only inserts/updates records for the requesting `userId`
- The `user_chat_clears` table has unique constraint on (userId, loungeId)
- Message sync logic respects per-user `clearedAt` timestamps

**However**, the frontend implementation in multiple places (DirectMainDashboard, DashboardLayout, LoungeWorkspace, AdminUsersView) all:
1. Call the same DELETE endpoint
2. Set localStorage deletion timestamps
3. Wipe local cache
4. Navigate away from conversation

**The bug likely stems from**: 
- LocalStorage deletion timestamps are per-user, but the UI filtering logic may not be properly applied
- The auto-un-delete logic relies on lastMessage timestamps which may not update correctly for the other user

### Issue 2: Delete vs Clear Confusion

**Current State**: No distinction between delete and clear operations:
- Both use DELETE /v2/user/:id/chat endpoint
- Both set localStorage deletion timestamps
- Both wipe local cache
- Both navigate away from conversation

**Expected Behavior**:
- **Delete**: Remove conversation from UI (unmount), but keep server-side ability to restore on new message
- **Clear**: Wipe message history but keep conversation shell in UI

### Issue 3: Message Timestamp & Conversation Continuity

**Current Auto-Un-delete Logic** (DirectMainDashboard.tsx):
```typescript
// Auto-un-delete if a new message arrives from/to peer after deletion timestamp
useEffect(() => {
  for (const [peerIdStr, delTime] of Object.entries(deletedDms)) {
    const last = lastMessages[dmRoomId];
    const msgTime = last.createdAt ? new Date(last.createdAt).getTime() : 0;
    if (msgTime > delTime) {
      delete nextMap[peerId]; // Remove from deleted list
      changed = true;
    }
  }
}, [lastMessages, currentUserId, deletedDms]);
```

**Server-side Sync Logic** (messageHandler.ts & loungeService.ts):
- Message sync respects both `clearedSeq` and `clearedAt` per-user
- Conditions: `sequenceId > clearedSeq` AND `createdAt > clearedAt`
- This should prevent old messages from appearing after clear

**Potential Issue**: If the frontend's `lastMessages` object doesn't update properly for the other user, the auto-un-delete logic won't trigger correctly.

## Proposed Solution

### 1. Separate Delete and Clear Operations

**Server-side Changes:**
- Keep existing DELETE /v2/user/:id/chat for "clear" operation (user-specific message clearing)
- Add new DELETE /v2/user/:id/conversation for "delete" operation (conversation removal)

**Frontend Changes:**
- Update UI to have distinct "Delete Conversation" and "Clear Chat" actions
- "Delete": Sets localStorage timestamp, removes from UI, keeps server clear record
- "Clear": Only calls server clear endpoint, keeps conversation in UI

### 2. Fix Cross-User Deletion

**Ensure proper user-specific filtering:**
- Verify that localStorage deletion timestamps are properly checked before rendering DM list
- Ensure `lastMessages` updates correctly for both users in real-time
- Add WebSocket event to notify other user when conversation is deleted (so they can update their UI state)

### 3. Message Continuity

**Verify timestamp logic:**
- Ensure `clearedAt` timestamps are correctly set and respected
- Add client-side validation to prevent loading messages older than deletion timestamp
- Test auto-un-delete flow with real-time message arrival

## Implementation Plan

### Phase 1: Separate Delete and Clear Endpoints
1. Add new server endpoint for conversation deletion
2. Update frontend to call appropriate endpoint based on user action
3. Maintain separate UI states for deleted vs cleared conversations

### Phase 2: Fix Cross-User State Synchronization  
1. Add WebSocket event for conversation deletion notification
2. Ensure proper state updates when other user deletes conversation
3. Test cross-user deletion scenarios

### Phase 3: Strengthen Message Continuity Logic
1. Add client-side message timestamp validation
2. Improve auto-un-delete logic reliability
3. Add edge case handling for timezone/clock skew

## scattered Logic Locations

DM logic is indeed scattered across multiple files:
- **Sidebar**: DirectMainDashboard.tsx (main DM list)
- **Chat**: ChatArea.tsx (message display)
- **Profile**: ProfileCard.tsx, DashboardLayout.tsx (user actions)
- **Workspace**: LoungeWorkspace.tsx (member actions)
- **Admin**: AdminUsersView.tsx (admin actions)
- **Server**: userRoutes.ts, loungeService.ts, messageHandler.ts

This scattering makes it difficult to maintain consistent behavior across the application.

## Cache Management Investigation

### Cache Architecture Overview

The application uses a multi-layer caching strategy that explains the 70% cache vs app data ratio:

**Client-Side Caching (IndexedDB):**
- `src/utils/indexedDb.ts` - Main IndexedDB wrapper
- `src/services/cryptoDbStore.ts` - Database schema and management
- **Storage**: User-isolated IndexedDB with encryption
- **Stores**: messages, media_blobs, outbox_messages, user_kv, crypto keys
- **TTL**: 24 hours for messages (`MAX_MESSAGE_AGE_MS = 24 * 60 * 60 * 1000`)
- **Size**: No explicit size limits, leading to potential bloat

**Server-Side Caching (Redis):**
- `server/v2/db/redis.ts` - Redis connection pooling (max 10 connections)
- **Cache Keys**:
  - `room:{loungeId}:messages` - Room message history (300s TTL)
  - `dm:last_msg:{loungeId}` - DM last message (no TTL set)
  - `unread:{userId}:{roomId}` - Unread counts (86400s TTL = 24 hours)
  - `users:all` - User list cache (60s TTL)
  - `sysconfig:{key}` - System configuration (no TTL)
  - Various user-specific keys (muted, blocked, etc.)

### Cache Invalidation Issues

**Problem 1: Stale Conversation Loading**
When a user opens a chat after deletion/clear, stale data loads from:

1. **IndexedDB**: Messages cached locally with 24-hour TTL
   - `getLocalMessages()` returns messages up to 24 hours old
   - No account for user-specific deletion timestamps
   - `flushLoungeCache()` is called but may not clear all cached data

2. **Redis**: Server-side message cache
   - `room:{loungeId}:messages` cache not invalidated on user-specific clear
   - Only invalidated on message edits/deletes/pins (global operations)
   - DM last message cache never expired

**Current Cache Invalidation Flow:**
```typescript
// Frontend: DirectMainDashboard.tsx
const handleDeleteConversation = async (peerId, peerName, dmRoomId) => {
  // 1. Set localStorage deletion timestamp
  setDeletedDms(prev => ({ ...prev, [peerId]: Date.now() }));
  
  // 2. Flush IndexedDB cache
  await flushLoungeCache(dmRoomId, currentUserId);
  
  // 3. Call server clear endpoint
  await fetch(`/v2/user/${peerId}/chat`, { method: 'DELETE' });
};
```

**Server-side cache invalidation gaps:**
- `DELETE /v2/user/:id/chat` does NOT invalidate Redis caches
- `dm:last_msg:{loungeId}` cache persists even after clear
- `room:{loungeId}:messages` cache not cleared for user-specific operations

**Problem 2: Cache Size Bloat**
- IndexedDB has no storage quotas or cleanup mechanisms
- Media blobs stored indefinitely in `media_blobs` store
- 24-hour message TTL applies to retrieval, not storage
- No periodic cleanup of expired records

### Specific Cache Issues Found

**IndexedDB Issues:**
1. **No user-specific filtering in retrieval**: `getLocalMessages()` doesn't check deletion timestamps
2. **Incomplete cache clearing**: `flushLoungeCache()` only clears by room ID, missing reciprocal DM IDs
3. **No storage limits**: Media blobs can accumulate indefinitely
4. **TTL only on retrieval**: Old messages filtered on read, not purged from storage

**Redis Issues:**
1. **Missing invalidation**: User-specific clears don't invalidate room message caches
2. **No TTL on DM last message**: `dm:last_msg:{loungeId}` persists indefinitely
3. **Global cache invalidation**: Room caches only cleared on global operations (edit/delete/pin)
4. **No user-specific cache keys**: All caches are lounge-level, not user-level

### Cache Loading Flow (Current Problem)

**When user opens deleted/cleared chat:**
1. Frontend checks localStorage deletion timestamps
2. If deleted, conversation should be hidden
3. But if cache miss occurs:
   - Falls back to `getLocalMessages()` from IndexedDB
   - Returns messages up to 24 hours old, ignoring deletion status
   - User sees stale conversation

**When new message arrives after deletion:**
1. Auto-un-delete logic compares `lastMessages[dmRoomId].createdAt` vs deletion timestamp
2. If `lastMessages` object not updated (cache stale), auto-un-delete fails
3. Conversation remains deleted even though new message exists

### Proposed Cache Solutions

**Immediate Fixes:**
1. **Add deletion timestamp filtering to IndexedDB retrieval**
   - Modify `getLocalMessages()` to accept and respect deletion timestamps
   - Filter out messages older than deletion timestamp

2. **Invalidate Redis caches on user-specific clear**
   - Add `redis.del(`room:${loungeId}:messages`)` to `clearUserChatHistory`
   - Add `redis.del(`dm:last_msg:${loungeId}`)` to clear operations
   - Add user-specific cache keys: `room:${loungeId}:messages:${userId}`

3. **Add storage cleanup mechanisms**
   - Implement periodic IndexedDB cleanup of expired messages
   - Add media blob size limits and LRU eviction
   - Add storage quota monitoring

**Long-term Improvements:**
1. **Implement user-specific caching layer**
   - Separate cache keys per user for shared lounges
   - Respect user-specific clear timestamps in cache retrieval

2. **Add cache versioning**
   - Increment cache version on schema changes
   - Invalidate all caches on version mismatch

3. **Implement cache warming strategy**
   - Pre-populate caches for active conversations
   - Background refresh for stale data

### Cache Size Management

**Current State:**
- IndexedDB: Unlimited storage, 24-hour message TTL on retrieval only
- Redis: 10 connection pool, various TTLs (300s to 86400s)
- No storage monitoring or cleanup

**Recommended:**
1. Add IndexedDB storage quota monitoring
2. Implement LRU eviction for media blobs
3. Add periodic cleanup of expired messages
4. Set reasonable TTLs on all Redis keys
5. Monitor cache hit/miss ratios for optimization

## Encryption Architecture Investigation

### Current Encryption Implementation Analysis

**Finding: The server is NOT attempting to encrypt/decrypt messages at rest.** Your concern is understandable but the current implementation is actually correct - the server acts as a blind relay for encrypted content.

### Server-Side Encryption Analysis

**Server Functions (`server/v2/utils/crypto.ts`):**
- `encryptAsync()` / `decryptAsync()` - AES-256-GCM symmetric encryption
- `hashArgon2id()` / `verifyArgon2id()` - Password hashing
- `safeCompare()` - Constant-time comparison
- These are used ONLY for:
  - Password hashing during authentication
  - Session token management
  - Server-side configuration encryption
  - NOT for message content

**Message Storage (`server/v2/db/schema/lounges.ts`):**
```typescript
export const messages = pgTable('messages', {
  // ...
  content: text('content').notNull(),  // Stored as-is (encrypted or plaintext)
  encrypted: boolean('encrypted').default(false).notNull(),  // Flag only
  // ...
});
```

**Message Handling (`server/websocket/handlers/messageHandler.ts`):**
```typescript
const [msg] = await tx.insert(dbMessages).values({
  loungeId: targetLoungeId!,
  senderId: client.userId,
  content: message.content || '',  // Stored exactly as received
  clientMsgId: clientMsgId,
  sequenceId: nextSeq,
  encrypted: !!message.is_encrypted,  // Flag only, no transformation
  // ...
}).returning();
```

**Key Management (`server/v2/services/crypto/prekeyVaultService.ts`):**
- Stores public identity keys and signed prekeys
- Acts as a key directory for E2EE
- NO private keys stored on server
- NO decryption capabilities

### Client-Side Encryption Implementation

**Stateless E2EE (`src/services/statelessE2eeService.ts`):**
- Uses ephemeral ECDH + AES-256-GCM for DMs
- Wire format: `e2ee:v1:<ephPubKeyHex>:<ivHex>:<tagHex>:<ciphertextHex>`
- Keys stored in user-isolated IndexedDB
- Server NEVER sees private keys

**Lounge Encryption (`src/services/encryptionService.ts`):**
- DMs: Stateless ECDH (e2ee:v1:)
- Lounges: Simple XOR encryption (`VEL_E2EE[...]`)
- Server acts as blind relay for both formats

**Message Decryption (`src/components/Chat/hooks/useMessageDecryption.ts`):**
- Decrypts messages client-side only
- Caches decrypted plaintext in memory and IndexedDB
- Server never involved in decryption process

### Potential Issues Found

**Issue 1: Plaintext Persistence in IndexedDB**
- Decrypted messages stored as `plaintext` field in IndexedDB
- This is intentional for offline access but creates data leakage risk
- If device is compromised, decrypted messages are accessible

**Issue 2: Lounge XOR Encryption Weakness**
- Lounge messages use simple XOR with room ID as key
- `VEL_E2EE[<xor_content>]` format is easily reversible
- Should be upgraded to proper encryption for lounges

**Issue 3: Missing Device Isolation**
- IndexedDB uses user ID but not device ID
- Same user across devices shares decryption cache
- Could lead to cross-device plaintext leakage

**Issue 4: No Forward Secrecy for Lounges**
- Lounge XOR key is static (based on room ID)
- Compromised key reveals all historical messages
- Should implement ratchet for lounge messages

### Server Behavior Verification

**Message Flow:**
1. Client encrypts message → `e2ee:v1:...` format
2. Server stores encrypted content AS-IS in database
3. Server broadcasts encrypted content AS-IS to recipients
4. Recipients decrypt using their private keys
5. Server NEVER attempts decryption

**Key Management:**
- Server stores ONLY public keys (identity keys, signed prekeys)
- Private keys stored ONLY in client IndexedDB
- Server has NO decryption capabilities

### Current Architecture Strengths

1. **True Blind Relay**: Server stores and forwards encrypted content without transformation
2. **Stateless E2EE**: Each DM uses fresh ephemeral keys (forward secrecy)
3. **Client-Side Decryption**: All decryption happens on user devices
4. **Public Key Directory**: Server only manages public key distribution

### Recommended Improvements

**Immediate:**
1. **Add device-specific IndexedDB isolation**
   - Include device ID in database naming
   - Prevent cross-device plaintext leakage

2. **Implement secure plaintext storage**
   - Encrypt plaintext at rest in IndexedDB
   - Use local vault encryption for decrypted messages

3. **Upgrade lounge encryption**
   - Replace XOR with proper AES-GCM
   - Implement ratchet for forward secrecy

**Long-term:**
1. **Add message key rotation**
   - Periodic re-encryption of stored messages
   - Compromise recovery mechanisms

2. **Implement secure enclave**
   - Consider hardware security modules for key storage
   - Enhanced protection for private keys

### Conclusion

**Your server is correctly acting as a blind relay.** The current implementation:
- Does NOT encrypt/decrypt messages at rest
- Stores encrypted content exactly as received from clients
- Has no access to private decryption keys
- Forward all transformations happen client-side

The issues you're experiencing with cross-device message corruption are likely due to:
1. IndexedDB plaintext caching without device isolation
2. Lounge XOR encryption weakness
3. Missing secure storage for decrypted messages

The server encryption functions (`encryptAsync`, `decryptAsync`) are used only for authentication, password hashing, and server configuration - NOT for message content.
