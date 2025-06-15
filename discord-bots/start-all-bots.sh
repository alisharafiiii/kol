#!/bin/bash

echo "🤖 Starting Discord Bots..."
echo ""

# Start engagement bot
echo "1️⃣ Starting Engagement Bot..."
./discord-bots/start-engagement-bot.sh
echo ""

# Start analytics bot
echo "2️⃣ Starting Analytics Bot..."
./discord-bots/start-analytics-bot.sh
echo ""

echo "✅ All bots started!"
echo ""
echo "📊 Bot Status Commands:"
echo "  Check all bots: ps aux | grep -E 'engagement-bot|analytics-bot'"
echo "  Stop all bots: pkill -f 'engagement-bot.js|analytics-bot.js'"
echo "  View engagement logs: tail -f bot-debug.log"
echo "  View analytics logs: tail -f analytics-bot-debug.log" 