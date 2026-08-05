#!/bin/bash

# Velum Database Restore Script
# Restores PostgreSQL and Redis data from backup

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="./backups"

if [ -z "$1" ]; then
  echo "Usage: ./restore.sh <backup_file>"
  echo "Available backups:"
  ls -lh "$BACKUP_DIR"/postgres_*.sql 2>/dev/null || echo "No backups found"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "[RESTORE] Starting restore from $BACKUP_FILE"

# Confirm restore
read -p "This will replace the current database. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Restore cancelled"
  exit 0
fi

# PostgreSQL Restore
echo "[RESTORE] Restoring PostgreSQL..."
psql "$DATABASE_URL" < "$BACKUP_FILE"
echo "[RESTORE] PostgreSQL restore complete"

# Redis restore (if backup exists)
REDIS_BACKUP_FILE="${BACKUP_FILE/postgres_/redis_}"
REDIS_BACKUP_FILE="${REDIS_BACKUP_FILE/.sql/.rdb}"

if [ -f "$REDIS_BACKUP_FILE" ]; then
  echo "[RESTORE] Restoring Redis..."
  redis-cli -u "$REDIS_URL" FLUSHALL
  redis-cli -u "$REDIS_URL" --rdb "$REDIS_BACKUP_FILE"
  echo "[RESTORE] Redis restore complete"
fi

echo "[RESTORE] Restore complete"
