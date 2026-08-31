#!/bin/bash

# Velum Dev Environment Starter
# 1. Loads .env configurations
# 2. Checks & starts PostgreSQL if local service is stopped
# 3. Checks & starts Redis if local
# 4. Executes Drizzle schema push
# 5. Launches development server

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

REDIS_DATA_DIR="./redis-data"
DEV_SERVER_PORT=${PORT:-3000}

echo -e "${GREEN}[DEV-START] Initializing Velum dev environment${NC}"

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}[DEV-START] ERROR: DATABASE_URL is not defined in your environment or .env file${NC}"
  exit 1
fi

# Step 1: PostgreSQL Health & Readiness Check
echo -e "${YELLOW}[DEV-START] Step 1/4: Checking PostgreSQL database availability...${NC}"
if [[ "$DATABASE_URL" =~ localhost ]] || [[ "$DATABASE_URL" =~ 127\.0\.0\.1 ]]; then
  if command -v pg_isready &> /dev/null; then
    if ! pg_isready -d "$DATABASE_URL" -q; then
      echo -e "${YELLOW}[DEV-START] Local PostgreSQL is not responding. Attempting service startup...${NC}"
      if command -v service &> /dev/null; then
        service postgresql start || true
      elif command -v systemctl &> /dev/null; then
        systemctl start postgresql || true
      fi
    fi
  fi
fi

# Wait briefly for PostgreSQL connection to accept sockets
for i in {1..10}; do
  if command -v pg_isready &> /dev/null; then
    if pg_isready -d "$DATABASE_URL" -q; then
      echo -e "${GREEN}[DEV-START] PostgreSQL is ready.${NC}"
      break
    fi
  else
    break
  fi
  sleep 1
done

# Step 2: Redis Initialization
echo -e "${YELLOW}[DEV-START] Step 2/4: Checking Redis connection...${NC}"
if [ -n "$REDIS_URL" ] && ([[ "$REDIS_URL" =~ localhost ]] || [[ "$REDIS_URL" =~ 127\.0\.0\.1 ]]); then
  REDIS_PORT=6379
  if [[ "$REDIS_URL" =~ :([0-9]+) ]]; then
    REDIS_PORT="${BASH_REMATCH[1]}"
  fi
  
  if redis-cli -p "$REDIS_PORT" ping > /dev/null 2>&1; then
    echo -e "${GREEN}[DEV-START] Local Redis already active on port ${REDIS_PORT}.${NC}"
  else
    # Resolve absolute directory path and touch logfile
    SCRIPT_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    ABS_REDIS_DATA_DIR="${SCRIPT_ROOT_DIR}/redis-data"
    mkdir -p "$ABS_REDIS_DATA_DIR"
    touch "${ABS_REDIS_DATA_DIR}/redis.log"

    redis-server --port "$REDIS_PORT" --daemonize yes --dir "$ABS_REDIS_DATA_DIR" --logfile "${ABS_REDIS_DATA_DIR}/redis.log" || {
      # Fallback without custom logfile if daemonize succeeds
      redis-server --port "$REDIS_PORT" --daemonize yes || true
    }
    
    # Verify Redis started
    for r in {1..5}; do
      if redis-cli -p "$REDIS_PORT" ping > /dev/null 2>&1; then
        echo -e "${GREEN}[DEV-START] Local Redis started on port ${REDIS_PORT}.${NC}"
        break
      fi
      sleep 1
    done
  fi
elif [ -n "$REDIS_URL" ]; then
  echo -e "${CYAN}[DEV-START] Using remote Redis stream bus.${NC}"
else
  echo -e "${YELLOW}[DEV-START] REDIS_URL not configured. Operating in fallback memory mode.${NC}"
fi

# Step 3: Drizzle Schema Synchronization
echo -e "${YELLOW}[DEV-START] Step 3/4: Synchronizing Drizzle ORM schema...${NC}"
npx drizzle-kit push

# Step 4: Start Development Server
echo -e "${GREEN}[DEV-START] Step 4/4: Launching Velum development server on port ${DEV_SERVER_PORT}...${NC}"
npm run dev
