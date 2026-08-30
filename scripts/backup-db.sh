#!/bin/bash

# Velum Database Backup Script
# Supports both local PostgreSQL and cloud providers (Neon, AWS RDS)

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/velum}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting database backup at $(date)"

# Extract database connection details from DATABASE_URL
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

# Set PGPASSWORD for pg_dump
export PGPASSWORD="$DB_PASSWORD"

# Perform backup
BACKUP_FILE="$BACKUP_DIR/velum_backup_${TIMESTAMP}.sql"

if command -v pg_dump &> /dev/null; then
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
    echo "Backup completed: $BACKUP_FILE"
else
    echo "Error: pg_dump not found. Please install PostgreSQL client tools."
    exit 1
fi

# Compress backup
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"
echo "Backup compressed: $BACKUP_FILE"

# Clean up old backups (keep last RETENTION_DAYS days)
find "$BACKUP_DIR" -name "velum_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
echo "Cleaned up backups older than $RETENTION_DAYS days"

# Unset password for security
unset PGPASSWORD

echo "Backup process completed at $(date)"