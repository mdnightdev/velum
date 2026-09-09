#!/bin/bash

# Velum DDOS & Emergency Recovery Script
# Creates transactional database snapshots and forensic logs
# Strictly consumes DATABASE_URL and REDIS_URL from .env file

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Function to load .env file
load_env() {
  local env_file="$1"
  if [ -f "$env_file" ]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ -z "$line" ]] && continue
      key=$(echo "$line" | cut -d '=' -f 1 | xargs)
      val=$(echo "$line" | cut -d '=' -f 2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
      if [ -n "$key" ] && [ -z "${!key}" ]; then
        export "$key=$val"
      fi
    done < "$env_file"
  fi
}

load_env ".env"
load_env ".env.local"
load_env "server/v2/.env"

BACKUP_DIR="./backups"
EMERGENCY_DIR="./emergency"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}[DDOS-RECOVERY] ERROR: DATABASE_URL not set in environment or .env file${NC}"
  exit 1
fi

echo -e "${RED}[DDOS-RECOVERY] EMERGENCY RECOVERY MODE ACTIVATED${NC}"
echo -e "${YELLOW}[DDOS-RECOVERY] Timestamp: $TIMESTAMP${NC}"
echo ""

mkdir -p "$EMERGENCY_DIR"
mkdir -p "$BACKUP_DIR"

confirm_action() {
  local message=$1
  echo -e "${YELLOW}[DDOS-RECOVERY] $message${NC}"
  read -p "Type 'CONFIRM' to proceed: " confirmation
  if [ "$confirmation" != "CONFIRM" ]; then
    echo -e "${RED}[DDOS-RECOVERY] Action cancelled by operator.${NC}"
    exit 1
  fi
}

# Step 1: PostgreSQL Emergency Snapshot
echo -e "${YELLOW}[DDOS-RECOVERY] Step 1: Creating emergency database snapshot...${NC}"
EMERGENCY_PG_BACKUP="${EMERGENCY_DIR}/emergency_postgres_${TIMESTAMP}.sql"

if pg_dump "$DATABASE_URL" > "$EMERGENCY_PG_BACKUP" 2>/dev/null; then
  echo -e "${GREEN}[DDOS-RECOVERY] Emergency snapshot saved: $EMERGENCY_PG_BACKUP${NC}"
else
  echo -e "${RED}[DDOS-RECOVERY] Failed to dump database. Ensure pg_dump is installed and credentials are valid.${NC}"
  exit 1
fi

# Step 2: Redis Stream Flush (if configured)
if [ -n "$REDIS_URL" ]; then
  echo -e "${YELLOW}[DDOS-RECOVERY] Step 2: Redis Cache Assessment...${NC}"
  if redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1; then
    read -p "Flush active Redis queue and invalidate message stream sessions? (yes/no): " flush_redis
    if [ "$flush_redis" = "yes" ]; then
      confirm_action "Flushing Redis will disconnect active web/mobile real-time listeners"
      redis-cli -u "$REDIS_URL" FLUSHALL > /dev/null 2>&1
      echo -e "${GREEN}[DDOS-RECOVERY] Redis caches flushed successfully.${NC}"
    fi
  fi
fi

# Step 3: Forensic Audit Summary
echo -e "${YELLOW}[DDOS-RECOVERY] Step 3: Generating forensic audit report...${NC}"
FORENSIC_LOG="${EMERGENCY_DIR}/forensic_${TIMESTAMP}.log"
echo "Velum DDOS Emergency Recovery Report" > "$FORENSIC_LOG"
echo "Timestamp: $TIMESTAMP" >> "$FORENSIC_LOG"
echo "Snapshot: $EMERGENCY_PG_BACKUP" >> "$FORENSIC_LOG"
echo "Database: $(echo "$DATABASE_URL" | sed -E 's/:[^:]+@/:***@/g')" >> "$FORENSIC_LOG"

echo -e "${GREEN}[DDOS-RECOVERY] Forensic log recorded: $FORENSIC_LOG${NC}"
echo -e "${GREEN}[DDOS-RECOVERY] Recovery sequence concluded.${NC}"
