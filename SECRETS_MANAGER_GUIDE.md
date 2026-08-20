# Secrets Manager - Quick Start Guide

## How It Works

Velum now has an encrypted secrets manager that:
- Encrypts secrets at rest using AES-256-GCM
- Stores encrypted secrets in `.env.encrypted`
- Uses a master key (`.secrets.key`) for encryption/decryption
- Generates `.env` file from encrypted secrets when needed

## Setup (One-Time)

The secrets manager already generated your master key: `.secrets.key`

**IMPORTANT:** 
- Share `.secrets.key` securely with your collaborator (encrypted message, password manager, etc.)
- Add `.secrets.key` and `.env.encrypted` to `.gitignore`
- Never commit these files to git

## Migrate Your Current Secrets

**Step 1:** Add your current `.env` secrets to the encrypted storage:

```bash
# For each secret in your .env file:
npm run secrets:set DATABASE_URL "your-database-url"
npm run secrets:set REDIS_URL "your-redis-url"
npm run secrets:set R2_ACCESS_KEY_ID "your-access-key"
npm run secrets:set R2_SECRET_ACCESS_KEY "your-secret-key"
npm run secrets:set GEMINI_API_KEY "your-api-key"
npm run secrets:set DB_ENCRYPTION_KEY "your-encryption-key"
npm run secrets:set DB_ENCRYPTION_SALT "your-salt"
```

**Step 2:** Generate new `.env` file from encrypted secrets:

```bash
npm run secrets:generate-env
```

**Step 3:** Delete your old unencrypted `.env` file:

```bash
rm .env
```

**Step 4:** Add to `.gitignore`:

```
.env
.env.encrypted
.secrets.key
```

## Daily Usage

**Check status:**
```bash
npm run secrets:status
```

**List stored secrets:**
```bash
npm run secrets:list
```

**Add a new secret:**
```bash
npm run secrets:set NEW_SECRET_KEY "secret-value"
npm run secrets:generate-env
```

**View a secret (rarely needed):**
```bash
npm run secrets:get DATABASE_URL
```

## Collaborator Setup

When your friend helps with code:

1. **Share the master key securely** (`.secrets.key`)
2. **Share the `.env.encrypted` file** (optional, you can regenerate)
3. **They run:**
   ```bash
   npm run secrets:generate-env
   ```
4. **They now have `.env` with decrypted secrets**

## Security Benefits

✅ Secrets encrypted at rest (AES-256-GCM)
✅ Master key can be shared securely with collaborators
✅ No plaintext secrets in git repository
✅ Simple CLI for daily operations
✅ Generates standard `.env` file for application

## Recovery

If you lose `.secrets.key`:
- Your secrets in `.env.encrypted` cannot be decrypted
- You'll need to re-enter all secrets from your cloud provider dashboards
- Generate a new master key and re-encrypt all secrets

**Backup recommendation:** Store `.secrets.key` in a password manager or secure location.
