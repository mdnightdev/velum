#!/bin/bash

# Velum Dev Environment Stopper
# Stops local Redis if it was started by dev-start
# Uses REDIS_URL from .env file

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

echo -e "${YELLOW}[DEV-STOP] Stopping Velum dev environment${NC}"
echo ""

# Redis Setup (only if local)
if [[ "$REDIS_URL" =~ localhost ]] || [[ "$REDIS_URL" =~ 127\.0\.0\.1 ]] || [ -z "$REDIS_URL" ]; then
  echo -e "${YELLOW}[DEV-STOP] Stopping local Redis...${NC}"
  
  REDIS_PORT=6379
  if [[ "$REDIS_URL" =~ :([0-9]+) ]]; then
    REDIS_PORT="${BASH_REMATCH[1]}"
  fi
  
  if redis-cli -p $REDIS_PORT ping > /dev/null 2>&1; then
    redis-cli -p $REDIS_PORT shutdown
    echo -e "${GREEN}[DEV-STOP] Redis stopped${NC}"
  else
    echo -e "${YELLOW}[DEV-STOP] Redis not running${NC}"
  fi
else
  echo -e "${CYAN}[DEV-STOP] Using cloud Redis, nothing to stop${NC}"
fi

echo -e "${GREEN}[DEV-STOP] Dev environment stopped successfully${NC}"
