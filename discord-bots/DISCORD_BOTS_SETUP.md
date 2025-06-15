# Discord Bots Setup

## Overview

This Discord bot system consists of two separate bots that work together:

### 1. Engagement Bot (`engagement-bot.js`)
- **Purpose**: Twitter/X engagement tracking for KOLs
- **Features**:
  - `/connect` - Connect Twitter account
  - `/submit` - Submit tweets for engagement
  - `/stats` - View engagement stats
  - `/leaderboard` - View top engagers
  - `/recent` - View recent tweets
  - Responds to `!ping` with `pong! 🏓`
- **Data**: Stores in Redis with `engagement:*` keys
- **Log file**: `bot-debug.log`

### 2. Analytics Bot (`analytics-bot.js`)
- **Purpose**: Discord message tracking and analytics
- **Features**:
  - Tracks messages in configured channels
  - Performs sentiment analysis using Gemini AI
  - Updates user and channel statistics
  - Powers the Discord analytics dashboard
- **Data**: Stores in Redis with `discord:*` and `message:discord:*` keys
- **Log file**: `analytics-bot-debug.log`

## Setup Instructions

### Prerequisites
1. Discord bot token in `.env.local` as `DISCORD_BOT_TOKEN`
2. Gemini API key in `.env.local` as `GEMINI_API_KEY` (for sentiment analysis)
3. Redis connection (Upstash) configured in `.env.local` as `REDIS_URL`

### Starting the Bots

#### Start Individual Bots
```bash
# Start engagement bot only
./discord-bots/start-engagement-bot.sh

# Start analytics bot only
./discord-bots/start-analytics-bot.sh
```

#### Start Both Bots
```bash
# Start both bots at once
./discord-bots/start-all-bots.sh
```

### Managing the Bots

#### Check Status
```bash
# Check all running bots
ps aux | grep -E 'engagement-bot|analytics-bot'

# Check engagement bot specifically
ps aux | grep engagement-bot

# Check analytics bot specifically
ps aux | grep analytics-bot
```

#### View Logs
```bash
# View engagement bot logs
tail -f bot-debug.log

# View analytics bot logs
tail -f analytics-bot-debug.log

# View last 50 lines of engagement logs
tail -50 bot-debug.log

# View last 50 lines of analytics logs
tail -50 analytics-bot-debug.log
```

#### Stop Bots
```bash
# Stop all bots
pkill -f 'engagement-bot.js|analytics-bot.js'

# Stop engagement bot only
pkill -f engagement-bot.js

# Stop analytics bot only
pkill -f analytics-bot.js
```

## Configuring Discord Projects

To make the analytics bot track messages:

1. Go to `/admin/discord` in your web app
2. Click "Add Server" to create a new Discord project
3. Enter:
   - Project Name
   - Server ID (from Discord)
   - Server Name
   - Scout Project ID (to link with existing project)
4. Once created, click on the project
5. In Settings, add channel IDs to track

The analytics bot will automatically reload tracked channels every 5 minutes.

## Architecture

```
Discord Server
    ├── Engagement Bot
    │   ├── Handles: Slash commands (/connect, /submit, etc.)
    │   ├── Responds to: !ping
    │   └── Manages: Twitter engagement tracking
    │
    └── Analytics Bot
        ├── Listens to: Messages in tracked channels
        ├── Analyzes: Sentiment, user activity, trends
        └── Updates: Dashboard analytics at /admin/discord
```

## Troubleshooting

### Bot Not Starting
1. Check logs for errors: `tail -50 [bot-log-file]`
2. Ensure Discord token is set: `grep DISCORD_BOT_TOKEN .env.local`
3. Check Redis connection: `grep REDIS_URL .env.local`

### Analytics Not Updating
1. Ensure channels are tracked in project settings
2. Check analytics bot is running: `ps aux | grep analytics-bot`
3. Verify bot has permissions to read messages in channels
4. Check logs for any errors

### Duplicate Responses
1. Check for multiple bot instances: `ps aux | grep [bot-name]`
2. Kill all instances and restart: `pkill -f [bot-name].js`

### Permission Issues
Both bots need these Discord permissions:
- Read Messages
- Send Messages
- Read Message History
- Use Slash Commands (engagement bot)
- Embed Links 