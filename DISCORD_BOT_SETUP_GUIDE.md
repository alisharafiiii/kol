# Discord Bot Setup Guide

## Understanding the Two Bots

You have TWO separate Discord bots in this project:

### 1. Main Analytics Bot (`bot.js`)
- **Purpose**: Discord activity analytics and sentiment analysis
- **Commands**: Currently only responds to `!ping` and `!analytics-status`
- **Status**: Basic functionality, no slash commands implemented

### 2. Engagement Tracking Bot (`discord-bots/engagement-bot.js`) 
- **Purpose**: Twitter engagement tracking with points system
- **Commands**: `/connect`, `/submit`, `/stats`, `/leaderboard`, `/tier`, `/scenarios`
- **Status**: Fully functional with slash commands

## How to Set Up the Engagement Bot

### Step 1: Clear Old Commands (if seeing non-working commands)
```bash
node clear-discord-commands.js
```

### Step 2: Ensure You Have Required Environment Variables
The engagement bot requires these environment variables in `.env.local`:
```
# Discord Bot Credentials (Different from main bot!)
DISCORD_BOT_TOKEN=your_engagement_bot_token
DISCORD_APPLICATION_ID=your_engagement_bot_app_id

# Redis Database (Same as your web app)
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# Google AI for sentiment (Same as your web app)
GOOGLE_AI_API_KEY=your_google_ai_key
```

**Important**: If you're already running the main "nabulines" bot, you need to create a SECOND Discord application for the engagement bot. They cannot share the same token.

### Step 3: Start the Engagement Bot
```bash
cd discord-bots
node engagement-bot.js
```

### Step 4: Use the Bot Commands

#### For Regular Users (Must Be Approved First!)
1. **Connect Your Twitter**: `/connect`
   - You'll see a modal asking for your Twitter handle
   - Enter your handle (e.g., @yourusername)
   - You MUST be approved in the KOL system first
   - If approved, you'll automatically get the "kol" role

2. **Submit Tweets**: `/submit`
   - Provide the tweet URL
   - Optionally add a category
   - You have daily limits based on your tier

3. **Check Your Stats**: `/stats`
   - See your points, tier, and daily limit usage

4. **View Leaderboard**: `/leaderboard`
   - See top performers

#### For Admins Only
- `/tier @user 2` - Set user's tier (1-3)
- `/scenarios` - Configure tier settings

## Troubleshooting

### "Application did not respond"
This means the bot is not running. Start it with:
```bash
cd discord-bots
node engagement-bot.js
```

### "Your Twitter account is not approved"
You need to be approved in the KOL management system first:
1. Go to the website
2. Apply as a KOL
3. Wait for admin approval
4. Then try `/connect` again

### Daily Limit Reached
Each tier has daily tweet submission limits:
- Tier 1: 3 tweets/day
- Tier 2: 5 tweets/day  
- Tier 3: 10 tweets/day

### Commands Not Showing
If slash commands aren't appearing:
1. Make sure the bot has been added with `applications.commands` scope
2. Try typing `/` and wait a moment
3. The bot might need to be re-invited with proper permissions

## Required Discord Permissions

When inviting the bot, ensure these permissions:
- Send Messages
- Use Slash Commands
- Manage Roles (for auto-assigning "kol" role)
- Read Message History
- Embed Links

## Bot Invite Link Format
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&permissions=268438528&scope=bot%20applications.commands
```

Replace `YOUR_APP_ID` with your Discord application ID. 