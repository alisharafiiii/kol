# 🤖 Discord Bot Setup & Fix Guide

## Current Status
✅ Bot is running under PM2 process manager
❌ Bot can't post to #engagement-tracker channel (Missing Permissions)

## Issue: Permission Error
The bot `nabulines_bot#8452` is logged in but can't send messages to the `#engagement-tracker` channel.

Error: `DiscordAPIError[50013]: Missing Permissions`

## How to Fix the Permissions

### Option 1: Quick Fix (Recommended)
1. Go to your Discord server
2. Right-click on the `#engagement-tracker` channel
3. Click **Edit Channel**
4. Go to **Permissions** tab
5. Click the **+** button to add members/roles
6. Search for `nabulines_bot` and add it
7. Enable these permissions:
   - ✅ View Channel
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Read Message History
   - ✅ Add Reactions
   - ✅ Use External Emojis
8. Click **Save Changes**

### Option 2: Server-Wide Role
1. Go to **Server Settings** → **Roles**
2. Find the bot's role (usually `nabulines_bot`)
3. Enable these permissions:
   - ✅ View Channels
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Read Message History
   - ✅ Add Reactions
4. **IMPORTANT**: Drag the bot's role above @everyone role

### Option 3: Administrator (Easiest but less secure)
1. Go to **Server Settings** → **Roles**
2. Find the bot's role
3. Enable **Administrator** permission
4. Save changes

## PM2 Commands (Bot Management)

### Check bot status:
```bash
pm2 status
```

### View bot logs:
```bash
pm2 logs engagement-bot
```

### Restart bot:
```bash
pm2 restart engagement-bot
```

### Stop bot:
```bash
pm2 stop engagement-bot
```

### Start bot:
```bash
pm2 start engagement-bot
```

### Monitor bot (real-time):
```bash
pm2 monit
```

## PM2 Auto-Start Setup

To make PM2 start automatically when your system boots:

1. Run this command to get the startup script:
```bash
pm2 startup
```

2. Copy and run the command it gives you (requires sudo)

3. Save current PM2 process list:
```bash
pm2 save
```

## Testing the Fix

1. After fixing permissions, test by submitting a tweet:
   - Go to Discord
   - Use `/submit https://twitter.com/user/status/123`
   - Check if the bot posts in #engagement-tracker

2. Check bot logs for any errors:
```bash
pm2 logs engagement-bot --lines 50
```

## Troubleshooting

### Bot is offline?
```bash
pm2 restart engagement-bot
```

### Still getting permission errors?
- Make sure the bot is actually in your server
- Check if the channel is in a category with restricted permissions
- Try kicking and re-inviting the bot with proper permissions

### Need to update bot code?
```bash
pm2 stop engagement-bot
# Edit the file
pm2 start engagement-bot
```

## Bot Features
- Tweet submission and tracking
- Points system (like, retweet, comment)
- Leaderboard
- Tier-based rewards
- Automatic tweet preview generation
- Sentiment analysis

## Environment Variables Required
Make sure `.env.local` has:
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `GEMINI_API_KEY` (for sentiment analysis) 