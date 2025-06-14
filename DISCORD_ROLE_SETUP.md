# 🔐 Discord KOL Role Setup Guide

## ⚠️ Why the KOL role isn't being assigned

The bot needs proper permissions to assign roles. Here's how to fix it:

## Step 1: Create the KOL Role

1. Open Discord Server Settings → Roles
2. Click "+ Create Role"
3. Name it **exactly**: `kol` (lowercase)
4. Set the color and permissions as needed
5. Click "Save Changes"

## Step 2: Fix Bot Permissions

### Option A: Re-invite the Bot (Easiest)
1. Go to https://discord.com/developers/applications
2. Select your bot application
3. Go to OAuth2 → URL Generator
4. Select these scopes:
   - `bot`
   - `applications.commands`
5. Select these permissions:
   - **Manage Roles** ✅ (REQUIRED!)
   - Send Messages
   - Embed Links
   - Read Message History
   - Use Slash Commands
6. Copy the invite link and re-invite the bot

### Option B: Fix Existing Bot
1. Go to Server Settings → Roles
2. Find your bot's role (usually named after the bot)
3. Enable "Manage Roles" permission
4. Click "Save Changes"

## Step 3: Fix Role Hierarchy (CRITICAL!)

Discord bots can only assign roles that are **BELOW** their own role.

1. Go to Server Settings → Roles
2. **Drag the bot's role ABOVE the KOL role**
3. The order should be:
   ```
   @everyone
   ...other roles...
   @kol             ← KOL role here
   @YourBotName     ← Bot role ABOVE kol
   @admin           ← Admin roles at top
   ```

## Step 4: Test It

1. Run the bot:
   ```bash
   cd discord-bots && node engagement-bot.js
   ```

2. In Discord, use `/connect` and enter a Twitter handle
3. Check the console - you should see either:
   - ✅ "Assigned KOL role to username#1234"
   - ⚠️ Clear error messages about what's wrong

## Common Issues

### "Missing Permissions" Error
- Bot doesn't have "Manage Roles" permission
- Solution: Follow Step 2

### "Bot's role is not high enough"
- Bot's role is below the KOL role
- Solution: Follow Step 3

### "No role found with name 'kol'"
- The KOL role doesn't exist or is named differently
- Solution: Create a role named exactly `kol` (lowercase)

## Quick Checklist
- [ ] KOL role exists and is named `kol`
- [ ] Bot has "Manage Roles" permission
- [ ] Bot's role is ABOVE the KOL role in hierarchy
- [ ] Bot is in your server

## Still Not Working?

Check the bot console for specific error messages. The improved error handling will tell you exactly what's wrong! 