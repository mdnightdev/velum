# Database Backup & Sync Scripts

Automated backup and sync scripts for PostgreSQL and Redis data using Drizzle ORM.

## Environment Setup

Add these variables to your `.env` file:

```bash
# Primary Database (Local or Cloud)
DATABASE_URL=postgresql://localhost/velum

# Cloud Database (for sync scripts)
CLOUD_DATABASE_URL=postgresql://neon.tech/...

# Redis (Local)
REDIS_URL=redis://localhost:6379

# Cloud Redis (for sync scripts)
CLOUD_REDIS_URL=redis://cloud-redis:6379

# Cloudflare R2 (for backup storage)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=velum-backups
R2_PUBLIC_URL=https://your-bucket.r2.dev
```

## Usage

### Backup Database
```bash
npm run backup
# or
bash server/v2/scripts/backup.sh
```
Backs up PostgreSQL and Redis to local `./backups/` directory and uploads to R2 if configured.

### Restore Database
```bash
npm run restore backups/postgres_20240804_120000.sql
# or
bash server/v2/scripts/restore.sh backups/postgres_20240804_120000.sql
```
Restores database from a backup file.

### Sync to Cloud
```bash
npm run sync-to-cloud
# or
bash server/v2/scripts/sync-to-cloud.sh
```
Syncs local database to cloud (CLOUD_DATABASE_URL). Useful for moving to cloud IDE.

### Sync from Cloud
```bash
npm run sync-from-cloud
# or
bash server/v2/scripts/sync-from-cloud.sh
```
Syncs cloud database to local. Useful for pulling down cloud data.

### Clear Legacy Messages
```bash
bash server/v2/scripts/clear-legacy-messages.sh
```
Removes legacy encrypted messages (ratchet:v1 format) from the database to clean up chat history.

## Features

- **Automated backups**: Timestamped backups stored locally and in R2
- **Database portability**: Easy switch between local and cloud databases
- **Redis support**: Backs up and syncs Redis data
- **Cleanup**: Automatically removes backups older than 7 days
- **Safety**: Creates local backups before overwriting
- **R2 integration**: Uploads backups to Cloudflare R2 for cloud storage
- **Legacy cleanup**: Removes old encryption format messages

## Requirements

- PostgreSQL client tools (`pg_dump`, `psql`)
- Redis CLI (`redis-cli`)
- AWS CLI (for R2 uploads, optional)
