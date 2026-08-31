#!/bin/bash

# Velum Dev Environment Starter
# Starts local Redis if needed, runs Drizzle sync, and launches dev server
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
REDIS_DATA_DIR="./redis-data"
DEV_SERVER_PORT=${PORT:-3000}

echo -e "${GREEN}[DEV-START] Initializing Velum dev environment${NC}"
echo ""

# Check DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}[DEV-START] DATABASE_URL not set in .env file${NC}"
  exit 1
fi

echo -e "${CYAN}[DEV-START] Using database from .env${NC}"

# Redis Setup (only if local)
if [[ "$REDIS_URL" =~ localhost ]] || [[ "$REDIS_URL" =~ 127\.0\.0\.1 ]] || [ -z "$REDIS_URL" ]; then
  echo -e "${YELLOW}[DEV-START] Setting up local Redis...${NC}"
  
  REDIS_PORT=6379
  if [[ "$REDIS_URL" =~ :([0-9]+) ]]; then
    REDIS_PORT="${BASH_REMATCH[1]}"
  fi
  
  if redis-cli -p $REDIS_PORT ping > /dev/null 2>&1; then
    echo -e "${GREEN}[DEV-START] Redis already running${NC}"
  else
    mkdir -p "$REDIS_DATA_DIR"
    redis-server --port $REDIS_PORT --daemonize yes --dir "$REDIS_DATA_DIR" --logfile "$REDIS_DATA_DIR/redis.log"
    echo -e "${GREEN}[DEV-START] Redis started${NC}"
  fi
else
  echo -e "${CYAN}[DEV-START] Using cloud Redis from .env${NC}"
fi

# Drizzle Sync Check
echo -e "${YELLOW}[DEV-START] Running Drizzle schema sync...${NC}"
npx drizzle-kit push

# Start Dev Server
echo -e "${YELLOW}[DEV-START] Starting Velum dev server on port $DEV_SERVER_PORT...${NC}"
echo -e "${GREEN}[DEV-START] Dev environment ready!${NC}"
echo ""

npm run dev
