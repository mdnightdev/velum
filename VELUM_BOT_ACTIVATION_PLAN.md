# Velum Bot Activation Plan

**Goal**: Activate Velum Bot system for automated credential delivery and admin broadcasting  
**Current Status**: Infrastructure exists but not integrated  
**Effort**: 6-8 hours

**Important Constraints:**
- Velum Bot is ONE-WAY communication only (delivers messages, locked from receiving/replies)
- Support admins get SEPARATE admin accounts (don't convert existing user accounts)
- Regular user accounts remain unchanged when users become support admins

---

## 1. Current State Analysis

### What Exists:
- ✅ Velum Bot user (userId: 999) seeded in database
- ✅ Complete SystemBot service with broadcast/alert/user messaging
- ✅ Recovery key generation in registration flow
- ✅ WebSocket infrastructure for DM messaging
- ✅ DM room creation (`dm_velum_${userId}`)

### What's Missing:
- ❌ SystemBot service never imported or used
- ❌ Recovery keys shown in UI, not delivered via bot DM
- ❌ Admin credentials only in environment variables
- ❌ No admin interface for sending broadcasts
- ❌ No welcome message system for new users

---

## 2. Implementation Plan

### Phase 1: Activate SystemBot Service
**Priority**: HIGH  
**Effort**: 1 hour

#### 2.1 Import and Initialize SystemBot
**File**: `/root/velum/server/index.ts`

```typescript
// Add import
import { SystemBot } from './v2/services/systemBot.js';

// Initialize after server starts
const systemBot = SystemBot.getInstance();
console.log('[Server] Velum Bot system activated');
```

#### 2.2 Make SystemBot Accessible Globally
**File**: `/root/velum/server/websocket.ts`

```typescript
// Import and export
import { SystemBot } from './v2/services/systemBot.js';

export { SystemBot };
```

---

### Phase 2: Recovery Key Delivery via Bot
**Priority**: HIGH  
**Effort**: 2 hours

#### 2.1 Modify Registration Controller
**File**: `/root/velum/server/v2/controllers/authController.ts`

**Current** (lines 167-177):
```typescript
res.status(201).json({
  token,
  recoveryKey,  // PLAINTEXT key returned in response
  user: { /* user object */ }
});
```

**Modified**:
```typescript
// Send recovery key via Velum Bot
const systemBot = SystemBot.getInstance();
await systemBot.sendToUser(newUser.id, 
  `Welcome to Velum! Your recovery key is: ${recoveryKey}\n\n` +
  `Save this key securely. You'll need it to recover your account if you forget your credentials.`
);

res.status(201).json({
  token,
  user: {
    userId: newUser.id,
    username: newUser.username,
    role: newUser.role,
    displayName: newUser.displayName,
    avatarUrl: newUser.avatarUrl
  }
});
```

#### 2.2 Remove Recovery Key from Frontend Display
**File**: `/root/velum/src/components/AuthPortal.tsx`

**Current** (lines 271-274):
```typescript
const keyMsg = data.recoveryKey 
  ? `Registration complete. Save your recovery key securely: ${data.recoveryKey}`
  : 'Registration complete. Proceed to sign in.';
setRecoverySuccessMessage(keyMsg);
```

**Modified**:
```typescript
setRecoverySuccessMessage(
  'Registration complete. Check your Velum Bot DM for your recovery key.'
);
```

#### 2.3 Auto-Join Bot DM on Registration
**File**: `/root/velum/src/hooks/useWebSocket.ts`

```typescript
// After successful registration, auto-join bot DM
const joinBotDM = (userId: number) => {
  const botRoomId = `dm_velum_${userId}`;
  joinRoom(botRoomId);
};

// Call this after registration success
```

---

### Phase 3: Support Admin Nomination System
**Priority**: HIGH  
**Effort**: 5 hours

#### 3.1 Database Schema for Nominations
**File**: `/root/velum/server/v2/db/schema/users.ts`

```typescript
// Add new table for support admin nominations
export const supportAdminNominations = pgTable('support_admin_nominations', {
  id: serial('id').primaryKey(),
  nominatedUserId: integer('nominated_user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  nominatedBy: integer('nominated_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  status: varchar('status', { length: 32 }).default('pending').notNull(), // pending, approved, rejected, accepted, declined
  adminAccountId: integer('admin_account_id'), // Reference to created admin account
  credentials: text('credentials'), // Encrypted credentials storage
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  index('idx_nominations_user').on(table.nominatedUserId),
  index('idx_nominations_status').on(table.status)
]);
```

#### 3.2 LOGIN_ADMIN Nomination
**File**: `/root/velum/server/v2/routes/adminRoutes.ts`

```typescript
// POST /v2/admin/nominate-support - LOGIN_ADMIN nominates user for support admin
adminRouter.post('/nominate-support', auth, async (req: Request, res: Response) => {
  try {
    const { targetUserId } = req.body;
    
    // Verify LOGIN_ADMIN or CLI_ADMIN can nominate
    if (!['LOGIN_ADMIN', 'CLI_ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only LOGIN_ADMIN or CLI_ADMIN can nominate support admins' });
    }
    
    // Get target user info
    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user already has pending or active nomination
    const existingNomination = await db.select().from(supportAdminNominations).where(
      and(
        eq(supportAdminNominations.nominatedUserId, targetUserId),
        inArray(supportAdminNominations.status, ['pending', 'approved', 'accepted'])
      )
    ).limit(1);
    
    if (existingNomination.length > 0) {
      return res.status(400).json({ error: 'User already has a pending or active support admin nomination' });
    }
    
    // Create nomination
    const [nomination] = await db.insert(supportAdminNominations).values({
      nominatedUserId: targetUserId,
      nominatedBy: req.user!.userId,
      status: 'pending'
    }).returning();
    
    res.json({ 
      success: true, 
      nominationId: nomination.id,
      message: 'User nominated for support admin role, awaiting CLI_ADMIN approval'
    });
  } catch (err) {
    console.error('Failed to nominate support admin:', err);
    res.status(500).json({ error: 'Failed to create nomination' });
  }
});
```

#### 3.3 CLI_ADMIN Approval/Rejection
**File**: `/root/velum/server/v2/routes/adminRoutes.ts`

```typescript
// POST /v2/admin/approve-nomination - CLI_ADMIN approves nomination
adminRouter.post('/approve-nomination', auth, async (req: Request, res: Response) => {
  try {
    const { nominationId } = req.body;
    
    // Verify only CLI_ADMIN can approve
    if (req.user!.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'Only CLI_ADMIN can approve nominations' });
    }
    
    // Get nomination details
    const [nomination] = await db.select().from(supportAdminNominations).where(eq(supportAdminNominations.id, nominationId)).limit(1);
    if (!nomination) {
      return res.status(404).json({ error: 'Nomination not found' });
    }
    
    if (nomination.status !== 'pending') {
      return res.status(400).json({ error: 'Nomination is not in pending status' });
    }
    
    // Get nominated user info
    const [targetUser] = await db.select().from(users).where(eq(users.id, nomination.nominatedUserId)).limit(1);
    if (!targetUser) {
      return res.status(404).json({ error: 'Nominated user not found' });
    }
    
    // Generate separate admin credentials (INACTIVE until user accepts)
    const adminPassword = generateSecurePassword();
    const adminSalt = crypto.randomBytes(16).toString('hex');
    const adminPasswordHash = await hashArgon2id(adminPassword, Buffer.from(adminSalt, 'hex'));
    const adminRecoveryKey = `VEL-SUP-${Math.floor(10000 + Math.random() * 90000)}`;
    const adminRecoveryKeyHash = await hashArgon2id(adminRecoveryKey, Buffer.from(adminSalt, 'hex'));
    
    // Create INACTIVE support admin account
    const [newAdmin] = await db.insert(users).values({
      username: `support_${targetUser.username}`,
      passwordHash: adminPasswordHash,
      salt: adminSalt,
      role: 'SUPPORT_ADMIN',
      displayName: `${targetUser.displayName || targetUser.username} (Support)`,
      recoveryKeyHash: adminRecoveryKeyHash,
      duressActive: true // Mark as inactive/duress until accepted
    }).returning();
    
    // Store credentials encrypted in nomination
    const credentialsData = JSON.stringify({
      username: `support_${targetUser.username}`,
      password: adminPassword,
      recoveryKey: adminRecoveryKey
    });
    
    // Update nomination with admin account and credentials
    await db.update(supportAdminNominations)
      .set({ 
        status: 'approved',
        adminAccountId: newAdmin.id,
        credentials: credentialsData,
        updatedAt: new Date()
      })
      .where(eq(supportAdminNominations.id, nominationId));
    
    // Send approval notification via Velum Bot (WITHOUT credentials yet)
    const systemBot = SystemBot.getInstance();
    await systemBot.sendToUser(nomination.nominatedUserId,
      `You have been nominated and APPROVED for the Velum Support Administrator role.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `NEXT STEPS:\n` +
      `• Your support admin credentials have been generated\n` +
      `• You must ACCEPT this role to activate your credentials\n` +
      `• If you DECLINE, the credentials will be purged\n\n` +
      `To ACCEPT or DECLINE this role, please respond to this message with:\n` +
      `"!accept-support" or "!decline-support"\n\n` +
      `This nomination will expire in 7 days if no action is taken.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );
    
    res.json({ 
      success: true, 
      message: 'Nomination approved, credentials generated and awaiting user acceptance'
    });
  } catch (err) {
    console.error('Failed to approve nomination:', err);
    res.status(500).json({ error: 'Failed to approve nomination' });
  }
});

// POST /v2/admin/reject-nomination - CLI_ADMIN rejects nomination
adminRouter.post('/reject-nomination', auth, async (req: Request, res: Response) => {
  try {
    const { nominationId, reason } = req.body;
    
    // Verify only CLI_ADMIN can reject
    if (req.user!.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'Only CLI_ADMIN can reject nominations' });
    }
    
    // Get nomination details
    const [nomination] = await db.select().from(supportAdminNominations).where(eq(supportAdminNominations.id, nominationId)).limit(1);
    if (!nomination) {
      return res.status(404).json({ error: 'Nomination not found' });
    }
    
    if (nomination.status !== 'pending') {
      return res.status(400).json({ error: 'Nomination is not in pending status' });
    }
    
    // Update nomination status
    await db.update(supportAdminNominations)
      .set({ 
        status: 'rejected',
        updatedAt: new Date()
      })
      .where(eq(supportAdminNominations.id, nominationId));
    
    // Notify user via Velum Bot
    const systemBot = SystemBot.getInstance();
    await systemBot.sendToUser(nomination.nominatedUserId,
      `Your nomination for the Velum Support Administrator role has been declined.\n\n` +
      `Reason: ${reason || 'No reason provided'}\n\n` +
      `Your regular user account remains unchanged and unaffected.`
    );
    
    res.json({ 
      success: true, 
      message: 'Nomination rejected and user notified'
    });
  } catch (err) {
    console.error('Failed to reject nomination:', err);
    res.status(500).json({ error: 'Failed to reject nomination' });
  }
});
```

#### 3.4 User Accept/Decline
**File**: `/root/velum/server/websocket.ts`

```typescript
// Add user response handler for support admin nominations
async function handleSupportAdminResponse(client: ClientConnection, message: any) {
  const content = message.content?.toLowerCase();
  
  if (content === '!accept-support') {
    await handleAcceptSupportAdmin(client);
  } else if (content === '!decline-support') {
    await handleDeclineSupportAdmin(client);
  }
}

async function handleAcceptSupportAdmin(client: ClientConnection) {
  try {
    // Find user's approved nomination
    const [nomination] = await db.select().from(supportAdminNominations).where(
      and(
        eq(supportAdminNominations.nominatedUserId, client.userId),
        eq(supportAdminNominations.status, 'approved')
      )
    ).limit(1);
    
    if (!nomination) {
      client.ws.send(JSON.stringify({
        type: 'system_alert',
        message: 'You do not have a pending support admin nomination to accept.'
      }));
      return;
    }
    
    // Activate admin account
    if (nomination.adminAccountId) {
      await db.update(users)
        .set({ duressActive: false }) // Activate account
        .where(eq(users.id, nomination.adminAccountId));
    }
    
    // Update nomination status
    await db.update(supportAdminNominations)
      .set({ 
        status: 'accepted',
        updatedAt: new Date()
      })
      .where(eq(supportAdminNominations.id, nomination.id));
    
    // Send credentials via Velum Bot
    const systemBot = SystemBot.getInstance();
    const credentials = JSON.parse(nomination.credentials || '{}');
    
    await systemBot.sendToUser(client.userId,
      `You have ACCEPTED the Velum Support Administrator role.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `YOUR SUPPORT ADMIN CREDENTIALS:\n` +
      `Username: ${credentials.username}\n` +
      `Password: ${credentials.password}\n` +
      `Recovery Key: ${credentials.recoveryKey}\n\n` +
      `IMPORTANT:\n` +
      `• This is a SEPARATE account from your regular user account\n` +
      `• Use these credentials to access the Support Admin Panel\n` +
      `• Your regular user account remains unchanged\n` +
      `• Keep these credentials secure\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );
    
    // Notify admins of acceptance
    await notifyAdminsOfAcceptance(client.userId, nomination.nominatedBy);
    
  } catch (err) {
    console.error('Failed to accept support admin role:', err);
  }
}

async function handleDeclineSupportAdmin(client: ClientConnection) {
  try {
    // Find user's approved nomination
    const [nomination] = await db.select().from(supportAdminNominations).where(
      and(
        eq(supportAdminNominations.nominatedUserId, client.userId),
        eq(supportAdminNominations.status, 'approved')
      )
    ).limit(1);
    
    if (!nomination) {
      client.ws.send(JSON.stringify({
        type: 'system_alert',
        message: 'You do not have a pending support admin nomination to decline.'
      }));
      return;
    }
    
    // Purge the admin account
    if (nomination.adminAccountId) {
      await db.delete(users).where(eq(users.id, nomination.adminAccountId));
    }
    
    // Update nomination status
    await db.update(supportAdminNominations)
      .set({ 
        status: 'declined',
        credentials: '', // Clear credentials
        updatedAt: new Date()
      })
      .where(eq(supportAdminNominations.id, nomination.id));
    
    // Notify user via Velum Bot
    const systemBot = SystemBot.getInstance();
    await systemBot.sendToUser(client.userId,
      `You have DECLINED the Velum Support Administrator role.\n\n` +
      `The support admin credentials have been purged from the system.\n\n` +
      `Your regular user account remains unchanged and unaffected.`
    );
    
    // Notify admins of decline
    await notifyAdminsOfDecline(client.userId, nomination.nominatedBy);
    
  } catch (err) {
    console.error('Failed to decline support admin role:', err);
  }
}

async function notifyAdminsOfAcceptance(userId: number, nominatedBy: number) {
  const systemBot = SystemBot.getInstance();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  // Notify CLI_ADMINs and the nominating LOGIN_ADMIN
  const admins = await db.select().from(users).where(
    or(
      eq(users.role, 'CLI_ADMIN'),
      eq(users.id, nominatedBy)
    )
  );
  
  for (const admin of admins) {
    await systemBot.sendToUser(admin.id,
      `Support Admin Role ACCEPTED\n\n` +
      `User: ${user?.username} (ID: ${userId})\n` +
      `Status: Support admin credentials activated\n` +
      `Time: ${new Date().toISOString()}`
    );
  }
}

async function notifyAdminsOfDecline(userId: number, nominatedBy: number) {
  const systemBot = SystemBot.getInstance();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  // Notify CLI_ADMINs and the nominating LOGIN_ADMIN
  const admins = await db.select().from(users).where(
    or(
      eq(users.role, 'CLI_ADMIN'),
      eq(users.id, nominatedBy)
    )
  );
  
  for (const admin of admins) {
    await systemBot.sendToUser(admin.id,
      `Support Admin Role DECLINED\n\n` +
      `User: ${user?.username} (ID: ${userId})\n` +
      `Status: Support admin credentials purged\n` +
      `Time: ${new Date().toISOString()}`
    );
  }
}
```

#### 3.5 CLI_ADMIN Demotion
**File**: `/root/velum/server/v2/routes/adminRoutes.ts`

```typescript
// POST /v2/admin/demote-support - CLI_ADMIN demotes active support admin
adminRouter.post('/demote-support', auth, async (req: Request, res: Response) => {
  try {
    const { targetUserId } = req.body;
    
    // Verify only CLI_ADMIN can demote
    if (req.user!.role !== 'CLI_ADMIN') {
      return res.status(403).json({ error: 'Only CLI_ADMIN can demote support admins' });
    }
    
    // Get target user info
    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find and delete support admin account
    const adminUsername = `support_${targetUser.username}`;
    const deletedAdmin = await db.delete(users).where(
      and(
        eq(users.username, adminUsername),
        eq(users.role, 'SUPPORT_ADMIN')
      )
    ).returning();
    
    if (deletedAdmin.length === 0) {
      return res.status(404).json({ error: 'Support admin account not found' });
    }
    
    // Update any related nominations
    await db.update(supportAdminNominations)
      .set({ 
        status: 'revoked',
        updatedAt: new Date()
      })
      .where(eq(supportAdminNominations.nominatedUserId, targetUserId));
    
    // Notify user via Velum Bot
    const systemBot = SystemBot.getInstance();
    await systemBot.sendToUser(targetUserId,
      `Your Support Administrator access has been revoked by CLI_ADMIN.\n\n` +
      `Your regular user account remains unchanged and unaffected.`
    );
    
    res.json({ 
      success: true, 
      message: 'Support admin account revoked'
    });
  } catch (err) {
    console.error('Failed to demote support admin:', err);
    res.status(500).json({ error: 'Failed to demote support admin account' });
  }
});
```

#### 3.6 List Nominations and Support Admins
**File**: `/root/velum/server/v2/routes/adminRoutes.ts`

```typescript
// GET /v2/admin/support-nominations - List all nominations
adminRouter.get('/support-nominations', auth, async (req: Request, res: Response) => {
  try {
    // Verify admin access
    if (!['ADMIN', 'CLI_ADMIN', 'LOGIN_ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const nominations = await db.select({
      id: supportAdminNominations.id,
      nominatedUserId: supportAdminNominations.nominatedUserId,
      nominatedBy: supportAdminNominations.nominatedBy,
      status: supportAdminNominations.status,
      createdAt: supportAdminNominations.createdAt
    })
    .from(supportAdminNominations)
    .orderBy(desc(supportAdminNominations.createdAt));
    
    // Enrich with user details
    const enrichedNominations = await Promise.all(nominations.map(async (nomination) => {
      const [nominatedUser] = await db.select().from(users).where(eq(users.id, nomination.nominatedUserId)).limit(1);
      const [nominatedByUser] = await db.select().from(users).where(eq(users.id, nomination.nominatedBy)).limit(1);
      
      return {
        ...nomination,
        nominatedUser: {
          id: nominatedUser?.id,
          username: nominatedUser?.username,
          displayName: nominatedUser?.displayName
        },
        nominatedBy: {
          id: nominatedByUser?.id,
          username: nominatedByUser?.username,
          displayName: nominatedByUser?.displayName
        }
      };
    }));
    
    res.json({ nominations: enrichedNominations });
  } catch (err) {
    console.error('Failed to list nominations:', err);
    res.status(500).json({ error: 'Failed to list nominations' });
  }
});

// GET /v2/admin/support-admins - List active support admins
adminRouter.get('/support-admins', auth, async (req: Request, res: Response) => {
  try {
    // Verify admin access
    if (!['ADMIN', 'CLI_ADMIN', 'SUPPORT_ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const supportAdmins = await db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      duressActive: users.duressActive,
      createdAt: users.createdAt
    })
    .from(users)
    .where(and(eq(users.role, 'SUPPORT_ADMIN'), eq(users.duressActive, false))); // Only active admins
    
    // Map back to original user accounts
    const adminsWithUsers = await Promise.all(supportAdmins.map(async (admin) => {
      const originalUsername = admin.username.replace('support_', '');
      const [originalUser] = await db.select().from(users).where(eq(users.username, originalUsername)).limit(1);
      return {
        ...admin,
        originalUserId: originalUser?.id,
        originalUsername: originalUser?.username,
        originalDisplayName: originalUser?.displayName
      };
    }));
    
    res.json({ supportAdmins: adminsWithUsers });
  } catch (err) {
    console.error('Failed to list support admins:', err);
    res.status(500).json({ error: 'Failed to list support admins' });
  }
});
```

// Helper function for secure password generation
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

---

### Phase 4: Admin Broadcast System
**Priority**: MEDIUM  
**Effort**: 2 hours

#### 4.1 Admin Broadcast Route
**File**: `/root/velum/server/v2/routes/adminRoutes.ts`

```typescript
// POST /v2/admin/broadcast - Send system broadcast
adminRouter.post('/broadcast', auth, async (req: Request, res: Response) => {
  try {
    const { message, target } = req.body;
    const currentUserId = req.user!.userId;
    
    // Verify admin role
    if (!['ADMIN', 'CLI_ADMIN', 'LOGIN_ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const systemBot = SystemBot.getInstance();
    
    if (target === 'all') {
      // Broadcast to all connected users
      systemBot.sendToAll(`[Broadcast from ${req.user!.username}]: ${message}`);
    } else if (target === 'room') {
      // Broadcast to specific room
      const { roomId } = req.body;
      systemBot.sendBroadcast(roomId, message, req.user!.username);
    } else if (typeof target === 'number') {
      // Send to specific user
      await systemBot.sendToUser(target, `[Admin Message]: ${message}`);
    }
    
    res.json({ success: true, message: 'Broadcast sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});
```

#### 4.2 Admin Broadcast UI
**File**: `/root/velum/src/views/AdminControlDesk/index.tsx`

```typescript
// Add broadcast component
const AdminBroadcastPanel = () => {
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'all' | 'room' | 'user'>('all');
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  
  const sendBroadcast = async () => {
    const response = await fetch('/v2/admin/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message,
        target: target === 'user' ? parseInt(userId) : target,
        roomId: target === 'room' ? roomId : undefined
      })
    });
    
    if (response.ok) {
      setMessage('');
      // Show success notification
    }
  };
  
  return (
    <div className="bg-gray-800 p-4 rounded">
      <h3 className="text-white mb-4">System Broadcast</h3>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Enter broadcast message..."
        className="w-full bg-gray-700 text-white p-2 rounded mb-4"
      />
      <select 
        value={target}
        onChange={(e) => setTarget(e.target.value as any)}
        className="bg-gray-700 text-white p-2 rounded mb-4"
      >
        <option value="all">All Users</option>
        <option value="room">Specific Room</option>
        <option value="user">Specific User</option>
      </select>
      {target === 'room' && (
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Room ID"
          className="w-full bg-gray-700 text-white p-2 rounded mb-4"
        />
      )}
      {target === 'user' && (
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="User ID"
          className="w-full bg-gray-700 text-white p-2 rounded mb-4"
        />
      )}
      <button
        onClick={sendBroadcast}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Send Broadcast
      </button>
    </div>
  );
};
```

---

### Phase 5: Welcome Message System
**Priority**: LOW  
**Effort**: 1 hour

#### 5.1 Enhanced Welcome Message
**File**: `/root/velum/server/v2/controllers/authController.ts`

```typescript
// Enhanced welcome message with guidance
await systemBot.sendToUser(newUser.id,
  `Welcome to Velum, ${username}! 🎉\n\n` +
  `Your recovery key is: ${recoveryKey}\n\n` +
  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
  `GETTING STARTED:\n` +
  `• Join lounges to connect with communities\n` +
  `• Send direct messages to other users\n` +
  `• Check your Velum Bot DM for system notifications\n\n` +
  `SECURITY:\n` +
  `• Save your recovery key securely\n` +
  `• Never share your credentials\n` +
  `• Use panic phrase if compromised\n\n` +
  `Need help? Contact an administrator.\n` +
  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
);
```

#### 5.2 Bot One-Way Communication Lock
**File**: `/root/velum/server/websocket.ts`

```typescript
// Add bot message rejection in handleSendMessage
async function handleSendMessage(client: ClientConnection, message: any) {
  const roomId = message.room_id ? message.room_id.toString() : '';
  
  // REJECT messages to Velum Bot (one-way communication only)
  if (roomId.startsWith('dm_velum_')) {
    console.warn('[WS] Attempt to send message to Velum Bot rejected - one-way communication only');
    return;
  }
  
  // Rest of existing message handling...
}
```

---

## 3. Security Considerations

### 3.1 Credential Security
- ✅ Recovery keys still hashed in database
- ✅ Only plaintext in DM (user can delete after saving)
- ✅ Support admin credentials only sent to user's regular account DM
- ✅ Bot messages are not encrypted (system messages)
- ✅ Separate support admin accounts prevent privilege escalation

### 3.2 Access Control
- ✅ Admin broadcast routes require admin role
- ✅ Only CLI_ADMIN can appoint/revoke support admins
- ✅ Bot communication is one-way (users cannot reply to bot)
- ✅ System messages cannot be spoofed (bot userId: 999)

### 3.3 Account Separation
- ✅ Support admin accounts use `support_{username}` naming convention
- ✅ Regular user accounts remain unchanged when appointed as support admin
- ✅ Support admin accounts have separate credentials and recovery keys
- ✅ Revoking support admin access deletes only the admin account, not user account

### 3.4 Audit Logging
**Add to SystemBot**:
```typescript
private logBotAction(action: string, target: number | string, details: string) {
  console.log(`[SystemBot] ${action} -> ${target}: ${details}`);
  // Could also write to audit_logs table
}
```

---

## 4. Testing Checklist

### Phase 1 Testing
- [ ] SystemBot initializes without errors
- [ ] Bot accessible from server context
- [ ] No memory leaks from singleton pattern

### Phase 2 Testing
- [ ] New user receives recovery key in DM
- [ ] Recovery key not shown in registration UI
- [ ] Bot DM auto-joins after registration
- [ ] Recovery key format correct (VEL-REC-XXXXX)

### Phase 3 Testing (Support Admin Nomination System)
- [ ] LOGIN_ADMIN can nominate users for support admin role
- [ ] CLI_ADMIN can also nominate users
- [ ] Nominations created with 'pending' status
- [ ] Duplicate nominations prevented for same user
- [ ] CLI_ADMIN can approve pending nominations
- [ ] CLI_ADMIN can reject pending nominations with reason
- [ ] Approved nominations create INACTIVE admin account (duressActive: true)
- [ ] Credentials stored securely in nomination record
- [ ] User receives approval notification WITHOUT credentials
- [ ] User can accept nomination with "!accept-support" command
- [ ] User can decline nomination with "!decline-support" command
- [ ] Accepting activates admin account (duressActive: false)
- [ ] Accepting sends credentials via Velum Bot
- [ ] Declining purges admin account and credentials
- [ ] Both accept/decline notify relevant admins
- [ ] CLI_ADMIN can demote active support admins
- [ ] Demoting only deletes admin account, not user account
- [ ] Support admin listing shows only active accounts
- [ ] Nominations listing shows all nomination states
- [ ] Non-CLI_ADMINs cannot approve/reject nominations
- [ ] Non-LOGIN_ADMIN/CLI_ADMIN cannot nominate

### Phase 4 Testing
- [ ] Admin can send broadcast to all users
- [ ] Admin can send broadcast to specific room
- [ ] Admin can send message to specific user
- [ ] Non-admins cannot access broadcast endpoint
- [ ] Broadcast messages display correctly in UI

### Phase 5 Testing
- [ ] Welcome message includes all required information
- [ ] Users cannot send messages to Velum Bot (one-way lock)
- [ ] Bot message rejection logged appropriately

---

## 5. Rollback Plan

### If Issues Arise:
1. **Disable SystemBot**: Comment out import in server/index.ts
2. **Restore UI Recovery Key**: Revert AuthPortal.tsx changes
3. **Disable Broadcast Routes**: Comment out new admin routes
4. **Clear Bot Messages**: Delete messages from lounge where senderId = 999
5. **Drop Nominations Table**: `DROP TABLE support_admin_nominations CASCADE`
6. **Inactive Admin Accounts**: Delete any admin accounts with duressActive=true

### Monitoring:
- Bot message delivery success rate
- Admin broadcast usage patterns
- User engagement with bot DMs
- Recovery key request frequency
- Nomination acceptance/decline rates
- Time from nomination to user response

---

## 6. Implementation Timeline

### Day 1 (4 hours)
- ✅ Phase 1: Activate SystemBot service
- ✅ Phase 2: Recovery key delivery via bot
- ✅ Testing recovery key flow

### Day 2 (4 hours)
- ✅ Phase 3: Support admin nomination system (database schema + nomination API)
- ✅ Testing nomination flow

### Day 3 (4 hours)
- ✅ Phase 3: CLI_ADMIN approval/rejection + user accept/decline
- ✅ Testing complete nomination workflow

### Day 4 (2 hours)
- ✅ Phase 4: Admin broadcast system
- ✅ Phase 5: Bot one-way communication lock
- ✅ Final testing and documentation

---

## 7. Success Metrics

### Before Activation:
- Recovery keys shown in UI (security risk)
- No credential delivery system
- No admin communication channel
- Manual admin credential management
- Direct admin appointment without user consent

### After Activation:
- ✅ Recovery keys delivered securely via DM
- ✅ Nomination-based support admin system with user consent
- ✅ Automated credential delivery with acceptance workflow
- ✅ Real-time admin broadcast system
- ✅ Centralized bot communication hub
- ✅ Enhanced user onboarding experience

### Security Improvements:
- ✅ Credentials removed from HTTP responses
- ✅ Audit trail for all bot communications
- ✅ Role-based broadcast access control
- ✅ User consent required for admin roles
- ✅ Inactive credentials until user acceptance
- ✅ Automatic credential purge on rejection
- ✅ Separate admin accounts prevent privilege escalation

---

## 8. Next Steps

1. **Review this plan** for security implications
2. **Test in staging environment** before production
3. **Inform LOGIN_ADMINs** about new nomination system
4. **Update documentation** with nomination workflow and bot commands
5. **Monitor bot message delivery** after activation
6. **Gather user feedback** on new welcome experience
7. **Track nomination acceptance rates** and optimize workflow

---

**Total Estimated Effort**: 14-16 hours (4 days)  
**Risk Level**: Medium (credential delivery changes + nomination system)  
**ROI**: High (improved security, better UX, automated admin operations, user consent)
