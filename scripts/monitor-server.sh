#!/bin/bash

# Server Monitoring Script
# Real-time monitoring of server health, memory, connections, and logs

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load environment variables cleanly (stripping surrounding quotes and spaces)
load_env() {
  local env_file="$1"
  if [ -f "$env_file" ]; then
    while IFS='=' read -r key val || [[ -n "$key" ]]; do
      [[ "$key" =~ ^[[:space:]]*# ]] && continue
      [[ -z "$key" ]] && continue
      key=$(echo "$key" | xargs)
      val=$(echo "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^["'"'"']//' -e 's/["'"'"']$//')
      export "$key=$val"
    done < "$env_file"
  fi
}

load_env ".env"
load_env ".env.local"
load_env "server/.env"
load_env "server/v2/.env"

# Configuration
TARGET_URL="${APP_URL:-http://localhost:3000}"
LOG_FILE="./server-monitor.log"
MONITOR_DURATION=${1:-60}

# Create log file
touch "$LOG_FILE"

# Function to check server health
check_health() {
  local response=$(curl -s -w "\n%{http_code}" "$TARGET_URL/health" 2>/dev/null)
  local http_code=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | head -n-1)
  
  if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}[HEALTH] Server is ONLINE${NC}"
    echo "$body" | jq -r '["\(.status)", "\(.version)", "\(.env)"] | @tsv' 2>/dev/null || echo "$body"
  else
    echo -e "${RED}[HEALTH] Server is OFFLINE (HTTP $http_code)${NC}"
  fi
}

# Function to check server metrics
check_metrics() {
  local response=$(curl -s "$TARGET_URL/metrics" 2>/dev/null)
  
  if [ -n "$response" ]; then
    echo -e "${CYAN}[METRICS] Server Metrics Available${NC}"
    echo "$response" | grep -E "(http_requests|memory_usage|active_connections)" | head -5
  else
    echo -e "${YELLOW}[METRICS] Metrics endpoint not available${NC}"
  fi
}

# Function to monitor memory usage
monitor_memory() {
  local pid=$(pgrep -f "node.*server" | head -1)
  if [ -n "$pid" ]; then
    local memory_usage=$(ps -o rss= -p "$pid" 2>/dev/null)
    if [ -n "$memory_usage" ]; then
      local memory_mb=$((memory_usage / 1024))
      echo -e "${BLUE}[MEMORY] Node.js Process: ${memory_mb}MB${NC}"
      
      if [ $memory_mb -gt 800 ]; then
        echo -e "${RED}[MEMORY] CRITICAL: High memory usage${NC}"
      elif [ $memory_mb -gt 500 ]; then
        echo -e "${YELLOW}[MEMORY] WARNING: Elevated memory usage${NC}"
      fi
    fi
  else
    echo -e "${RED}[MEMORY] Node.js process not found${NC}"
  fi
}

# Function to monitor database connections
monitor_db() {
  if [ -n "$DATABASE_URL" ]; then
    local db_name=$(echo "$DATABASE_URL" | sed -e 's|.*:/||' -e 's|?.*||')
    local connections=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '$db_name';" 2>/dev/null | xargs)
    
    if [ -n "$connections" ]; then
      echo -e "${BLUE}[DATABASE] Active connections: $connections${NC}"
      
      if [ "$connections" -gt 80 ] 2>/dev/null; then
        echo -e "${RED}[DATABASE] CRITICAL: High connection count${NC}"
      elif [ "$connections" -gt 50 ] 2>/dev/null; then
        echo -e "${YELLOW}[DATABASE] WARNING: Elevated connection count${NC}"
      fi
    fi
  fi
}

# Function to monitor Redis (supports Cloud URL, TLS, and Local fallback)
monitor_redis() {
  local cli_cmd="redis-cli"

  if [ -n "$REDIS_URL" ]; then
    if [[ "$REDIS_URL" == rediss://* ]]; then
      cli_cmd="redis-cli --tls -u $REDIS_URL"
    else
      cli_cmd="redis-cli -u $REDIS_URL"
    fi
  fi

  local redis_status=$($cli_cmd ping 2>/dev/null)

  # Fallback to local default redis if remote URL fails or is empty
  if [ "$redis_status" != "PONG" ]; then
    cli_cmd="redis-cli"
    redis_status=$(redis-cli ping 2>/dev/null)
  fi

  if [ "$redis_status" = "PONG" ]; then
    local redis_memory=$($cli_cmd info memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '\r')
    local redis_clients=$($cli_cmd info clients 2>/dev/null | grep connected_clients | cut -d: -f2 | tr -d '\r')

    echo -e "${GREEN}[REDIS] Status: ONLINE${NC}"
    [ -n "$redis_memory" ] && echo -e "${BLUE}[REDIS] Memory: $redis_memory${NC}"
    [ -n "$redis_clients" ] && echo -e "${BLUE}[REDIS] Clients: $redis_clients${NC}"
  else
    echo -e "${RED}[REDIS] Status: OFFLINE${NC}"
  fi
}

# Function to check recent error logs
check_recent_errors() {
  echo -e "${CYAN}[LOGS] Recent errors (last 10):${NC}"
  
  if [ -f "./server/logs/combined.log" ]; then
    tail -10 "./server/logs/combined.log" | grep -i "error\|warn\|critical" || echo "No recent errors found"
  elif [ -f "./server/logs/error.log" ]; then
    tail -10 "./server/logs/error.log" | grep -i "error\|warn\|critical" || echo "No recent errors found"
  else
    echo -e "${YELLOW}[LOGS] No log files found${NC}"
  fi
}

# Function to show process status
show_process_status() {
  echo -e "${CYAN}[PROCESS] Server Process Status:${NC}"
  
  local pid=$(pgrep -f "node.*server" | head -1)
  if [ -n "$pid" ]; then
    local cpu_usage=$(ps -o %cpu= -p "$pid" 2>/dev/null | xargs)
    local memory_usage=$(ps -o rss= -p "$pid" 2>/dev/null | xargs)
    local uptime=$(ps -o etime= -p "$pid" 2>/dev/null | xargs)
    
    echo -e "${GREEN}[PROCESS] Running (PID: $pid)${NC}"
    [ -n "$cpu_usage" ] && echo -e "${BLUE}[PROCESS] CPU: ${cpu_usage}%${NC}"
    [ -n "$memory_usage" ] && echo -e "${BLUE}[PROCESS] Memory: $((memory_usage / 1024))MB${NC}"
    [ -n "$uptime" ] && echo -e "${BLUE}[PROCESS] Uptime: $uptime${NC}"
  else
    echo -e "${RED}[PROCESS] NOT RUNNING${NC}"
  fi
}

# Main monitoring loop
echo -e "${CYAN}[MONITOR] Server Monitoring Started${NC}"
echo -e "${YELLOW}[MONITOR] Target: $TARGET_URL${NC}"
echo -e "${YELLOW}[MONITOR] Duration: ${MONITOR_DURATION}s${NC}"
echo -e "${YELLOW}[MONITOR] Press Ctrl+C to stop${NC}"
echo ""

uptime=$(date +%s)

while [ $(($(date +%s) - uptime)) -lt $MONITOR_DURATION ]; do
  clear
  echo -e "${CYAN}==========================================${NC}"
  echo -e "${CYAN}   SERVER MONITOR - $(date '+%Y-%m-%d %H:%M:%S')${NC}"
  echo -e "${CYAN}==========================================${NC}"
  echo ""
  
  show_process_status
  echo ""
  
  check_health
  echo ""
  
  monitor_memory
  echo ""
  
  monitor_db
  echo ""
  
  monitor_redis
  echo ""
  
  check_metrics
  echo ""
  
  check_recent_errors
  echo ""
  
  echo -e "${CYAN}==========================================${NC}"
  echo -e "${YELLOW}[MONITOR] Refreshing in 5 seconds...${NC}"
  echo -e "${YELLOW}[MONITOR] Time remaining: $((MONITOR_DURATION - ($(date +%s) - uptime)))s${NC}"
  
  sleep 5
done

echo ""
echo -e "${GREEN}[MONITOR] Monitoring complete${NC}"
echo -e "${YELLOW}[MONITOR] Full log saved to: $LOG_FILE${NC}"
