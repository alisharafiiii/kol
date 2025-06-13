# Quick Fix: Discord Commands Not Showing

## ✅ Commands Have Been Refreshed!

I've just force-refreshed your bot's commands. Here's what to do now:

### 1. **In Discord, Try These Steps:**

1. **Close Discord completely** and reopen it
2. **Type `/` in any channel** where the bot has permissions
3. **Wait 2-3 seconds** - commands may load slowly
4. **Look for "nabulines_bot"** in the command list

### 2. **If Still Not Working:**

**Option A: Register to Specific Server (Instant)**
```bash
# Get your server ID by right-clicking your server name in Discord
# (Developer Mode must be enabled in Discord settings)
node -e "console.log('Right-click your server -> Copy Server ID')"
```

**Option B: Re-invite Bot**
Click this link to ensure proper permissions:
```
https://discord.com/api/oauth2/authorize?client_id=1381867742952554616&permissions=268438528&scope=bot%20applications.commands
```

### 3. **Check Bot Permissions in Your Server:**

1. Go to Server Settings → Integrations
2. Find "nabulines_bot"
3. Ensure these are enabled:
   - Use Slash Commands ✅
   - Send Messages ✅
   - Manage Roles ✅ (for auto-assigning KOL role)

### 4. **Known Issues:**

- **Global commands can take up to 1 hour** to propagate across Discord
- **Old commands might be cached** - that's why restarting Discord helps
- **Bot must be in the server** where you're trying to use commands

### 5. **Test in a Different Channel:**

Sometimes specific channels have permission overrides. Try using `/` in:
- A general text channel
- A channel where you're sure the bot has permissions
- The `engagement-tracker` channel (if you created it)

## 📝 Available Commands:

- `/connect` - Connect your Twitter account
- `/submit` - Submit a tweet for tracking
- `/stats` - View your stats
- `/leaderboard` - See top users
- `/tier` - (Admin) Set user tier
- `/scenarios` - (Admin) Configure tier settings

The commands are registered and should appear within the next few minutes! 