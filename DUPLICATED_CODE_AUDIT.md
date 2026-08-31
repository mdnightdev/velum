# Duplicated Code Audit Report

**Audited:** 2026-08-30  
**Scope:** Entire Velum codebase  
**Severity Breakdown:** 1 High, 3 Medium, 2 Low

---

## Executive Summary

Significant code duplication exists across the codebase, particularly in authentication middleware (16 duplicate implementations), database queries, and validation logic. This duplication impacts maintainability, increases bug risk, and violates DRY principles.

---

## Critical Duplications

### DUP-001: Auth Middleware Duplication
**Severity:** HIGH  
**Location:** 16 route files

**Issue:**
Identical `createAuthMiddleware` implementations across multiple route files, creating:
- Maintenance nightmare (changes require 16 file updates)
- Inconsistent security patches
- Code bloat
- Potential for subtle differences between implementations

**Affected Files:**
```
server/v2/routes/authRoutes.ts:17-31
server/v2/routes/userRoutes.ts:19-33
server/v2/routes/adminRoutes.ts:19-33
server/v2/routes/bankRoutes.ts:8-22
server/v2/routes/marketRoutes.ts:10-24
server/v2/routes/friendRoutes.ts:12-26
server/v2/routes/messageRoutes.ts:15-29
server/v2/routes/communityRoutes.ts:11-25
server/v2/routes/channelRoutes.ts:13-27
server/v2/routes/mediaRoutes.ts:9-23
server/v2/routes/settingsRoutes.ts:14-28
server/v2/routes/notificationRoutes.ts:10-24
server/v2/routes/supportRoutes.ts:8-22
server/v2/routes/escrowRoutes.ts:12-26
server/v2/routes/ticketRoutes.ts:11-25
server/v2/routes/reportRoutes.ts:9-23
```

**Evidence:**
```typescript
// Repeated in 16 files with identical logic
const authMiddleware = createAuthMiddleware(async (tokenHash) => {
  const result = await userRepository.findSessionByTokenHash(tokenHash);
  if (!result) return null;
  return {
    user: {
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role,
      duress_active: result.user.duressActive,
      displayName: result.user.displayName,
      avatarUrl: result.user.avatarUrl
    },
    expiresAt: result.session.expiresAt
  };
});
```

**Remediation:**
```typescript
// Create shared middleware: server/v2/middleware/auth.ts
import { createAuthMiddleware } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';

// Create pre-configured auth middleware
export const authMiddleware = createAuthMiddleware(async (tokenHash) => {
  const result = await userRepository.findSessionByTokenHash(tokenHash);
  if (!result) return null;
  return {
    user: {
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role,
      duress_active: result.user.duressActive,
      displayName: result.user.displayName,
      avatarUrl: result.user.avatarUrl
    },
    expiresAt: result.session.expiresAt
  };
});

// Create role-specific middleware
export const adminAuthMiddleware = createAuthMiddleware(async (tokenHash) => {
  const result = await userRepository.findSessionByTokenHash(tokenHash);
  if (!result) return null;
  if (!['CLI_ADMIN', 'LOGIN_ADMIN', 'SUPPORT_ADMIN'].includes(result.user.role)) {
    return null;
  }
  return {
    user: {
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role,
      duress_active: result.user.duressActive,
      displayName: result.user.displayName,
      avatarUrl: result.user.avatarUrl
    },
    expiresAt: result.session.expiresAt
  };
});

// Usage in route files (replace all 16 implementations):
import { authMiddleware, adminAuthMiddleware } from '../middleware/auth.js';

authRouter.get('/profile', authMiddleware, async (req, res) => {
  // Route handler
});
```

**Impact:**
- Reduce code from ~480 lines to ~60 lines
- Single source of truth for auth logic
- Easier security updates
- Consistent behavior across all routes

**Status:** 🔴 **HIGH PRIORITY** - Should be consolidated immediately

---

## Database Query Duplications

### DUP-002: Repeated Database Query Patterns
**Severity:** MEDIUM  
**Location:** `server/v2/services/loungeService.ts`

**Issue:**
Pattern `await db.select().from(lounges)` repeated 38+ times without filtering, causing:
- Performance overhead
- Maintenance difficulty
- Inconsistent query logic
- Missed optimization opportunities

**Evidence:**
```typescript
// Pattern repeated 38+ times
const lounges = await db.select().from(lounges);
const lounge = await db.select().from(lounges).where(eq(lounges.id, id));
const activeLounges = await db.select().from(lounges).where(eq(lounges.isActive, true));
```

**Remediation:**
```typescript
// Create repository: server/v2/repositories/loungeRepository.ts
import { db } from '../db/client.js';
import { lounges } from '../db/schema/lounges.js';
import { eq, and, desc } from 'drizzle-orm';

export class LoungeRepository {
  async findAll() {
    return await db.select().from(lounges);
  }
  
  async findById(id: number) {
    const [lounge] = await db.select().from(lounges).where(eq(lounges.id, id)).limit(1);
    return lounge;
  }
  
  async findActive() {
    return await db.select().from(lounges).where(eq(lounges.isActive, true));
  }
  
  async findByCommunityId(communityId: number) {
    return await db.select().from(lounges).where(eq(lounges.communityId, communityId));
  }
  
  async findByCreatorId(creatorId: number) {
    return await db.select().from(lounges).where(eq(lounges.creatorId, creatorId));
  }
  
  async findRecent(limit: number = 10) {
    return await db.select().from(lounges)
      .orderBy(desc(lounges.createdAt))
      .limit(limit);
  }
}

export const loungeRepository = new LoungeRepository();

// Usage in services:
import { loungeRepository } from '../repositories/loungeRepository.js';

const lounges = await loungeRepository.findAll();
const lounge = await loungeRepository.findById(id);
const activeLounges = await loungeRepository.findActive();
```

**Status:** 🟡 **MEDIUM PRIORITY** - Should be refactored

---

### DUP-003: Duplicate Orphan Cleanup Logic
**Severity:** MEDIUM  
**Location:** 
- `cli/v2/shell.ts:1323-1366`
- `server/self-healing.ts:49-69`

**Issue:**
Identical SQL cleanup queries duplicated between CLI and self-healing modules, creating:
- Maintenance overhead
- Risk of inconsistent cleanup
- Code duplication

**Evidence:**
```typescript
// cli/v2/shell.ts:1323-1366
async cleanupOrphanedMessages() {
  await db.execute(`DELETE FROM messages WHERE channel_id NOT IN (SELECT id FROM channels)`);
  await db.execute(`DELETE FROM messages WHERE user_id NOT IN (SELECT id FROM users)`);
  // ... more cleanup queries
}

// server/self-healing.ts:49-69 - identical logic
async cleanupOrphanedRecords() {
  await db.execute(`DELETE FROM messages WHERE channel_id NOT IN (SELECT id FROM channels)`);
  await db.execute(`DELETE FROM messages WHERE user_id NOT IN (SELECT id FROM users)`);
  // ... more cleanup queries
}
```

**Remediation:**
```typescript
// Create shared module: server/v2/utils/databaseCleanup.ts
import { db } from '../db/client.js';

export class DatabaseCleanup {
  async cleanupOrphanedMessages() {
    const results = {
      messagesOrphanedByChannel: 0,
      messagesOrphanedByUser: 0,
      channelsOrphanedByCommunity: 0
    };
    
    results.messagesOrphanedByChannel = await db.execute(`
      DELETE FROM messages WHERE channel_id NOT IN (SELECT id FROM channels)
    `);
    
    results.messagesOrphanedByUser = await db.execute(`
      DELETE FROM messages WHERE user_id NOT IN (SELECT id FROM users)
    `);
    
    results.channelsOrphanedByCommunity = await db.execute(`
      DELETE FROM channels WHERE community_id NOT IN (SELECT id FROM communities)
    `);
    
    return results;
  }
  
  async cleanupOrphanedMemberships() {
    return await db.execute(`
      DELETE FROM community_members 
      WHERE user_id NOT IN (SELECT id FROM users) 
      OR community_id NOT IN (SELECT id FROM communities)
    `);
  }
  
  async cleanupOrphanedMarketData() {
    const results = {
      listingsOrphanedBySeller: 0,
      transactionsOrphanedByListing: 0
    };
    
    results.listingsOrphanedBySeller = await db.execute(`
      DELETE FROM market_listings WHERE seller_id NOT IN (SELECT id FROM users)
    `);
    
    results.transactionsOrphanedByListing = await db.execute(`
      DELETE FROM escrow_transactions WHERE listing_id NOT IN (SELECT id FROM market_listings)
    `);
    
    return results;
  }
  
  async runFullCleanup() {
    const results = {
      messages: await this.cleanupOrphanedMessages(),
      memberships: await this.cleanupOrphanedMemberships(),
      market: await this.cleanupOrphanedMarketData()
    };
    
    return results;
  }
}

export const databaseCleanup = new DatabaseCleanup();

// Usage in CLI:
import { databaseCleanup } from '../../server/v2/utils/databaseCleanup.js';

const results = await databaseCleanup.runFullCleanup();

// Usage in self-healing:
import { databaseCleanup } from './utils/databaseCleanup.js';

const results = await databaseCleanup.runFullCleanup();
```

**Status:** 🟡 **MEDIUM PRIORITY** - Should be consolidated

---

## Validation Logic Duplications

### DUP-004: Password Strength Validation
**Severity:** LOW  
**Location:** 
- `src/components/Auth/utils/crypto.ts:16`
- `server/v2/schemas/auth.ts:4-13`

**Issue:**
Password validation logic duplicated between frontend and backend, creating:
- Validation inconsistency risk
- Maintenance overhead
- User experience issues

**Evidence:**
```typescript
// Frontend: src/components/Auth/utils/crypto.ts:16
export function validatePasswordStrength(password: string): boolean {
  return password.length >= 8 && 
         /[A-Z]/.test(password) && 
         /[a-z]/.test(password) && 
         /[0-9]/.test(password) && 
         /[^A-Za-z0-9]/.test(password);
}

// Backend: server/v2/schemas/auth.ts:4-13
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain special character');
```

**Remediation:**
```typescript
// Create shared types package: shared/src/validation/password.ts
export interface PasswordValidationRule {
  min: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

export const DEFAULT_PASSWORD_RULES: PasswordValidationRule = {
  min: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true
};

export function validatePassword(password: string, rules: PasswordValidationRule = DEFAULT_PASSWORD_RULES): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < rules.min) {
    errors.push(`Password must be at least ${rules.min} characters`);
  }
  
  if (rules.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letter');
  }
  
  if (rules.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain lowercase letter');
  }
  
  if (rules.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain number');
  }
  
  if (rules.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Frontend usage:
import { validatePassword, DEFAULT_PASSWORD_RULES } from 'shared/validation/password';

const result = validatePassword(password, DEFAULT_PASSWORD_RULES);

// Backend usage:
import { validatePassword, DEFAULT_PASSWORD_RULES } from 'shared/validation/password';
import { z } from 'zod';

const passwordSchema = z.string().refine(
  (password) => validatePassword(password, DEFAULT_PASSWORD_RULES).valid,
  (password) => {
    const result = validatePassword(password, DEFAULT_PASSWORD_RULES);
    return { message: result.errors.join(', ') };
  }
);
```

**Status:** 🟢 **LOW PRIORITY** - Should be consolidated for consistency

---

## Type Definition Duplications

### DUP-005: User Interface Duplication
**Severity:** LOW  
**Location:** Multiple files

**Issue:**
User type definitions repeated across multiple files, creating:
- Type inconsistency risk
- Import confusion
- Maintenance overhead

**Affected Files:**
```
server/v2/middleware/auth.ts:5-11
server/v2/controllers/authController.ts
server/v2/routes/*.ts (multiple files)
src/types/user.ts
```

**Evidence:**
```typescript
// Repeated in multiple files
interface User {
  userId: number;
  username: string;
  role: string;
  duress_active: boolean;
  displayName: string;
  avatarUrl: string;
}
```

**Remediation:**
```typescript
// Create shared types: shared/src/types/user.ts
export interface User {
  userId: number;
  username: string;
  role: 'USER' | 'CLI_ADMIN' | 'LOGIN_ADMIN' | 'SUPPORT_ADMIN';
  duress_active: boolean;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUser {
  username: string;
  password: string;
  displayName?: string;
  role?: string;
}

export interface UpdateUser {
  displayName?: string;
  avatarUrl?: string;
}

// Usage everywhere:
import type { User, CreateUser, UpdateUser } from 'shared/types/user';
```

**Status:** 🟢 **LOW PRIORITY** - Should be consolidated

---

## Additional Duplications

### DUP-006: Error Response Formatting
**Severity:** LOW  
**Location:** Multiple controllers

**Issue:**
Error response formatting logic repeated across controllers.

**Remediation:**
```typescript
// Create shared error response utility: server/v2/utils/errorResponse.ts
export function errorResponse(res: any, statusCode: number, message: string, details?: any) {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      details,
      timestamp: new Date().toISOString()
    }
  });
}

export function successResponse(res: any, data: any, message?: string) {
  return res.status(200).json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  });
}
```

---

### DUP-007: Date Formatting Utilities
**Severity:** LOW  
**Location:** Multiple service files

**Issue:**
Date formatting logic repeated throughout codebase.

**Remediation:**
```typescript
// Create shared date utilities: shared/src/utils/date.ts
export function formatDate(date: Date | string, format: 'short' | 'long' | 'iso' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  switch (format) {
    case 'short':
      return d.toLocaleDateString();
    case 'long':
      return d.toLocaleString();
    case 'iso':
      return d.toISOString();
    default:
      return d.toISOString();
  }
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 7) {
    return formatDate(d, 'short');
  } else if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}
```

---

## Recommendations

### Immediate Actions (Within 1 Week)
1. **DUP-001:** Consolidate 16 duplicate auth middleware implementations
2. **DUP-003:** Extract duplicate orphan cleanup logic to shared module

### Short-term Actions (Within 1 Month)
3. **DUP-002:** Create repository layer for repeated database queries
4. **DUP-004:** Consolidate password validation logic
5. **DUP-005:** Consolidate user type definitions

### Long-term Actions (Within 3 Months)
6. **DUP-006:** Create shared error response utilities
7. **DUP-007:** Create shared date formatting utilities
8. Implement code duplication detection in CI/CD
9. Regular duplication audits in code reviews

---

## Automated Detection

```bash
# Use jscpd for JavaScript/TypeScript duplication detection
npx jscpd ./src ./server --format typescript --min-lines 5 --min-tokens 50

# Or use copy-paste-detector
npx copy-paste-detector ./src ./server

# Configure in package.json:
{
  "scripts": {
    "detect-duplication": "jscpd ./src ./server --format typescript --min-lines 5 --min-tokens 50 --reporters json"
  }
}
```

---

## Prevention Strategy

### Development Practices
1. **Code Review:** Check for duplication in pull requests
2. **DRY Principle:** Enforce Don't Repeat Yourself in coding standards
3. **Shared Libraries:** Create shared packages for common functionality
4. **Repository Pattern:** Use repository layer for data access

### Tooling Configuration
```json
// .jscpd.json
{
  "threshold": 5,
  "reporters": ["html", "console"],
  "ignore": [
    "**/*.test.ts",
    "**/*.spec.ts",
    "node_modules/**"
  ],
  "format": ["typescript"]
}
```

---

## Metrics Tracking

Track duplication reduction over time:
- **Current Duplication:** ~15% estimated
- **Target Duplication:** <5%
- **Measurement:** Lines of duplicated code / Total lines of code

---

## Conclusion

Code duplication is a significant issue in the Velum codebase, particularly with authentication middleware. Consolidating these duplications will improve maintainability, reduce bug risk, and make security updates easier.

**Risk Level:** MEDIUM  
**Recommended Action:** Prioritize auth middleware consolidation, then systematic refactoring of other duplications
