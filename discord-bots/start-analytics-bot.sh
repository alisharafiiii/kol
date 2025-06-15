#!/bin/bash

# Kill any existing analytics bot instances
echo "🛑 Stopping any existing analytics bot instances..."
pkill -f "node.*analytics-bot.js" 2>/dev/null || true

# Wait for processes to die
sleep 2

# Start the bot
echo "🚀 Starting analytics bot..."
cd "$(dirname "$0")/.."
nohup node discord-bots/analytics-bot.js > analytics-bot-debug.log 2>&1 &
PID=$!

echo "✅ Analytics bot started with PID: $PID"
echo "📝 Logs are being written to analytics-bot-debug.log"
echo ""
echo "To check if the bot is running: ps aux | grep analytics-bot"
echo "To stop the bot: pkill -f analytics-bot.js"
echo "To view logs: tail -f analytics-bot-debug.log" 