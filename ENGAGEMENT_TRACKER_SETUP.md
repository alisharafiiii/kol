# 🔧 Engagement Tracker Channel Setup

## ⚠️ Current Issue
The bot is trying to post tweet previews but getting "Missing Permissions" error.

## ✅ Quick Fix Steps:

### 1. Create/Find the Channel
- Look for `#engagement-tracker` channel
- If it doesn't exist, create it

### 2. Set Bot Permissions
1. Right-click on `#engagement-tracker` channel
2. Click "Edit Channel" → "Permissions"
3. Find your bot role or add the bot specifically
4. Enable these permissions:
   - ✅ View Channel
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Read Message History
   - ✅ Add Reactions (for future features)

### 3. Alternative: Give Bot Admin
If you trust the bot, you can give it Administrator permission in Server Settings → Roles

## 📸 What the Bot Posts

When someone submits a tweet, the bot automatically posts a beautiful embed showing:
- 🐦 Tweet title with clickable link
- 👤 Tweet author with link to profile
- 🏷️ Category (General, Tech, DeFi, etc.)
- ⭐ Tier level (1-3)
- 📤 Who submitted it
- 🎯 Points multiplier
- 💡 Engagement instructions

## 🎨 Preview Example:
```
┌─────────────────────────────────────┐
│ 🐦 New Tweet for Engagement!        │
│                                     │
│ Click the title to view the tweet!  │
│                                     │
│ 👤 Author: @username                │
│ 🏷️ Category: DeFi                  │
│ ⭐ Tier: Level 2                    │
│ 📤 Submitted by: DiscordUser        │
│ 🎯 Bonus: 1.5x points               │
│                                     │
│ 💡 Engage to earn points!           │
└─────────────────────────────────────┘
```

## 🚀 Testing
1. Fix the permissions
2. Submit a tweet with `/submit [url]`
3. Check #engagement-tracker for the preview
4. Everyone can see and click to engage!

## 📝 Note
This feature makes engagement tracking social and competitive - everyone sees what tweets are available for engagement! 