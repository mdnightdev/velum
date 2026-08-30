#!/bin/bash

# Velum Database Restore Script
# Restores database from a backup file

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/velum_backup_*.sql.gz 2>/dev/null || echo "No backups found in $BACKUP_DIR"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Extract database connection details from DATABASE_URL
DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/velum}"

if [[ $DATABASE_URL =~ (postgres|postgresql)://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/([^?]+) ]]; then
    DB_USER="${BASH_REMATCH[2]}"
    DB_PASSWORD="${BASH_REMATCH[3]}"
    DB_HOST="${BASH_REMATCH[4]}"
    DB_PORT="${BASH_REMATCH[5]:-5432}"
    DB_NAME="${BASH_REMATCH[6]}"
else
    echo "Error: Invalid DATABASE_URL format"
    exit 1
fi

# Set PGPASSWORD for psql
export PGPASSWORD="$DB_PASSWORD"

echo "Starting database restore from: $BACKUP_FILE"
echo "This will overwrite the current database. Press Ctrl+C to cancel or Enter to continue."
read

# Decompress and restore
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
else
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
fi

echo "Database restore completed successfully"

# Unset password for security
unset PGPASSWORD