# 🔧 Fix Discord Channel Permissions

## The Issue
Bot can't post to #engagement-tracker even though it's added to the channel.

## Quick Fix Steps:

### Method 1: Channel-Specific Permissions
1. **Right-click** on `#engagement-tracker` channel
2. Click **"Edit Channel"**
3. Go to **"Permissions"** tab
4. Click **"+ Add members or roles"**
5. Add your bot (or its role)
6. Enable these permissions:
   - ✅ View Channel
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Read Message History
   - ✅ Use External Emojis
   - ✅ Add Reactions

### Method 2: Give Bot a Higher Role
1. Go to **Server Settings** → **Roles**
2. Find your bot's role (usually same name as bot)
3. Enable these permissions:
   - ✅ View Channels
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Read Message History
4. **IMPORTANT**: Drag the bot's role **above** any "everyone" or restricted roles

### Method 3: Administrator (Easy Fix)
1. Go to **Server Settings** → **Roles**
2. Find your bot's role
3. Enable **Administrator** permission
4. This gives the bot all permissions

## What the Bot Will Post

The bot has 3 fallback levels:

1. **Full Preview** (with buttons) - If all permissions work
2. **Simple Embed** (no buttons) - If buttons fail
3. **Plain Text** - If embeds fail

## Testing Your Fix

1. Submit a tweet: `/submit https://twitter.com/user/status/123`
2. Check `#engagement-tracker` channel
3. Look at bot console output (run `tail -f bot-output.log`)

## Common Issues:

**"Missing Permissions" error?**
- Bot role might be below @everyone role
- Channel might have explicit denies
- Bot might not be in the channel's permissions

**Still not working?**
- Delete and recreate the channel
- Kick and re-invite the bot with proper permissions
- Check if channel is in a category with restricted permissions

## Debug Output
When you submit a tweet, the bot now logs:
- What permissions it has in the channel
- Which message type it's trying to send
- Any errors it encounters 