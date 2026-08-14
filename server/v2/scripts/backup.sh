#!/bin/bash

# Velum Database Backup Script
# Backs up PostgreSQL and Redis data to R2 cloud storage

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
POSTGRES_BACKUP_FILE="${BACKUP_DIR}/postgres_${TIMESTAMP}.sql"
REDIS_BACKUP_FILE="${BACKUP_DIR}/redis_${TIMESTAMP}.rdb"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "[BACKUP] Starting backup at $TIMESTAMP"

# PostgreSQL Backup
echo "[BACKUP] Backing up PostgreSQL..."
pg_dump "$DATABASE_URL" > "$POSTGRES_BACKUP_FILE"
echo "[BACKUP] PostgreSQL backup complete: $POSTGRES_BACKUP_FILE"

# Redis Backup
if [ -n "$REDIS_URL" ]; then
  echo "[BACKUP] Backing up Redis..."
  redis-cli -u "$REDIS_URL" BGSAVE
  sleep 2
  echo "[BACKUP] Redis backup triggered"
fi

# Upload to R2 if configured
if [ -n "$R2_ACCOUNT_ID" ] && [ -n "$R2_ACCESS_KEY_ID" ] && [ -n "$R2_SECRET_ACCESS_KEY" ] && [ -n "$R2_BUCKET_NAME" ]; then
  echo "[BACKUP] Uploading to R2..."
  
  # Upload PostgreSQL backup
  aws s3 cp "$POSTGRES_BACKUP_FILE" \
    "s3://${R2_BUCKET_NAME}/backups/postgres_${TIMESTAMP}.sql" \
    --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
    --region auto
  
  echo "[BACKUP] Upload complete"
else
  echo "[BACKUP] R2 not configured, skipping cloud upload"
fi

# Cleanup old backups (keep last 7 days)
find "$BACKUP_DIR" -name "postgres_*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "redis_*.rdb" -mtime +7 -delete

echo "[BACKUP] Backup complete"
