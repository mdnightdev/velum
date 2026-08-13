#!/bin/bash

# Sync cloud database to local
# Useful for pulling down cloud database to local development

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$CLOUD_DATABASE_URL" ]; then
  echo "Error: CLOUD_DATABASE_URL not set in .env"
  echo "Add: CLOUD_DATABASE_URL=postgresql://..."
  exit 1
fi

echo "[SYNC] Syncing cloud database to local..."

# Backup cloud database
CLOUD_BACKUP="./backups/cloud_backup.sql"
pg_dump "$CLOUD_DATABASE_URL" > "$CLOUD_BACKUP"
echo "[SYNC] Cloud backup created: $CLOUD_BACKUP"

# Backup local database before overwriting
LOCAL_BACKUP="./backups/local_before_cloud_sync.sql"
pg_dump "$DATABASE_URL" > "$LOCAL_BACKUP"
echo "[SYNC] Local backup created: $LOCAL_BACKUP"

# Restore cloud backup to local
psql "$DATABASE_URL" < "$CLOUD_BACKUP"
echo "[SYNC] Database synced from cloud"

# Sync Redis if configured
if [ -n "$REDIS_URL" ] && [ -n "$CLOUD_REDIS_URL" ]; then
  echo "[SYNC] Syncing Redis from cloud..."
  redis-cli -u "$CLOUD_REDIS_URL" --rdb - | redis-cli -u "$REDIS_URL" --pipe
  echo "[SYNC] Redis synced from cloud"
fi

echo "[SYNC] Sync complete"
