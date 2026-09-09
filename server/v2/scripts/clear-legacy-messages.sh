#!/bin/bash

# Clear legacy encrypted messages from database
# This script runs the SQL cleanup script against PostgreSQL

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not set in .env"
  exit 1
fi

echo "Clearing legacy encrypted messages..."

# Run the SQL script
psql "$DATABASE_URL" < "server/v2/scripts/clear-legacy-messages.sql"

echo "✅ Legacy message cleanup complete"
