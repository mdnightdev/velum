#!/bin/bash

# Velum Dev Environment Starter
# Starts local Redis if configured as local, runs Drizzle sync, and launches dev server
# Strictly consumes DATABASE_URL, REDIS_URL, and PORT from environment / .env file

set -e

# ANSI Output Styling
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
      # Strip outer quotes if present
      key=$(echo "$line" | cut -d '=' -f 1 | xargs)
      val=$(echo "$line" | cut -d '=' -f 2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
      if [ -n "$key" ] && [ -z "${!key}" ]; then
        export "$key=$val"
      fi
    done < "$env_file"
  fi
}

# Load environment variables
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

echo -e "${CYAN}[DEV-START] Database configured from environment.${NC}"

# Redis Setup: Only initialize local daemon if REDIS_URL explicitly references localhost/127.0.0.1
if [ -n "$REDIS_URL" ] && ([[ "$REDIS_URL" =~ localhost ]] || [[ "$REDIS_URL" =~ 127\.0\.0\.1 ]]); then
  echo -e "${YELLOW}[DEV-START] Managing local Redis instance...${NC}"
  
  REDIS_PORT=6379
  if [[ "$REDIS_URL" =~ :([0-9]+) ]]; then
    REDIS_PORT="${BASH_REMATCH[1]}"
  fi
  
  if redis-cli -p "$REDIS_PORT" ping > /dev/null 2>&1; then
    echo -e "${GREEN}[DEV-START] Local Redis already running on port ${REDIS_PORT}.${NC}"
  else
    mkdir -p "$REDIS_DATA_DIR"
    redis-server --port "$REDIS_PORT" --daemonize yes --dir "$REDIS_DATA_DIR" --logfile "$REDIS_DATA_DIR/redis.log"
    echo -e "${GREEN}[DEV-START] Local Redis daemon started on port ${REDIS_PORT}.${NC}"
  fi
elif [ -n "$REDIS_URL" ]; then
  echo -e "${CYAN}[DEV-START] Using remote Redis stream bus from environment.${NC}"
else
  echo -e "${YELLOW}[DEV-START] REDIS_URL not specified; server will operate in memory event mode.${NC}"
fi

# Run Drizzle push to synchronize active database schema
echo -e "${YELLOW}[DEV-START] Synchronizing schema via Drizzle...${NC}"
npx drizzle-kit push

echo -e "${GREEN}[DEV-START] Starting Velum development server on port ${DEV_SERVER_PORT}...${NC}"
npm run dev
