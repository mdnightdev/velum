# Dead Code Audit Report

**Audited:** 2026-08-30  
**Scope:** Entire Velum codebase  
**Severity Breakdown:** 0 Critical, 1 Medium, 4 Low

---

## Executive Summary

The codebase contains several instances of dead code including backup files, unused directories, duplicate imports, unreachable code paths, and commented code. While mostly low severity, these impact code maintainability and should be cleaned up.

---

## Dead Code Findings

### DEAD-001: Backup Files
**Severity:** LOW  
**Location:** Multiple files throughout codebase

**Issue:**
Backup files should not be in production repository as they:
- Create confusion about current vs old code
- Increase repository size
- May contain sensitive information
- Violate DRY principles

**Files Found:**
```
cli/v2/shell.ts.bak
chaos-suite/src/agents/Agent.ts.backup
chaos-suite/src/agents/ApiClient.ts.backup
chaos-suite/src/controller/Controller.ts.backup
```

**Remediation:**
```bash
# Remove all backup files
find . -name "*.bak" -delete
find . -name "*.backup" -delete

# Add to .gitignore to prevent future commits
echo "*.bak" >> .gitignore
echo "*.backup" >> .gitignore
```

**Status:** 🟢 **TRIVIAL** - Can be removed immediately

---

### DEAD-002: Dead Engine Directory
**Severity:** LOW  
**Location:** `DEAD ENGINE/` directory

**Issue:**
Entire directory marked as dead code but still present in repository, causing:
- Repository bloat
- Potential confusion for developers
- Maintenance overhead

**Content:**
```
DEAD ENGINE/
├── cli_v1/
│   ├── index.ts
│   ├── registry.ts
│   └── shell.ts
├── config.ts
├── crypto.ts
├── db.ts
├── fixEnv.ts
├── middleware.ts
├── utils.ts
└── websocket.ts
```

**Remediation:**
```bash
# If confirmed unused, remove directory
rm -rf "DEAD ENGINE"

# Alternative: Archive to separate repository if historical reference needed
# git mv "DEAD ENGINE" ../velum-archive/dead-engine
```

**Status:** 🟢 **TRIVIAL** - Remove if confirmed unused

---

### DEAD-003: Unused Import in Shell
**Severity:** LOW  
**Location:** `cli/v2/shell.ts:1`

**Issue:**
Duplicate import of `readline` module - imported at line 1 and again at line 243.

**Evidence:**
```typescript
// Line 1
import * as readline from 'readline';

// Line 243 - duplicate import
const readline = require('readline');
```

**Remediation:**
```typescript
// Remove line 1, keep the require at line 243
// Or standardize on ES6 import and remove line 243
```

**Status:** 🟢 **TRIVIAL** - Remove duplicate import

---

### DEAD-004: Dead Code Path in CORS
**Severity:** MEDIUM  
**Location:** `server/v2/app.ts:99-115`

**Issue:**
CORS callback always returns `true`, making origin check ineffective and creating:
- Security vulnerability (CORS bypass)
- False sense of security
- Maintenance confusion

**Evidence:**
```typescript
const corsOptions: cors.CorsOptions = {
  origin: (requestOrigin, callback) => {
    if (!requestOrigin || 
        allowedOrigins.includes(requestOrigin) || 
        requestOrigin.startsWith('http://localhost') || 
        requestOrigin.startsWith('http://127.0.0.1') || 
        requestOrigin.startsWith('capacitor://') || 
        requestOrigin.startsWith('ionic://')) {
      callback(null, true);
    } else {
      callback(null, true);  // ALWAYS ALLOWS - Dead condition
    }
  }
};
```

**Remediation:**
```typescript
const corsOptions: cors.CorsOptions = {
  origin: (requestOrigin, callback) => {
    const allowedPatterns = [
      ...allowedOrigins,
      'http://localhost:*',
      'http://127.0.0.1:*',
      'capacitor://*',
      'ionic://*'
    ];
    
    if (!requestOrigin) {
      callback(null, true); // Allow requests with no origin (mobile apps, etc.)
      return;
    }
    
    const isAllowed = allowedPatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(requestOrigin);
      }
      return pattern === requestOrigin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked unauthorized origin: ${requestOrigin}`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true
};
```

**Status:** 🟡 **IMPORTANT** - Security fix required

---

### DEAD-005: Commented Code in Logger
**Severity:** LOW  
**Location:** `server/v2/utils/logger.ts:96-97`

**Issue:**
Commented code should be removed or properly documented.

**Evidence:**
```typescript
// File transports disabled for development to avoid import issues
// Re-enable for production with proper dependency setup
```

**Remediation:**
```typescript
// Option 1: Remove if obsolete
// (Delete the commented lines)

// Option 2: Implement proper feature flag
const enableFileLogging = process.env.NODE_ENV === 'production' && process.env.ENABLE_FILE_LOGGING === 'true';

if (enableFileLogging) {
  try {
    logger.add(new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }));
    logger.add(new winston.transports.File({
      filename: 'logs/combined.log'
    }));
  } catch (error) {
    console.error('Failed to initialize file logging:', error);
  }
}
```

**Status:** 🟢 **TRIVIAL** - Remove or implement properly

---

## Additional Dead Code Patterns

### Unused Variables and Functions

#### **DEAD-006: Unused Helper Functions**
**Severity:** LOW  
**Location:** Various files

**Issue:**
Helper functions defined but never called throughout codebase.

**Examples Found:**
- `cli/v2/shell.ts:2870-2875` - Unused error helper
- `server/v2/utils/crypto.ts:120-125` - Unused hash function

**Remediation:**
- Run static analysis (ESLint with no-unused-vars)
- Remove unused functions
- Document if kept for future use

---

#### **DEAD-007: Dead Type Definitions**
**Severity:** LOW  
**Location:** Multiple type files

**Issue:**
Type interfaces defined but never imported or used.

**Examples Found:**
- `src/types/unused.ts` - Contains unused interfaces
- Several unused generic types in utility files

**Remediation:**
- Use TypeScript compiler flag `--noUnusedLocals`
- Remove unused type definitions
- Document if kept for API contracts

---

### Unreachable Code

#### **DEAD-008: Unreachable Return Statements**
**Severity:** LOW  
**Location:** `server/v2/services/messageService.ts:45-50`

**Issue:**
Code after early return that can never be reached.

**Evidence:**
```typescript
if (!message) {
  return null;
}
// This code can never execute
console.log('Processing message:', message.id);
```

**Remediation:**
- Remove unreachable code
- Refactor logic flow

---

## Recommendations

### Immediate Cleanup (Within 1 Week)
1. **DEAD-001:** Remove all `.bak` and `.backup` files
2. **DEAD-002:** Remove or archive `DEAD ENGINE` directory
3. **DEAD-003:** Remove duplicate `readline` import
4. **DEAD-005:** Remove or implement commented logger code

### Important Fixes (Within 1 Month)
5. **DEAD-004:** Fix CORS origin validation (security issue)

### Ongoing Maintenance
6. Enable TypeScript strict mode to catch unused code
7. Add ESLint rule for no-unused-vars
8. Implement pre-commit hooks to prevent dead code commits
9. Regular dead code detection in CI/CD pipeline

---

## Automated Detection Commands

```bash
# Find backup files
find . -name "*.bak" -o -name "*.backup"

# Find commented code blocks (basic detection)
grep -r "^[[:space:]]*\/\/.*function\|^[[:space:]]*\/\/.*class\|^[[:space:]]*\/\/.*const" --include="*.ts" --include="*.tsx"

# TypeScript unused locals check
npx tsc --noUnusedLocals --noUnusedParameters

# ESLint unused variables check
npx eslint . --rule "no-unused-vars: error"
```

---

## Prevention Strategy

### Development Practices
1. **Code Review:** Check for dead code in pull requests
2. **Static Analysis:** Run TypeScript and ESLint in CI/CD
3. **Regular Audits:** Schedule monthly dead code reviews
4. **Documentation:** Document reason for keeping seemingly dead code

### Tooling Configuration
```json
// tsconfig.json additions
{
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}

// .eslintrc.json additions
{
  "rules": {
    "no-unused-vars": "error",
    "no-unreachable": "error",
    "no-constant-condition": "warn"
  }
}
```

---

## Conclusion

The dead code in the Velum codebase is mostly low severity cleanup items, with one medium severity security issue (CORS bypass). Regular cleanup and automated detection should prevent accumulation of dead code going forward.

**Risk Level:** LOW  
**Recommended Action:** Clean up trivial items immediately, fix CORS security issue, implement automated detection
