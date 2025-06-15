#!/bin/bash

# Kill any existing instances
echo "🛑 Stopping any existing engagement bot instances..."
pkill -f "node.*engagement-bot.js" 2>/dev/null || true

# Wait for processes to die
sleep 2

# Start the bot
echo "🚀 Starting engagement bot..."
cd "$(dirname "$0")/.."
nohup node discord-bots/engagement-bot.js > bot-debug.log 2>&1 &
PID=$!

echo "✅ Engagement bot started with PID: $PID"
echo "📝 Logs are being written to bot-debug.log"
echo ""
echo "To check if the bot is running: ps aux | grep engagement-bot"
echo "To stop the bot: pkill -f engagement-bot.js"
echo "To view logs: tail -f bot-debug.log" 