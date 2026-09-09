#!/bin/bash

# Advanced DDOS Simulation Script
# Simulates aggressive attack patterns for testing recovery procedures
# USE ONLY FOR TESTING YOUR OWN SERVERS

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Load environment variables
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

load_env ".env"
load_env ".env.local"
load_env "server/v2/.env"

# Configuration
TARGET_URL="${APP_URL:-http://localhost:3000}"
DURATION=${1:-60}  # Default 60 seconds
CONCURRENCY=${2:-50}  # Default 50 concurrent requests

echo -e "${RED}[DDOS-SIM] ADVANCED DDOS SIMULATION MODE${NC}"
echo -e "${YELLOW}[DDOS-SIM] Target: $TARGET_URL${NC}"
echo -e "${YELLOW}[DDOS-SIM] Duration: ${DURATION}s${NC}"
echo -e "${YELLOW}[DDOS-SIM] Concurrency: $CONCURRENCY${NC}"
echo ""
echo -e "${RED}[DDOS-SIM] WARNING: This will aggressively attack your server${NC}"
echo -e "${RED}[DDOS-SIM] May cause service degradation or crashes${NC}"
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Cancelled"
  exit 0
fi

echo -e "${CYAN}[DDOS-SIM] Starting advanced DDOS simulation...${NC}"
echo ""

# Function to simulate HTTP flood
http_flood() {
  local duration=$1
  local concurrency=$2
  local endpoint=$3
  
  echo -e "${YELLOW}[DDOS-SIM] HTTP Flood on $endpoint ($concurrency concurrent)${NC}"
  
  for ((i=0; i<concurrency; i++)); do
    (
      start_time=$(date +%s)
      while [ $(($(date +%s) - start_time)) -lt $duration ]; do
        curl -s -o /dev/null -w "%{http_code}\n" "$TARGET_URL$endpoint" > /dev/null 2>&1 || true
      done
    ) &
  done
}

# Function to simulate authentication attack
auth_flood() {
  local duration=$1
  local concurrency=$2
  
  echo -e "${YELLOW}[DDOS-SIM] Authentication Flood ($concurrency concurrent)${NC}"
  
  for ((i=0; i<concurrency; i++)); do
    (
      start_time=$(date +%s)
      while [ $(($(date +%s) - start_time)) -lt $duration ]; do
        curl -s -X POST "$TARGET_URL/v2/auth/login" \
          -H "Content-Type: application/json" \
          -d '{"username":"test","password":"wrong"}' > /dev/null 2>&1 || true
        sleep 0.05
      done
    ) &
  done
}

# Function to simulate API endpoint flood
api_flood() {
  local duration=$1
  local concurrency=$2
  
  echo -e "${YELLOW}[DDOS-SIM] API Endpoint Flood ($concurrency concurrent)${NC}"
  
  endpoints=(
    "/v2/user/profile"
    "/v2/marketplace/listings"
    "/v2/lounges"
    "/v2/tickets"
    "/v2/bank/balance"
    "/health"
    "/metrics"
  )
  
  for ((i=0; i<concurrency; i++)); do
    (
      start_time=$(date +%s)
      while [ $(($(date +%s) - start_time)) -lt $duration ]; do
        endpoint="${endpoints[$RANDOM % ${#endpoints[@]}]}"
        curl -s -o /dev/null "$TARGET_URL$endpoint" > /dev/null 2>&1 || true
      done
    ) &
  done
}

# Function to simulate Slowloris attack
slowloris_attack() {
  local duration=$1
  local concurrency=$2
  
  echo -e "${YELLOW}[DDOS-SIM] Slowloris Attack ($concurrency connections)${NC}"
  
  for ((i=0; i<concurrency; i++)); do
    (
      start_time=$(date +%s)
      while [ $(($(date +%s) - start_time)) -lt $duration ]; do
        # Slow request with long timeout
        curl -s -m 30 --connect-timeout 25 --max-time 30 "$TARGET_URL/" > /dev/null 2>&1 || true
        sleep 5
      done
    ) &
  done
}

# Function to simulate large payload attack
large_payload_attack() {
  local duration=$1
  local concurrency=$2
  
  echo -e "${YELLOW}[DDOS-SIM] Large Payload Attack ($concurrency concurrent)${NC}"
  
  for ((i=0; i<concurrency; i++)); do
    (
      start_time=$(date +%s)
      while [ $(($(date +%s) - start_time)) -lt $duration ]; do
        # Generate large payload on the fly (1MB)
        head -c 1048576 /dev/zero | tr '\0' 'A' | curl -s -X POST "$TARGET_URL/v2/user/profile" \
          -H "Content-Type: application/json" \
          -d @- > /dev/null 2>&1 || true
        sleep 1
      done
    ) &
  done
}

# Function to simulate connection exhaustion
connection_exhaustion() {
  local duration=$1
  local concurrency=$2
  
  echo -e "${YELLOW}[DDOS-SIM] Connection Exhaustion ($concurrency connections)${NC}"
  
  for ((i=0; i<concurrency; i++)); do
    (
      start_time=$(date +%s)
      while [ $(($(date +%s) - start_time)) -lt $duration ]; do
        timeout 5 curl -s -o /dev/null "$TARGET_URL/" > /dev/null 2>&1 || true
      done
    ) &
  done
}

# Function to simulate memory exhaustion
memory_exhaustion() {
  local duration=$1
  local concurrency=$2
  
  echo -e "${YELLOW}[DDOS-SIM] Memory Exhaustion Attack ($concurrency concurrent)${NC}"
  
  for ((i=0; i<concurrency; i++)); do
    (
      start_time=$(date +%s)
      while [ $(($(date +%s) - start_time)) -lt $duration ]; do
        # Create large session data requests
        curl -s -X POST "$TARGET_URL/v2/auth/login" \
          -H "Content-Type: application/json" \
          -d "{\"username\":\"user_$RANDOM\",\"password\":\"$(head -c 1000 /dev/urandom | base64)\"}" > /dev/null 2>&1 || true
        sleep 0.2
      done
    ) &
  done
}

# Function to simulate WebSocket connection flood
websocket_flood() {
  local duration=$1
  local concurrency=$2
  
  echo -e "${YELLOW}[DDOS-SIM] WebSocket Connection Flood ($concurrency connections)${NC}"
  
  for ((i=0; i<concurrency; i++)); do
    (
      start_time=$(date +%s)
      while [ $(($(date +%s) - start_time)) -lt $duration ]; do
        # Simulate WebSocket upgrade requests
        curl -s -H "Upgrade: websocket" \
          -H "Connection: Upgrade" \
          -H "Sec-WebSocket-Key: $(head -c 16 /dev/urandom | base64)" \
          -H "Sec-WebSocket-Version: 13" \
          "$TARGET_URL/" > /dev/null 2>&1 || true
        sleep 0.5
      done
    ) &
  done
}

# Start different attack phases
echo -e "${CYAN}[DDOS-SIM] Phase 1: HTTP Flood${NC}"
http_flood $((DURATION / 6)) $CONCURRENCY "/"
sleep 3

echo -e "${CYAN}[DDOS-SIM] Phase 2: Authentication Attack${NC}"
auth_flood $((DURATION / 6)) $CONCURRENCY
sleep 3

echo -e "${CYAN}[DDOS-SIM] Phase 3: API Flood${NC}"
api_flood $((DURATION / 6)) $CONCURRENCY
sleep 3

echo -e "${CYAN}[DDOS-SIM] Phase 4: Slowloris Attack${NC}"
slowloris_attack $((DURATION / 6)) $((CONCURRENCY / 2))
sleep 3

echo -e "${CYAN}[DDOS-SIM] Phase 5: Large Payload Attack${NC}"
large_payload_attack $((DURATION / 6)) $((CONCURRENCY / 3))
sleep 3

echo -e "${CYAN}[DDOS-SIM] Phase 6: Memory Exhaustion${NC}"
memory_exhaustion $((DURATION / 6)) $CONCURRENCY
sleep 3

echo -e "${CYAN}[DDOS-SIM] Phase 7: Connection Exhaustion${NC}"
connection_exhaustion $((DURATION / 6)) $CONCURRENCY
sleep 3

echo -e "${CYAN}[DDOS-SIM] Phase 8: WebSocket Flood${NC}"
websocket_flood $((DURATION / 6)) $((CONCURRENCY / 2))

# Wait for all background processes
wait

echo ""
echo -e "${GREEN}[DDOS-SIM] Advanced DDOS simulation complete${NC}"
echo -e "${YELLOW}[DDOS-SIM] Check your server logs and metrics${NC}"
echo -e "${YELLOW}[DDOS-SIM] Run recovery if needed: npm run ddos:recovery${NC}"
echo -e "${YELLOW}[DDOS-SIM] Run security scan: npm run security:scan${NC}"
