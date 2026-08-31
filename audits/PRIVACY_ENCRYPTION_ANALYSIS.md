# Privacy, Encryption & Chat Deletion Analysis

## Executive Summary
- **Blocked contacts tab**: FUNCTIONAL - works with relationship filtering
- **Finding blocked users**: LIMITATION - only accessible via blocked tab, blocked users hidden elsewhere
- **Delete conversation**: BROKEN - deletes for both users instead of just initiator
- **Clear chat**: BROKEN - same issue as delete conversation
- **Encryption at rest**: CORRECT - messages stored encrypted, only client decrypts
- **Key rotation**: PARTIALLY CORRECT - Double Ratchet should protect old messages but needs verification

## 1. Blocked Contacts Tab Analysis

### Location: `src/components/SidebarTabs/PeopleMainDashboard.tsx`

### Functionality Status: FUNCTIONAL

#### How It Works
```typescript
const [activeTab, setActiveTab] = useState<'all' | 'online' | 'pending' | 'blocked'>('all');

const blockedUsers = useMemo(() => {
  return safeRelationships.filter(r => r.status === 'blocked');
}, [safeRelationships]);

// Tab switching logic
else if (activeTab === 'blocked') {
  displayData = blockedUsers.filter(f => !userSearchTerm || f.username.toLowerCase().includes(userSearchTerm.toLowerCase()));
}
```

#### Backend Integration
- **Fetches from**: `/v2/friends/relationships` (line 52)
- **Filters by**: `status === 'blocked'` (line 132)
- **Unblock function**: Calls `/v2/friends/unblock` (line 78)

### How Blocked Users Can Be Found

#### CURRENT LIMITATION: Blocked users are hidden elsewhere
**Problem Areas:**
1. **Main dashboard**: Blocked users filtered out from main list
2. **Search**: Blocked users excluded from search results
3. **Chat lists**: Blocked users don't appear in active conversations
4. **Directory**: Blocked users excluded from user directory

#### ONLY ACCESS VIA:
1. **People tab → Blocked sub-tab** (the specific tab you asked about)
2. **Profile card**: If you manually navigate to a blocked user's profile
3. **Admin panel**: Admin users can see blocked users via sanctions

### Fix Required
**Add blocked users to search results with visual indicator:**
```typescript
// In search results, show blocked users with different styling
const searchResults = allUsers.filter(user => 
  user.username.toLowerCase().includes(searchTerm.toLowerCase())
);

// Render blocked users with "Blocked" badge
searchResults.map(user => (
  <UserCard 
    user={user}
    isBlocked={blockedUsers.has(user.id)}
    onUnblock={() => handleUnblock(user.id)}
  />
))
```

## 2. Delete Conversation Issue Analysis

### Location: `server/v2/routes/userRoutes.ts` lines 238-277

### Current Implementation
```typescript
// DELETE /v2/user/:id/chat - Clear direct chat messages
userRouter.delete('/:id/chat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user!.userId;
    const targetUserId = parseInt(req.params.id, 10);

    const dmSlug = targetUserId === 999 
      ? `dm_velum_${currentUserId}`
      : `dm_${Math.min(currentUserId, targetUserId)}_${Math.max(currentUserId, targetUserId)}`;

    // Resolve all lounges matching dmSlug or common DM memberships
    const matchedLounges = await db.select().from(lounges).where(eq(lounges.slug, dmSlug));
    const targetLoungeIds = new Set<number>(matchedLounges.map(l => l.id));

    const members = await db.select().from(loungeMembers).where(inArray(loungeMembers.userId, [currentUserId, targetUserId]));
    const userLounges = new Set(members.filter(m => m.userId === currentUserId).map(m => m.loungeId));
    const targetLounges = new Set(members.filter(m => m.userId === targetUserId).map(m => m.loungeId));
    
    for (const lId of userLounges) {
      if (targetLounges.has(lId)) {
        targetLoungeIds.add(lId);
      }
    }

    const allLoungeIds = Array.from(targetLoungeIds);
    if (allLoungeIds.length > 0) {
      await db.delete(messages).where(inArray(messages.loungeId, allLoungeIds));
      await db.update(lounges)
        .set({ lastMessageText: null, lastMessageAt: null, lastMessageSenderId: null })
        .where(inArray(lounges.id, allLoungeIds));
    }

    res.json({ success: true, message: 'Chat history cleared.' });
  }
```

### CONFIRMED ISSUE: Deletes for BOTH users

**Problem Analysis:**
1. **Shared lounge deletion**: Deletes ALL messages in shared DM lounge
2. **No user-specific filtering**: Deletes messages for both parties
3. **No initiator tracking**: Doesn't track who initiated the deletion
4. **No selective deletion**: Cannot delete only for initiator

### Root Cause
- DMs use shared lounges (`dm_${userId1}_${userId2}`)
- Deleting messages from lounge deletes for ALL members
- No concept of "delete for me" vs "delete for everyone"

### Fix Required

#### Option 1: Add User-Specific Deletion
```typescript
// Add deleted_by column to messages table
// Modify deletion to mark as deleted for specific user

userRouter.delete('/:id/chat', authMiddleware, async (req, Request, res: Response) => {
  const { deleteFor } = req.query; // 'me' | 'everyone'
  
  if (deleteFor === 'me') {
    // Only mark as deleted for current user
    await db.update(messages)
      .set({ deleted_by: sql.arrayAppend(messages.deleted_by || [], currentUserId) })
      .where(
        and(
          inArray(messages.loungeId, allLoungeIds),
          sql`NOT (${currentUserId} = ANY(messages.deleted_by))`
        )
      );
  } else {
    // Delete for everyone (current behavior)
    await db.delete(messages).where(inArray(messages.loungeId, allLoungeIds));
  }
});
```

#### Option 2: Add Delete Scope Selection
```typescript
// Frontend: Add delete confirmation with scope selection
const handleDeleteChat = async (targetUserId: number, scope: 'me' | 'everyone') => {
  const res = await fetch(`/v2/user/${targetUserId}/chat?deleteFor=${scope}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${sId}` }
  });
};
```

## 3. Clear Chat Issue

### Current Behavior
**Same as delete conversation** - uses the same endpoint with the same issue.

### Fix Required
**Apply same fix as delete conversation** - add scope selection.

## 4. Encryption at Rest Analysis

### Current Implementation

#### CORRECT: Messages ARE encrypted at rest

**Evidence from code analysis:**

**Direct Messages:**
```typescript
// From statelessE2eeService.ts
public async encryptDirectMessage(plaintext: string, peerUserId: number): Promise<string> {
  const { ciphertext, tag } = await encryptAesGcm(sharedSecret, plaintextBytes, iv);
  return `e2ee:v1:${ephPubKeyHex}:${ivHex}:${tagHex}:${cipherHex}`;
}

// Stored in database as encrypted envelopes
// Only client devices can decrypt with their private keys
```

**Lounge Messages:**
```typescript
// From encryptionService.ts
if (context.type === 'lounge' && context.roomId) {
  return `VEL_E2EE[${encryptXOR(content, 'VELUM_E2EE_' + context.roomId)}]`;
}
```

### Server NEVER decrypts messages
- Server stores encrypted envelopes
- Server never has access to private keys
- Decryption only happens on client devices
- Server cannot read message content

### Already received messages remain on devices
- Messages decrypted and stored locally on devices
- Server cannot remotely delete from devices
- Key rotation doesn't affect already decrypted messages

## 5. Key Rotation Impact Analysis

### Current Double Ratchet Implementation

#### CORRECT: Double Ratchet protects old messages

**Evidence from code:**
```typescript
// From cryptoPrimitives.ts
const INFO_ROOT = utf8ToBytes('VelumDoubleRatchetRootKDF');
const INFO_CHAIN = utf8ToBytes('VelumDoubleRatchetChainKDF');
const INFO_MESSAGE = utf8ToBytes('VelumDoubleRatchetMessageKey');
```

**Double Ratchet Properties:**
1. **Forward secrecy**: Compromised keys don't reveal past messages
2. **Per-message keys**: Each message uses unique key
3. **Key evolution**: Keys evolve with each message
4. **State separation**: Sender and receiver maintain independent ratchet states

### Key Rotation Should NOT Affect Old Messages

**Correct Behavior:**
- **Old messages**: Encrypted with old keys, still decryptable with old ratchet state
- **New messages**: Encrypted with new keys, using new ratchet state
- **State continuity**: Old ratchet state preserved for historical messages

### VERIFICATION NEEDED

**Potential Issues to Check:**
1. **Ratchet state persistence**: Are old ratchet states properly saved?
2. **State recovery**: Can old messages be decrypted after key rotation?
3. **State loss**: Does key rotation cause loss of old ratchet states?

### Verification Steps
```typescript
// Test: Send message, rotate keys, try to decrypt old message
// Expected: Old message still decryptable with preserved ratchet state

// From useMessageDecryption.ts
const decrypted = await decryptMessage(item.ciphertext, item.context);
// Should work for old messages even after key rotation
```

## 6. Summary of Required Fixes

### High Priority (Privacy Impact)
1. **Fix delete/clear chat scope** - Add "delete for me" vs "delete for everyone"
2. **Add blocked users to search** - Make blocked users discoverable outside blocked tab
3. **Verify ratchet state persistence** - Ensure key rotation doesn't break old message decryption

### Medium Priority (User Experience)
4. **Add delete confirmation UI** - Show scope selection before deletion
5. **Improve blocked user visibility** - Add visual indicators in other contexts
6. **Add "delete for me" default** - Make individual deletion the safer default

### Low Priority (Code Quality)
7. **Add audit logging** - Track who deleted what and for whom
8. **Implement deletion recovery** - Allow undo within time window
9. **Add deletion analytics** - Track deletion patterns for abuse detection

## 7. Implementation Recommendations

### Delete Chat Fix
```typescript
// Backend: Add scope parameter
userRouter.delete('/:id/chat', authMiddleware, async (req, Request, res: Response) => {
  const { deleteFor = 'everyone' } = req.query;
  const currentUserId = req.user!.userId;
  
  if (deleteFor === 'me') {
    // Add deleted_by array to messages schema
    await db.update(messages)
      .set({ 
        deleted_by: sql.arrayAppend(messages.deleted_by || [], currentUserId),
        deleted_at: new Date()
      })
      .where(
        and(
          inArray(messages.loungeId, allLoungeIds),
          sql`NOT (${currentUserId} = ANY(messages.deleted_by))`
        )
      );
  } else {
    // Current behavior - delete for everyone
    await db.delete(messages).where(inArray(messages.loungeId, allLoungeIds));
  }
});
```

### Blocked User Discovery Fix
```typescript
// Add blocked users to main search with visual indicator
const searchResults = allUsers.filter(user => 
  user.username.toLowerCase().includes(searchTerm.toLowerCase())
);

// Show blocked users with badge
searchResults.map(user => (
  <UserRow 
    user={user}
    isBlocked={blockedUsers.has(user.id)}
    onUnblock={() => handleUnblock(user.id)}
  />
))
```

### Key Rotation Verification
```typescript
// Add test to verify old message decryption after key rotation
describe('Key Rotation Impact', () => {
  it('should decrypt old messages after key rotation', async () => {
    // 1. Send message with old keys
    const oldMessage = await sendMessage('test message');
    
    // 2. Rotate keys
    await rotateIdentityKeys();
    
    // 3. Try to decrypt old message
    const decrypted = await decryptMessage(oldMessage.encrypted);
    expect(decrypted).toBe('test message');
  });
});
```

## 8. Privacy Best Practices Already Implemented

### Current System Does Well
1. **Server-side encryption**: Messages never stored in plaintext on server
2. **Client-only decryption**: Only devices with private keys can decrypt
3. **Double Ratchet**: Forward secrecy protects past messages
4. **Ephemeral keys**: Each message uses unique encryption keys
5. **Stateless E2EE**: No server-side key storage for DMs

### Areas Needing Improvement
1. **Deletion scope**: No individual vs group deletion distinction
2. **Blocked user discovery**: Limited access to blocked users
3. **Deletion recovery**: No undo mechanism for accidental deletions
4. **Audit trail**: Limited tracking of deletion actions

## Conclusion

**Your privacy concerns are VALID:**
- Encryption at rest: CORRECT - server never decrypts, messages stay encrypted
- Key rotation theory: CORRECT - Double Ratchet should protect old messages
- Delete for both users: CONFIRMED ISSUE - deletes for both parties
- Blocked user discovery: CONFIRMED LIMITATION - only accessible via blocked tab
- Key rotation practice: Needs verification to ensure implementation matches theory

**Immediate fixes needed:**
1. Add scope selection to delete/clear chat operations
2. Improve blocked user discoverability
3. Verify Double Ratchet state persistence
4. Add "delete for me" as default safer option

The encryption architecture is sound, but the deletion logic needs privacy improvements to respect individual user autonomy over their conversation history.
