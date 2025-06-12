#!/bin/bash

# Kill any existing bot processes
pkill -f "node bot.js" 2>/dev/null || true

# Start the bot with auto-restart on failure
while true; do
  echo "Starting Discord bot at $(date)"
  node bot.js
  echo "Bot crashed/stopped at $(date). Restarting in 5 seconds..."
  sleep 5
done 