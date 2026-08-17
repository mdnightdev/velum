# Critical Engineering Issues - Velum v2

**Documented:** 2026-08-15  
**Scope:** Security, Reliability, and Operational Gaps

---

## Priority 1: Security Vulnerabilities

### 1. No Rate Limiting
**Severity:** CRITICAL  
**Location:** `/server/v2/app.ts`, all route handlers

**Issue:**
All API endpoints lack rate limiting middleware. This exposes the system to:
- Brute-force attacks on authentication endpoints
- API abuse and resource exhaustion
- DoS via request flooding

**Evidence:**
```typescript
// app.ts - No rate limiting middleware applied
app.use('/v2/auth', v2AuthRouter);
app.use('/v2/bank', v2BankRouter);
// All routes unprotected
```

**Remediation:**
```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again later.'
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/v2/auth/login', authLimiter);
app.use('/v2/auth/register', authLimiter);
app.use('/v2', apiLimiter);
```

**Status:** ✅ **RESOLVED** - Rate limiting middleware added with auth limiter (5 attempts/15min) and API limiter (100 requests/15min)

---

### 2. No CORS Middleware
**Severity:** CRITICAL  
**Location:** `/server/v2/app.ts`

**Issue:**
No Cross-Origin Resource Sharing configuration allows any origin to make requests, enabling:
- CSRF attacks
- Unauthorized data access from malicious sites
- Credential leakage

**Evidence:**
```typescript
// app.ts - No CORS middleware
app.use(express.json());
// Direct to routes without CORS headers
```

**Remediation:**
```typescript
import cors from 'cors';

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id']
};

app.use(cors(corsOptions));
```

**Status:** ✅ **RESOLVED** - CORS middleware configured with origin whitelist, credentials support, and proper headers

---

### 3. Helmet Imported but Not Applied
**Severity:** HIGH  
**Location:** `/server/v2/app.ts:2`

**Issue:**
Helmet security middleware is imported but never applied, missing critical HTTP security headers:
- Missing `X-Content-Type-Options: nosniff`
- Missing `X-Frame-Options: DENY`
- Missing `X-XSS-Protection`
- Missing `Strict-Transport-Security`
- Missing `Content-Security-Policy`

**Evidence:**
```typescript
import helmet from 'helmet'; // Line 2
// ... never used in app.ts
```

**Remediation:**
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

**Status:** ✅ **RESOLVED** - Helmet middleware applied with CSP, HSTS, and security headers

---

### 4. SSL `rejectUnauthorized: false`
**Severity:** CRITICAL  
**Location:** `/server/v2/db/client.ts:32`

**Issue:**
PostgreSQL SSL configuration explicitly disables certificate verification, enabling man-in-the-middle attacks on database connections.

**Evidence:**
```typescript
ssl: useSsl ? { rejectUnauthorized: false } : false,
```

**Remediation:**
```typescript
ssl: useSsl ? { 
  rejectUnauthorized: true,
  ca: process.env.CA_CERT_PATH ? fs.readFileSync(process.env.CA_CERT_PATH) : undefined
} : false,
```

**Status:** ✅ **RESOLVED** - SSL verification enabled with optional CA cert support via DATABASE_CA_CERT environment variable

---

### 5. No Secrets Management
**Severity:** CRITICAL  
**Location:** Environment variables, `/server/v2/config.ts`

**Issue:**
All secrets stored in environment variables without:
- Encryption at rest
- Access logging
- Rotation capability
- Audit trails

**Affected Secrets:**
- `DATABASE_URL`
- `REDIS_URL`
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- `GEMINI_API_KEY`
- `DB_ENCRYPTION_KEY`, `DB_ENCRYPTION_SALT`

**Remediation:**
Integrate with a secrets manager (AWS Secrets Manager, HashiCorp Vault, or similar):
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

async function getSecret(secretName: string) {
  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  return JSON.parse(response.SecretString || '{}');
}
```

---

## Priority 2: Operational Gaps

### 6. No Structured Logging
**Severity:** HIGH  
**Location:** Entire codebase

**Issue:**
Basic `console.log/error/warn` statements throughout codebase without:
- Correlation IDs for request tracing
- Structured JSON format for log aggregation
- Log levels (DEBUG, INFO, WARN, ERROR)
- Context preservation

**Evidence:**
```typescript
console.error('[DB v2] Unexpected PostgreSQL pool error:', err.message || err);
console.warn(`[DB v2] Transient connection issue detected...`);
```

**Remediation:**
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req
  }
});

// Usage with correlation IDs
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  logger.info({ req, msg: 'Incoming request' });
  next();
});
```

---

### 7. No Automated Backups
**Severity:** HIGH  
**Location:** Database infrastructure

**Issue:**
No automated database snapshots or Point-in-Time Recovery (PITR), risking:
- Permanent data loss
- Inability to recover from corruption
- No RTO/RPO guarantees

**Remediation:**
Configure automated backups via provider (Neon, AWS RDS):
```typescript
// Neon-specific backup configuration
// Via console or API:
// - Enable PITR (7-30 day retention)
// - Configure daily snapshot schedule
// - Set backup retention policy
```

---

### 8. No Monitoring/Alerting
**Severity:** HIGH  
**Location:** Infrastructure

**Issue:**
No observability stack for:
- Error rate monitoring
- Latency tracking (P95, P99)
- Resource utilization alerts
- Business metric dashboards

**Remediation:**
```typescript
import Prometheus from 'prom-client';

const httpRequestDuration = new Prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.observe(
      { method: req.method, route: req.path, status_code: res.statusCode },
      duration
    );
  });
  next();
});
```

---

## Priority 3: Reliability Issues

### 9. No Circuit Breakers
**Severity:** MEDIUM  
**Location:** All external service calls

**Issue:**
No circuit breaking pattern for:
- Database connection failures
- Redis unavailability
- External API calls

**Remediation:**
```typescript
import { CircuitBreaker } from 'opossum';

const dbBreaker = new CircuitBreaker(executeWithRetry, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

dbBreaker.on('open', () => {
  logger.error('Database circuit breaker opened');
});
```

---

### 10. No Distributed Locking
**Severity:** MEDIUM  
**Location:** Concurrent operations

**Issue:**
Race conditions possible in:
- Session management
- Wallet transactions
- Market listing updates

**Remediation:**
```typescript
import { lock } from 'redlock';

const redlock = new Redlock([redisClient], {
  driftFactor: 0.01,
  retryCount: 10,
  retryDelay: 200,
  retryJitter: 200
});

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const lock = await redlock.acquire([`locks:${key}`], 5000);
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
```

---

## Additional Recommendations

### Database
- Add `EXPLAIN ANALYZE` for slow query monitoring
- Implement read replicas for reporting queries
- Add query result caching

### Authentication
- Implement JWT rotation for session tokens
- Add device fingerprinting validation
- Implement OAuth 2.0 for third-party integrations

### Deployment
- Add CI/CD pipeline (GitHub Actions, GitLab CI)
- Containerize with Docker multi-stage builds
- Implement blue-green deployments
- Add automated rollback capability

### Infrastructure
- Implement Infrastructure as Code (Terraform/Pulumi)
- Add Kubernetes configuration for orchestration
- Configure automated scaling policies
- Set up multi-region deployment for disaster recovery

---

## Next Steps

1. **Immediate (This Week):**
   - Add rate limiting middleware
   - Configure CORS properly
   - Apply Helmet middleware
   - Fix SSL verification

2. **Short-term (This Month):**
   - Implement structured logging
   - Integrate secrets manager
   - Set up automated backups
   - Add basic monitoring

3. **Medium-term (This Quarter):**
   - Implement circuit breakers
   - Add distributed locking
   - Set up CI/CD pipeline
   - Containerize application

4. **Long-term (This Year):**
   - Multi-region deployment
   - Full observability stack
   - Chaos engineering practices
   - Advanced security features
