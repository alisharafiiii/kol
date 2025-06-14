# 🟢 Discord Bot Status - RUNNING!

## Current Status: ✅ Bot is ACTIVE

The engagement bot is now running successfully!

### Bot Details:
- **Process ID**: Running as node process
- **Bot Name**: nabulines_bot#8452
- **Status**: Connected and ready

### Available Commands:
1. `/connect` - Connect your Twitter account
2. `/submit [url] [category]` - Submit a tweet for engagement tracking
3. `/stats` - View your engagement statistics
4. `/leaderboard` - View the engagement leaderboard
5. `/recent` - View recently submitted tweets
6. `/tier` - (Admin) Set user tier
7. `/scenarios` - (Admin) Configure tier scenarios

### How to Use:
1. **First Time Users**:
   - Use `/connect` and enter your Twitter handle
   - You must be approved in the KOL platform first
   - You'll automatically get the KOL role if you don't have a higher role

2. **Submit Tweets**:
   - Use `/submit` with a valid tweet URL
   - You can only submit your own tweets (unless you're an admin)
   - Daily limits apply based on your tier

3. **Check Your Progress**:
   - Use `/stats` to see your points and daily limit
   - Use `/leaderboard` to see top engagers
   - Use `/recent` to find tweets to engage with

### Troubleshooting:
- If commands don't appear, wait a few minutes for Discord to sync
- If you see "Unknown Command", the bot might need to be re-invited with proper permissions
- Make sure the bot has the "Manage Roles" permission to assign the KOL role

### Bot Monitoring:
To check if the bot is still running:
```bash
ps aux | grep engagement-bot | grep -v grep
```

To view bot logs:
```bash
cd discord-bots && tail -f bot-debug.log
```

To restart the bot if needed:
```bash
cd discord-bots
pkill -f "node.*engagement-bot"
node engagement-bot.js &
``` 