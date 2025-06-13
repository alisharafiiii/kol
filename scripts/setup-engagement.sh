#!/bin/bash

echo "🚀 Setting up Discord Twitter Engagement System..."

# Install required npm packages
echo "📦 Installing npm dependencies..."
npm install discord.js@latest twitter-api-v2@latest node-cron@latest

# Create required Discord bot files directory if it doesn't exist
mkdir -p discord-bots

# Move bot files to separate directory
if [ -f "engagement-bot.js" ]; then
  echo "📂 Moving bot files to discord-bots directory..."
  mv engagement-bot.js discord-bots/
fi

if [ -f "scripts/engagement-batch-processor.js" ]; then
  mv scripts/engagement-batch-processor.js discord-bots/
fi

if [ -f "scripts/engagement-cron.js" ]; then
  mv scripts/engagement-cron.js discord-bots/
fi

echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Add the required environment variables to your .env.local file:"
echo "   - DISCORD_BOT_TOKEN"
echo "   - DISCORD_APPLICATION_ID" 
echo "   - TWITTER_API_KEY"
echo "   - TWITTER_API_SECRET"
echo "   - TWITTER_ACCESS_TOKEN"
echo "   - TWITTER_ACCESS_SECRET"
echo ""
echo "2. Start the Discord bot:"
echo "   cd discord-bots && node engagement-bot.js"
echo ""
echo "3. Start the batch processor (in a separate terminal):"
echo "   cd discord-bots && node engagement-cron.js"
echo ""
echo "4. Or run the batch processor once:"
echo "   cd discord-bots && node engagement-batch-processor.js" 