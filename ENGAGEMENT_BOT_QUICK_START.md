# Discord Engagement Bot Quick Start

## ✅ Current Status

Your Redis credentials have been successfully added! Here's what you need to do:

### 1. Add Your Discord Application ID

You currently have a placeholder value. You need to replace it with your actual Discord Application ID.

**To find your Discord Application ID:**
1. Go to https://discord.com/developers/applications
2. Select your bot application (or create a new one)
3. In "General Information", copy the "Application ID"
4. Edit `.env.local` and replace `YOUR_DISCORD_APP_ID_HERE` with your actual ID

### 2. Start the Bot

```bash
cd discord-bots
node engagement-bot.js
```

You should see:
```
🔍 Loading environment from: /Users/nabu/kol/discord-bots/../.env.local
⚠️  No AI API key found (GEMINI_API_KEY or GOOGLE_AI_API_KEY)
   Sentiment analysis will be disabled
✅ Engagement bot logged in as [bot name]
✅ Slash commands registered
```

### 3. Use the Bot Commands

**For Users (must be approved first):**
- `/connect` - Connect Twitter account
- `/submit` - Submit tweet for tracking
- `/stats` - View your stats
- `/leaderboard` - See top users

**For Admins:**
- `/tier @user 2` - Set user tier
- `/scenarios` - Configure tier settings

## ❓ Common Issues

### "Application did not respond"
The bot isn't running. Make sure you started it with `node engagement-bot.js`

### "Your Twitter account is not approved"
Users must be approved in your KOL system first at https://kol-qcc8u7yxh-nabus-projects-b8bca9ec.vercel.app

### Redis Connection Error
Make sure the Redis credentials in `.env.local` match your production app

## 📝 Notes

- The bot will work without a Gemini/Google AI key (sentiment analysis will be disabled)
- Twitter API keys are only needed if you want to run the batch processor
- Each tier has default limits (Tier 1: 3 tweets/day, Tier 2: 5, Tier 3: 10)
- Users automatically get "kol" role when connecting (unless they have higher roles) 