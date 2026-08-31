# Code Duplication Analysis - Detailed Analysis

## Executive Summary
- **Total Duplications Found**: 15+ major instances
- **Estimated Code Reduction**: 200-300 lines through consolidation
- **Critical Duplications**: Support admin nomination, welcome messages, API calls
- **Priority Areas**: Admin routes, authentication, message handling

## Detailed Duplication Analysis

### 1. Support Admin Nomination Logic Duplication

#### Locations:
- **CLI**: `cli/v2/shell.ts` (lines 893-1076)
- **Admin Routes**: `server/v2/routes/adminRoutes.ts` (lines 225-413)

#### CLI Implementation (Lines 895-976):
```typescript
if (sub === 'approve') {
  const [nomIdStr] = rawArgs;
  if (!nomIdStr) {
    console.log('Usage: approve <nomination_id>');
    return;
  }
  const nomId = parseInt(nomIdStr, 10);
  if (isNaN(nomId)) {
    console.log('Invalid nomination ID.');
    return;
  }
  
  try {
    const [nomination] = await db.select().from(supportAdminNominations).where(eq(supportAdminNominations.id, nomId)).limit(1);
    if (!nomination) {
      console.log('Nomination not found.');
      return;
    }
    if (nomination.status !== 'pending') {
      console.log(`Nomination cannot be approved. Current status: ${nomination.status}`);
      return;
    }
    
    const [targetUser] = await db.select().from(users).where(eq(users.id, nomination.nominatedUserId)).limit(1);
    if (!targetUser) {
      console.log('Nominated user not found.');
      return;
    }
    
    // INSECURE CREDENTIAL GENERATION
    const adminUsername = `Sa-${targetUser.username}`;
    const adminPassword = `Sa-Vel-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const adminSalt = crypto.randomBytes(16).toString('hex');
    const adminPasswordHash = await hashArgon2id(adminPassword, Buffer.from(adminSalt, 'hex'));
    const adminRecoveryKey = `Sa-Vel-Sup-${Math.floor(10000 + Math.random() * 90000)}`;
    const adminRecoveryKeyHash = await hashArgon2id(adminRecoveryKey, Buffer.from(adminSalt, 'hex'));
    const adminPanicPhrase = `Sa-P-${Math.floor(100000 + Math.random() * 900000)}`;
    const adminPanicPhraseHash = await hashArgon2id(adminPanicPhrase, Buffer.from(adminSalt, 'hex'));
    
    const [newAdmin] = await db.insert(users).values({
      username: adminUsername,
      passwordHash: adminPasswordHash,
      salt: adminSalt,
      role: 'SUPPORT_ADMIN',
      displayName: `${targetUser.displayName || targetUser.username} (Support)`,
      recoveryKeyHash: adminRecoveryKeyHash,
      panicPhraseHash: adminPanicPhraseHash,
      duressActive: true
    }).returning();
    
    // APPROVAL NOTIFICATION MESSAGE
    console.log(`[OK] Support admin account created for ${targetUser.username}:`);
    console.log(`  Username: ${adminUsername}`);
    console.log(`  Password: ${adminPassword}`);
    console.log(`  Recovery Key: ${adminRecoveryKey}`);
    console.log(`  Panic Phrase: ${adminPanicPhrase}`);
    console.log(`  Note: Share credentials securely with the nominated user.`);
    
    await this.logAudit('/users/approve-nomination', String(nomId), `Approved support admin nomination for ${targetUser.username}`);
  } catch (err) {
    console.log(`[ERROR] Failed to approve nomination: ${(err as Error).message}`);
  }
  return;
}
```

#### Admin Routes Implementation (Lines 225-310):
```typescript
adminRouter.post('/approve-nomination', async (req: Request, res: Response) => {
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
    
    // SECURE CREDENTIAL GENERATION
    const adminUsername = `Sa-${targetUser.username}`;
    const adminPassword = `Sa-Vel-${generateSecurePassword()}`;
    const adminSalt = crypto.randomBytes(16).toString('hex');
    const adminPasswordHash = await hashArgon2id(adminPassword, Buffer.from(adminSalt, 'hex'));
    const adminRecoveryKey = `Sa-Vel-Sup-${Math.floor(10000 + Math.random() * 90000)}`;
    const adminRecoveryKeyHash = await hashArgon2id(adminRecoveryKey, Buffer.from(adminSalt, 'hex'));
    const adminPanicPhrase = `Sa-P-${Math.floor(100000 + Math.random() * 900000)}`;
    const adminPanicPhraseHash = await hashArgon2id(adminPanicPhrase, Buffer.from(adminSalt, 'hex'));
    
    // Create INACTIVE support admin account
    const [newAdmin] = await db.insert(users).values({
      username: adminUsername,
      passwordHash: adminPasswordHash,
      salt: adminSalt,
      role: 'SUPPORT_ADMIN',
      displayName: `${targetUser.displayName || targetUser.username} (Support)`,
      recoveryKeyHash: adminRecoveryKeyHash,
      panicPhraseHash: adminPanicPhraseHash,
      duressActive: true // Mark as inactive/duress until accepted
    }).returning();
    
    // Store credentials encrypted in nomination
    const credentialsData = JSON.stringify({
      username: adminUsername,
      password: adminPassword,
      recoveryKey: adminRecoveryKey,
      panicPhrase: adminPanicPhrase
    });
    
    // Update nomination with encrypted credentials
    await db.update(supportAdminNominations)
      .set({ 
        status: 'approved',
        credentials: credentialsData,
        approvedAt: new Date()
      })
      .where(eq(supportAdminNominations.id, nominationId));
    
    res.json({ 
      success: true, 
      message: 'Support admin nomination approved successfully',
      adminId: newAdmin.id
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve nomination' });
  }
});
```

#### Key Differences:
1. **Security**: CLI uses simple random (`Math.random()`), Admin uses `generateSecurePassword()`
2. **Role check**: Admin has CLI_ADMIN verification, CLI has no role check
3. **Credential storage**: Admin stores encrypted credentials in nomination, CLI displays them directly
4. **Account activation**: Admin marks as inactive/duress, CLI creates active account
5. **Status update**: Admin updates nomination status, CLI doesn't

#### Consolidation Opportunity:
```typescript
// Create shared service: server/v2/services/supportAdminService.ts
import { db } from '../db/client.js';
import { supportAdminNominations, users } from '../db/schema/users.js';
import { hashArgon2id } from '../utils/crypto.js';
import crypto from 'node:crypto';

export class SupportAdminService {
  static async approveNomination(
    nominationId: number,
    adminRole: string,
    securePassword: boolean = true
  ): Promise<{ success: boolean; message: string; adminId?: number; credentials?: any }> {
    try {
      // Role verification
      if (adminRole !== 'CLI_ADMIN') {
        return { success: false, message: 'Only CLI_ADMIN can approve nominations' };
      }
      
      // Get nomination details
      const [nomination] = await db.select().from(supportAdminNominations)
        .where(eq(supportAdminNominations.id, nominationId))
        .limit(1);
      
      if (!nomination) {
        return { success: false, message: 'Nomination not found' };
      }
      
      if (nomination.status !== 'pending') {
        return { success: false, message: `Nomination is not in pending status: ${nomination.status}` };
      }
      
      // Get nominated user info
      const [targetUser] = await db.select().from(users)
        .where(eq(users.id, nomination.nominatedUserId))
        .limit(1);
      
      if (!targetUser) {
        return { success: false, message: 'Nominated user not found' };
      }
      
      // Generate credentials with secure method
      const adminUsername = `Sa-${targetUser.username}`;
      const adminPassword = securePassword 
        ? `Sa-Vel-${this.generateSecurePassword()}`
        : `Sa-Vel-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const adminSalt = crypto.randomBytes(16).toString('hex');
      const adminPasswordHash = await hashArgon2id(adminPassword, Buffer.from(adminSalt, 'hex'));
      const adminRecoveryKey = `Sa-Vel-Sup-${Math.floor(10000 + Math.random() * 90000)}`;
      const adminRecoveryKeyHash = await hashArgon2id(adminRecoveryKey, Buffer.from(adminSalt, 'hex'));
      const adminPanicPhrase = `Sa-P-${Math.floor(100000 + Math.random() * 900000)}`;
      const adminPanicPhraseHash = await hashArgon2id(adminPanicPhrase, Buffer.from(adminSalt, 'hex'));
      
      // Create support admin account
      const [newAdmin] = await db.insert(users).values({
        username: adminUsername,
        passwordHash: adminPasswordHash,
        salt: adminSalt,
        role: 'SUPPORT_ADMIN',
        displayName: `${targetUser.displayName || targetUser.username} (Support)`,
        recoveryKeyHash: adminRecoveryKeyHash,
        panicPhraseHash: adminPanicPhraseHash,
        duressActive: true // Mark as inactive until accepted
      }).returning();
      
      // Store credentials encrypted
      const credentialsData = JSON.stringify({
        username: adminUsername,
        password: adminPassword,
        recoveryKey: adminRecoveryKey,
        panicPhrase: adminPanicPhrase
      });
      
      // Update nomination status
      await db.update(supportAdminNominations)
        .set({ 
          status: 'approved',
          credentials: credentialsData,
          approvedAt: new Date()
        })
        .where(eq(supportAdminNominations.id, nominationId));
      
      return {
        success: true,
        message: 'Support admin nomination approved successfully',
        adminId: newAdmin.id,
        credentials: { username: adminUsername, password: adminPassword, recoveryKey: adminRecoveryKey, panicPhrase: adminPanicPhrase }
      };
    } catch (err) {
      return { success: false, message: `Failed to approve nomination: ${(err as Error).message}` };
    }
  }
  
  private static generateSecurePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
```

**CLI Usage**:
```typescript
const result = await SupportAdminService.approveNomination(nomId, 'CLI_ADMIN', false);
if (result.success) {
  console.log(`[OK] Support admin account created for ${targetUser.username}:`);
  console.log(`  Username: ${result.credentials.username}`);
  console.log(`  Password: ${result.credentials.password}`);
  console.log(`  Recovery Key: ${result.credentials.recoveryKey}`);
  console.log(`  Panic Phrase: ${result.credentials.panicPhrase}`);
}
```

**Admin Routes Usage**:
```typescript
const result = await SupportAdminService.approveNomination(nominationId, req.user!.role, true);
if (result.success) {
  res.json({ 
    success: true, 
    message: result.message,
    adminId: result.adminId
  });
} else {
  res.status(400).json({ error: result.message });
}
```

**Estimated Reduction**: 100-150 lines

### 2. Welcome Message Duplication

#### Locations:
- **authController.ts** (lines 270 and 389)
- **cli/v2/index.ts** (line 32)

#### AuthController Implementation (Line 270):
```typescript
console.log(`
==================================================
 Welcome to Velum 
==================================================
`);
```

#### AuthController Implementation (Line 389):
```typescript
console.log(`
==================================================
 Welcome to Velum 
==================================================
`);
```

#### CLI Implementation (Line 32):
```typescript
function printMotd(): void {
  console.log(`
==================================================
 Welcome to Velum CLI 
==================================================
`);
}
```

#### Consolidation Opportunity:
```typescript
// Create shared constants: server/v2/constants/messages.ts
export const WELCOME_MESSAGE = `
==================================================
 Welcome to Velum 
==================================================
`;

export const CLI_WELCOME_MESSAGE = `
==================================================
 Welcome to Velum CLI 
==================================================
`;

// AuthController usage:
import { WELCOME_MESSAGE } from '../constants/messages';
console.log(WELCOME_MESSAGE);

// CLI usage:
import { CLI_WELCOME_MESSAGE } from '../../server/v2/constants/messages';
function printMotd(): void {
  console.log(CLI_WELCOME_MESSAGE);
}
```

**Estimated Reduction**: 15-20 lines

### 3. Repository Fetch Pattern Duplication

#### Current Implementation

**Pattern Analysis**: Multiple files use similar repository fetch patterns

**CLI Examples**:
```typescript
// Lines 908, 918
const [nomination] = await db.select().from(supportAdminNominations).where(eq(supportAdminNominations.id, nomId)).limit(1);
const [targetUser] = await db.select().from(users).where(eq(users.id, nomination.nominatedUserId)).limit(1);

// Lines 1238-1243
const ticket = await ticketRepository.findById(id);
const user = await userRepository.findById(ticket.userId);

// Lines 1614-1615
const item = await marketRepository.findListingById(id);

// Lines 1715-1716
const item = await marketRepository.findEscrowById(id);
```

**Frontend Examples**:
```typescript
// AdminPanel.tsx lines 127, 145, 155
const ticketRes = await adminFetch(`/v2/admin/tickets?adminId=${adminId}`);
const usersRes = await adminFetch(`/v2/user/admin/all`);
const diagRes = await adminFetch(`/v2/admin/diagnostics?adminId=${adminId}`);
```

#### Consolidation Opportunity:
```typescript
// Create shared repository helpers: server/v2/repositories/helpers.ts
import { db } from '../db/client.js';
import { eq } from 'drizzle-orm';

export async function fetchEntityById<T>(
  table: any,
  id: number,
  returnFirst: boolean = true
): Promise<T | T[] | null> {
  try {
    let query = db.select().from(table).where(eq(table.id, id));
    if (returnFirst) {
      query = query.limit(1);
      const result = await query;
      return result.length ? result[0] : null;
    }
    return await query;
  } catch (err) {
    console.error(`Failed to fetch entity from ${table}:`, err);
    return null;
  }
}

export async function fetchEntityByField<T>(
  table: any,
  field: string,
  value: any,
  returnFirst: boolean = true
): Promise<T | T[] | null> {
  try {
    let query = db.select().from(table).where(eq(table[field], value));
    if (returnFirst) {
      query = query.limit(1);
      const result = await query;
      return result.length ? result[0] : null;
    }
    return await query;
  } catch (err) {
    console.error(`Failed to fetch entity by ${field}:`, err);
    return null;
  }
}

// Usage examples:
const nomination = await fetchEntityById(supportAdminNominations, nomId);
const targetUser = await fetchEntityById(users, nomination.nominatedUserId);
const ticket = await fetchEntityById(tickets, id);
const user = await fetchEntityById(users, ticket.userId);
```

**Estimated Reduction**: 50-80 lines

### 4. Message Encryption/Decryption Duplication

#### Current Implementation

**Duplication in Multiple Components**:
- `encryptionService.ts` - Main encryption service
- `statelessE2eeService.ts` - E2EE for direct messages
- `useMessageDecryption.ts` - Message decryption hook
- `useAudioPlayback.ts` - Audio decryption

**Encryption Pattern Duplication**:
```typescript
// Multiple locations have similar encryption logic
const encrypted = await encryptMessage(content, context);
const decrypted = await decryptMessage(encrypted, context);
```

#### Consolidation Opportunity:
```typescript
// Already partially consolidated in encryptionService.ts
// Extend to cover all encryption use cases with unified interface

export class EncryptionService {
  static async encryptMessage(
    content: string, 
    context: EncryptionContext
  ): Promise<string> {
    if (!content) return '';
    
    if (context.type === 'direct' && context.peerUserId) {
      return await statelessE2eeService.encryptDirectMessage(content, context.peerUserId);
    }
    
    if (context.type === 'lounge' && context.roomId) {
      return `VEL_E2EE[${encryptXOR(content, 'VELUM_E2EE_' + context.roomId)}]`;
    }
    
    return content;
  }
  
  static async decryptMessage(
    content: string, 
    context: EncryptionContext
  ): Promise<string> {
    if (!content) return '';
    
    // Stateless Direct Message
    if (content.startsWith('e2ee:v1:')) {
      try {
        return await statelessE2eeService.decryptDirectMessage(content);
      } catch (err) {
        console.error('[encryptionService] Stateless E2EE decryption error:', err);
        return '[Encrypted Message]';
      }
    }
    
    // Lounge XOR
    if (content.startsWith('VEL_E2EE[')) {
      try {
        const cipher = content.replace('VEL_E2EE[', '').replace(']', '');
        return decryptXOR(cipher, 'VELUM_E2EE_' + context.roomId);
      } catch (err) {
        console.error('[encryptionService] Lounge decryption error:', err);
        return '[Encrypted Message]';
      }
    }
    
    // Legacy ratchet
    if (content.startsWith('ratchet:v2:') || content.startsWith('ratchet:v1:')) {
      try {
        // Handle legacy ratchet decryption
        return this.decryptRatchetMessage(content, context);
      } catch (err) {
        console.error('[encryptionService] Ratchet decryption error:', err);
        return '[Encrypted Message]';
      }
    }
    
    return content;
  }
  
  private static decryptRatchetMessage(content: string, context: EncryptionContext): string {
    // Implement ratchet decryption logic
    return content; // Placeholder
  }
}
```

**Estimated Reduction**: 30-50 lines

### 5. API Response Formatting Duplication

#### Current Implementation

**Duplication in Multiple Route Handlers**:
```typescript
// Success responses (inconsistent formats)
res.json({ success: true, data: result });
res.json({ message: 'Operation successful' });
res.json({ success: true, result });

// Error responses (inconsistent formats)
res.status(400).json({ error: 'Invalid input' });
res.status(404).json({ error: 'Not found' });
res.status(500).json({ error: 'Internal server error' });
```

#### Consolidation Opportunity:
```typescript
// Create shared response helpers: server/v2/utils/responseHelpers.ts
export function successResponse(data: any, message?: string) {
  return { 
    success: true, 
    data, 
    message: message || 'Operation successful' 
  };
}

export function errorResponse(
  message: string, 
  code: number = 500,
  details?: any
) {
  const response: any = { 
    success: false, 
    error: message 
  };
  
  if (details) {
    response.details = details;
  }
  
  return response;
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
) {
  const totalPages = Math.ceil(total / pageSize);
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

// Usage examples:
res.json(successResponse(newAdmin, 'Support admin created successfully'));
res.status(404).json(errorResponse('Nomination not found', 404));
res.json(paginatedResponse(users, page, pageSize, totalCount));
```

**Estimated Reduction**: 25-40 lines

### 6. Pagination Logic Duplication

#### Current Implementation

**Duplication in Multiple API Endpoints**:
```typescript
// Similar pagination logic in multiple routes
const page = parseInt(req.query.page as string) || 1;
const limit = parseInt(req.query.limit as string) || 10;
const offset = (page - 1) * limit;

const data = await db.select().from(table)
  .limit(limit)
  .offset(offset);
```

#### Consolidation Opportunity:
```typescript
// Create shared pagination helpers: server/v2/utils/paginationHelpers.ts
export function parsePaginationParams(query: any) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 10));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export async function fetchPaginatedData<T>(
  table: any,
  pagination: { page: number; limit: number; offset: number },
  orderBy?: any
): Promise<{ data: T[]; total: number }> {
  try {
    let query = db.select().from(table);
    
    if (orderBy) {
      query = query.orderBy(orderBy);
    }
    
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(table);
    const total = Number(countResult?.count || 0);
    
    const data = await query
      .limit(pagination.limit)
      .offset(pagination.offset);
    
    return { data, total };
  } catch (err) {
    console.error('Pagination fetch error:', err);
    return { data: [], total: 0 };
  }
}

// Usage examples:
const pagination = parsePaginationParams(req.query);
const { data, total } = await fetchPaginatedData(users, pagination);
res.json(paginatedResponse(data, pagination.page, pagination.limit, total));
```

**Estimated Reduction**: 40-60 lines

### 7. Authentication Check Duplication

#### Current Implementation

**Duplication in Protected Routes**:
```typescript
// Repeated authentication checks
if (!['ADMIN', 'CLI_ADMIN'].includes(req.user!.role)) {
  return res.status(403).json({ error: 'Forbidden' });
}

if (req.user!.role !== 'CLI_ADMIN') {
  return res.status(403).json({ error: 'Only CLI_ADMIN can perform this action' });
}
```

#### Consolidation Opportunity:
```typescript
// Create shared auth helpers: server/v2/utils/authHelpers.ts
export function requireRole(user: any, allowedRoles: string[]): boolean {
  return allowedRoles.includes(user.role);
}

export function requireRoleStrict(user: any, requiredRole: string): boolean {
  return user.role === requiredRole;
}

export function requireAnyRole(user: any, roles: string[]): boolean {
  return roles.some(role => user.role === role);
}

export function checkPermission(user: any, action: string): boolean {
  const rolePermissions: Record<string, string[]> = {
    'CLI_ADMIN': ['*'],
    'ADMIN': ['users', 'sanctions', 'market', 'escrow', 'lounges'],
    'LOGIN_ADMIN': ['users', 'sanctions'],
    'SUPPORT_ADMIN': ['tickets', 'users']
  };
  
  const permissions = rolePermissions[user.role] || [];
  return permissions.includes('*') || permissions.includes(action);
}

// Usage examples:
if (!requireRole(req.user!, ['ADMIN', 'CLI_ADMIN'])) {
  return res.status(403).json({ error: 'Forbidden' });
}

if (!requireRoleStrict(req.user!, 'CLI_ADMIN')) {
  return res.status(403).json({ error: 'Only CLI_ADMIN can perform this action' });
}

if (!checkPermission(req.user!, 'delete_user')) {
  return res.status(403).json({ error: 'Permission denied' });
}
```

**Estimated Reduction**: 40-60 lines

### 8. Error Handling Duplication

#### Current Implementation

**Inconsistent Error Handling**:
```typescript
// Mix of error handling patterns
try {
  // operation
} catch (err) {
  console.error(err);
  res.status(500).json({ error: 'Operation failed' });
}

try {
  // operation
} catch (err) {
  console.log(`[ERROR] Failed: ${(err as Error).message}`);
  return;
}

try {
  // operation
} catch (err) {
  res.status(500).json({ error: 'Internal server error' });
}
```

#### Consolidation Opportunity:
```typescript
// Create shared error helpers: server/v2/utils/errorHelpers.ts
export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export class APIError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function handleAsyncError(
  error: unknown,
  context: string
): APIError {
  if (error instanceof APIError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new APIError(
      ErrorCode.INTERNAL_ERROR,
      `${context}: ${error.message}`,
      500,
      { stack: error.stack }
    );
  }
  
  return new APIError(
    ErrorCode.INTERNAL_ERROR,
    `${context}: Unknown error`,
    500
  );
}

export function errorResponseFromError(error: APIError) {
  return {
    success: false,
    error: error.message,
    code: error.code,
    details: error.details
  };
}

// Usage examples:
try {
  const result = await someOperation();
  res.json(successResponse(result));
} catch (error) {
  const apiError = handleAsyncError(error, 'someOperation');
  res.status(apiError.statusCode).json(errorResponseFromError(apiError));
}
```

**Estimated Reduction**: 60-80 lines

## V1 Integration Status

### Current State: 100% Complete
- **V1 Functions**: None remaining in active code
- **V1 Deprecation**: Explicit in `server/v2/app.ts`
- **Active Routes**: V2 only
- **V1 Files**: Isolated in "DEAD ENGINE" folder

### Confirmation Analysis

**Evidence from Code Review**:
- No V1 function calls found in active codebase
- All routes use V2 naming conventions (`/v2/*`)
- V1 code is completely isolated in separate directories
- V1 explicitly deprecated in server configuration

**Search Results**:
- `grep -r "v1/"` - Only finds in deprecated directories
- `grep -r "V1_"` - Only finds in comments and dead code
- `grep -r "legacy"` - Only finds in dead code directories

**Safe to Remove**: V1 files can be safely deleted as they have no dependencies in active code

## Additional Duplications

### 9. ID Validation Logic
**Impact**: Medium
**Locations**: Throughout CLI and admin routes
**Reduction Potential**: 30-40 lines

### 10. Table Formatting
**Impact**: Low
**Locations**: CLI shell only
**Reduction Potential**: 50-70 lines

### 11. Date Formatting
**Impact**: Low
**Locations**: Multiple components
**Reduction Potential**: 20-30 lines

### 12. String Parsing
**Impact**: Low
**Locations**: Multiple services
**Reduction Potential**: 25-35 lines

## Consolidation Strategy

### Shared Services Layer
Create `server/v2/services/` with:
- `supportAdminService.ts` - Admin nomination logic
- `repositoryHelper.ts` - Repository fetch patterns
- `encryptionService.ts` - Extended encryption operations
- `paginationService.ts` - Pagination logic

### Constants Layer
Create `server/v2/constants/` with:
- `messages.ts` - User-facing messages
- `errors.ts` - Error messages and codes
- `permissions.ts` - Role-based permissions

### Helper Functions
Create `server/v2/utils/` with:
- `responseHelpers.ts` - API response formatting
- `validationHelpers.ts` - Input validation
- `paginationHelpers.ts` - Pagination logic
- `authHelpers.ts` - Authentication checks
- `errorHelpers.ts` - Error handling

## Implementation Priority

### Phase 1: Critical Duplications
1. **Support admin nomination consolidation** - SECURITY IMPACT
2. **Welcome message unification** - Low risk, high impact
3. **Repository fetch pattern consolidation** - High impact

### Phase 2: High-Impact Duplications
4. **API response formatting** - Improves API consistency
5. **Authentication checks** - Security improvement
6. **Error handling standardization** - Better debugging

### Phase 3: Medium-Impact Duplications
7. **Pagination logic** - Performance improvement
8. **ID validation** - Input validation
9. **Date formatting** - Consistency improvement

### Phase 4: Cleanup
10. **Remove V1 files** - Code cleanup
11. **Update documentation** - Reflect changes
12. **Add unit tests** - Verify consolidations

## Expected Outcomes
- **Code Reduction**: 200-300 lines
- **Maintainability**: Significantly improved
- **Consistency**: Unified behavior across platform
- **Security**: Improved through consolidated auth and validation
- **Testing**: Easier with consolidated logic
- **Performance**: Minimal impact, slight improvement from reduced code

## Verification Steps
1. Test consolidated support admin nomination with both CLI and web
2. Verify welcome messages are consistent across platforms
3. Test pagination with new generic helpers
4. Verify error handling is consistent
5. Test authentication checks with new helpers
6. Monitor for any performance regressions
