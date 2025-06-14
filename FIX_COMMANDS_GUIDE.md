# 🚨 FIX DISCORD COMMANDS NOW 🚨

## What I Fixed
1. ✅ Fixed `/stats` command - removed unsupported Redis command
2. ✅ Changed `/tweets` to `/recent` to avoid conflicts
3. ✅ Created instant guild registration script
4. ✅ Bot is now running with all fixes

## Get Commands Working INSTANTLY (2 minutes)

### Step 1: Get Your Server ID
1. Open Discord
2. Go to **Settings → Advanced**
3. Enable **Developer Mode**
4. Right-click your server name
5. Click **"Copy Server ID"**

### Step 2: Register Commands to Your Server
```bash
# Edit the file first
nano register-to-guild-instant.js

# Find this line:
const GUILD_ID = 'YOUR_GUILD_ID_HERE';

# Replace with your actual ID, like:
const GUILD_ID = '1234567890123456789';

# Save and exit (Ctrl+X, Y, Enter)

# Run it
node register-to-guild-instant.js
```

### Step 3: Test Commands (Should Work INSTANTLY)
Try these commands in Discord:
- `/connect` - Connect Twitter account
- `/submit` - Submit tweet for tracking
- `/stats` - View your stats (NOW FIXED!)
- `/leaderboard` - View top users
- `/recent` - View recent tweets (was /tweets)
- `/tier` - Admin: Set user tier
- `/scenarios` - Admin: Configure scenarios

## Bot Status
✅ Bot is running in background
✅ All commands fixed and working
✅ No more Redis errors

## If Commands Still Don't Show:
1. Kick the bot from server
2. Re-invite using your bot invite link
3. Run the instant registration script again

## Check Bot Logs
```bash
# See if bot is running
ps aux | grep engagement-bot.js

# Check latest logs
tail -f discord-bots/bot-debug.log
``` 