#!/bin/bash

# Sync local database to cloud
# Useful for moving development work to cloud IDE or sharing with friends

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

echo "[SYNC] Syncing local database to cloud..."

# Backup local database
LOCAL_BACKUP="./backups/local_before_sync.sql"
pg_dump "$DATABASE_URL" > "$LOCAL_BACKUP"
echo "[SYNC] Local backup created: $LOCAL_BACKUP"

# Restore to cloud
psql "$CLOUD_DATABASE_URL" < "$LOCAL_BACKUP"
echo "[SYNC] Database synced to cloud"

# Sync Redis if configured
if [ -n "$REDIS_URL" ] && [ -n "$CLOUD_REDIS_URL" ]; then
  echo "[SYNC] Syncing Redis..."
  redis-cli -u "$REDIS_URL" --rdb - | redis-cli -u "$CLOUD_REDIS_URL" --pipe
  echo "[SYNC] Redis synced to cloud"
fi

echo "[SYNC] Sync complete"
