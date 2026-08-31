#!/bin/bash

# Velum DDOS Recovery Script
# Emergency response: backup from DATABASE_URL, recovery options
# Uses DATABASE_URL and REDIS_URL from .env file

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to load .env file
load_env() {
  local env_file="$1"
  if [ -f "$env_file" ]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ -z "$line" ]] && continue
      export "$line"
    done < "$env_file"
  fi
}

# Load environment variables from multiple locations
load_env ".env"
load_env ".env.local"
load_env "server/v2/.env"

# Configuration
BACKUP_DIR="./backups"
EMERGENCY_DIR="./emergency"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Check DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}[DDOS-RECOVERY] DATABASE_URL not set in .env file${NC}"
  exit 1
fi

echo -e "${RED}[DDOS-RECOVERY] EMERGENCY RECOVERY MODE ACTIVATED${NC}"
echo -e "${YELLOW}[DDOS-RECOVERY] Timestamp: $TIMESTAMP${NC}"
echo ""

# Create emergency directory
mkdir -p "$EMERGENCY_DIR"
mkdir -p "$BACKUP_DIR"

# Function to confirm critical action
confirm_action() {
  local message=$1
  echo -e "${YELLOW}[DDOS-RECOVERY] $message${NC}"
  read -p "Type 'CONFIRM' to proceed: " confirmation
  if [ "$confirmation" != "CONFIRM" ]; then
    echo -e "${RED}[DDOS-RECOVERY] Action cancelled by user${NC}"
    exit 1
  fi
}

# Step 1: Emergency PostgreSQL Backup
echo -e "${YELLOW}[DDOS-RECOVERY] Step 1: Creating emergency backup...${NC}"

EMERGENCY_PG_BACKUP="${EMERGENCY_DIR}/emergency_postgres_${TIMESTAMP}.sql"

pg_dump "$DATABASE_URL" > "$EMERGENCY_PG_BACKUP" 2>/dev/null
if [ $? -eq 0 ]; then
  echo -e "${GREEN}[DDOS-RECOVERY] Emergency backup created: $EMERGENCY_PG_BACKUP${NC}"
else
  echo -e "${RED}[DDOS-RECOVERY] Failed to create backup${NC}"
  exit 1
fi

# Step 2: Redis Emergency Handling (if local)
echo -e "${YELLOW}[DDOS-RECOVERY] Step 2: Redis handling...${NC}"

if [[ "$REDIS_URL" =~ localhost ]] || [[ "$REDIS_URL" =~ 127\.0\.0\.1 ]] || [ -z "$REDIS_URL" ]; then
  REDIS_PORT=6379
  if [[ "$REDIS_URL" =~ :([0-9]+) ]]; then
    REDIS_PORT="${BASH_REMATCH[1]}"
  fi
  
  if redis-cli -p $REDIS_PORT ping > /dev/null 2>&1; then
    echo -e "${YELLOW}[DDOS-RECOVERY] Flush Redis cache?${NC}"
    read -p "Flush Redis? (yes/no): " flush_redis
    if [ "$flush_redis" = "yes" ]; then
      redis-cli -p $REDIS_PORT FLUSHALL > /dev/null 2>&1
      echo -e "${GREEN}[DDOS-RECOVERY] Redis flushed${NC}"
    fi
  fi
else
  echo -e "${YELLOW}[DDOS-RECOVERY] Cloud Redis - manual intervention may be needed${NC}"
fi

# Step 3: Database Lock
echo -e "${YELLOW}[DDOS-RECOVERY] Step 3: Creating database lock file...${NC}"
touch "${EMERGENCY_DIR}/database.lock"
echo "Database locked at $TIMESTAMP due to DDOS emergency" > "${EMERGENCY_DIR}/database.lock"
echo -e "${GREEN}[DDOS-RECOVERY] Database lock created${NC}"

# Step 4: Forensic Report
echo -e "${YELLOW}[DDOS-RECOVERY] Step 4: Creating forensic report...${NC}"

FORENSIC_LOG="${EMERGENCY_DIR}/forensic_${TIMESTAMP}.log"
cat > "$FORENSIC_LOG" << EOF
DDOS Emergency Recovery - Forensic Report
Timestamp: $TIMESTAMP
==========================================

Emergency Actions Taken:
- Emergency backup created: $EMERGENCY_PG_BACKUP
- Database lock implemented
- Forensic report created

Environment:
- DATABASE_URL: ${DATABASE_URL:0:20}...
- REDIS_URL: ${REDIS_URL:0:20}...
- NODE_ENV: $NODE_ENV
EOF

echo -e "${GREEN}[DDOS-RECOVERY] Forensic report created: $FORENSIC_LOG${NC}"

# Step 5: Recovery Options
echo ""
echo -e "${YELLOW}[DDOS-RECOVERY] Recovery Options:${NC}"
echo -e "1. Restore from backup file"
echo -e "2. Restore from emergency backup"
echo -e "3. Keep current state for analysis"
echo -e "4. Exit"
echo ""
read -p "Select option (1-4): " recovery_option

case $recovery_option in
  1)
    echo -e "${YELLOW}[DDOS-RECOVERY] Available backups:${NC}"
    ls -lh "$BACKUP_DIR"/postgres_*.sql 2>/dev/null || echo "No backups found"
    echo ""
    read -p "Enter backup filename: " backup_file
    if [ -f "$backup_file" ]; then
      confirm_action "Restore from $backup_file?"
      psql "$DATABASE_URL" < "$backup_file"
      echo -e "${GREEN}[DDOS-RECOVERY] Database restored${NC}"
    else
      echo -e "${RED}[DDOS-RECOVERY] Backup file not found${NC}"
    fi
    ;;
  2)
    confirm_action "Restore from emergency backup?"
    psql "$DATABASE_URL" < "$EMERGENCY_PG_BACKUP"
    echo -e "${GREEN}[DDOS-RECOVERY] Database restored from emergency backup${NC}"
    ;;
  3)
    echo -e "${YELLOW}[DDOS-RECOVERY] Current state preserved. Review logs in: $EMERGENCY_DIR${NC}"
    ;;
  4)
    echo -e "${YELLOW}[DDOS-RECOVERY] Exiting. Database lock remains${NC}"
    exit 0
    ;;
  *)
    echo -e "${RED}[DDOS-RECOVERY] Invalid option${NC}"
    exit 1
    ;;
esac

# Step 6: Unlock Database
echo ""
echo -e "${YELLOW}[DDOS-RECOVERY] Step 6: Removing database lock...${NC}"
rm -f "${EMERGENCY_DIR}/database.lock"
echo -e "${GREEN}[DDOS-RECOVERY] Database unlocked${NC}"

# Final Summary
echo ""
echo -e "${GREEN}[DDOS-RECOVERY] DDOS RECOVERY COMPLETE${NC}"
echo -e "${YELLOW}[DDOS-RECOVERY] Emergency artifacts: $EMERGENCY_DIR${NC}"
echo -e "${YELLOW}[DDOS-RECOVERY] Next steps: Review logs, analyze attack patterns, implement rate limiting${NC}"
