#!/bin/bash

# Velum Dev Environment Stopper
# Gracefully stops local Redis daemon if running locally, without touching remote Redis
# Strictly consumes REDIS_URL from .env file

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

echo -e "${YELLOW}[DEV-STOP] Stopping Velum local background services...${NC}"

if [ -n "$REDIS_URL" ] && ([[ "$REDIS_URL" =~ localhost ]] || [[ "$REDIS_URL" =~ 127\.0\.0\.1 ]]); then
  REDIS_PORT=6379
  if [[ "$REDIS_URL" =~ :([0-9]+) ]]; then
    REDIS_PORT="${BASH_REMATCH[1]}"
  fi
  
  if redis-cli -p "$REDIS_PORT" ping > /dev/null 2>&1; then
    redis-cli -p "$REDIS_PORT" shutdown
    echo -e "${GREEN}[DEV-STOP] Local Redis daemon stopped on port ${REDIS_PORT}.${NC}"
  else
    echo -e "${YELLOW}[DEV-STOP] Local Redis was not running.${NC}"
  fi
else
  echo -e "${CYAN}[DEV-STOP] Remote / Cloud Redis configured; skipping local shutdown.${NC}"
fi

echo -e "${GREEN}[DEV-STOP] Teardown complete.${NC}"
