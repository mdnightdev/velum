#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

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

echo -e "${YELLOW}[DEV-STOP] Stopping Velum dev server and services...${NC}"

# Stop Node / tsx dev server process
pkill -f "tsx.*server/index.ts" > /dev/null 2>&1 || true
pkill -f "vite" > /dev/null 2>&1 || true
echo -e "${GREEN}[DEV-STOP] Dev server processes stopped.${NC}"

# Stop PostgreSQL
if command -v pg_ctl &> /dev/null; then
  if pg_ctl -D "$PREFIX/var/lib/postgresql" status > /dev/null 2>&1; then
    pg_ctl -D "$PREFIX/var/lib/postgresql" stop -m fast > /dev/null 2>&1 || true
    echo -e "${GREEN}[DEV-STOP] Local PostgreSQL stopped.${NC}"
  else
    echo -e "${YELLOW}[DEV-STOP] Local PostgreSQL was not running.${NC}"
  fi
fi

# Stop Redis
if [ -n "$REDIS_URL" ] && ([[ "$REDIS_URL" =~ localhost ]] || [[ "$REDIS_URL" =~ 127\.0\.0\.1 ]]); then
  REDIS_PORT=6379
  if [[ "$REDIS_URL" =~ :([0-9]+) ]]; then
    REDIS_PORT="${BASH_REMATCH[1]}"
  fi
  
  if redis-cli -p "$REDIS_PORT" ping > /dev/null 2>&1; then
    redis-cli -p "$REDIS_PORT" shutdown > /dev/null 2>&1 || true
    echo -e "${GREEN}[DEV-STOP] Local Redis daemon stopped on port ${REDIS_PORT}.${NC}"
  else
    echo -e "${YELLOW}[DEV-STOP] Local Redis was not running.${NC}"
  fi
else
  echo -e "${CYAN}[DEV-STOP] Remote / Cloud Redis configured; skipping local shutdown.${NC}"
fi

echo -e "${GREEN}[DEV-STOP] Teardown complete.${NC}"
