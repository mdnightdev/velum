#!/bin/bash

# Launch Velum with the lighter memory cap
cd ~/velum && PORT=3000 NODE_ENV=production NODE_OPTIONS="--max-old-space-size=300" npm run dev
