# Setting Up the Engagement Tracker Channel

## 🎯 Quick Setup

1. **Create the Channel in Discord:**
   - Right-click on your server
   - Click "Create Channel"
   - Name it exactly: `engagement-tracker`
   - Make it a Text Channel
   - Set permissions so KOLs can view but not send messages

2. **What Happens:**
   - When anyone submits a tweet via `/submit`
   - The bot posts a preview in #engagement-tracker
   - All KOLs can see the tweet and click to engage

## 📊 Tweet Preview Format

When a tweet is submitted, it shows:
- 📊 **Title**: "New Tweet Submitted" (clickable link to tweet)
- **Author**: @twitterhandle
- **Category**: DeFi/NFT/Gaming/etc
- **Submitted by**: Discord username
- **Tweet ID**: For tracking
- **Timestamp**: When submitted

## 🔧 Channel Permissions (Recommended)

```
✅ KOL Role:
- View Channel
- Read Message History
- Add Reactions

❌ KOL Role:
- Send Messages (to keep it clean)
- Manage Messages

✅ Bot Role:
- Send Messages
- Embed Links
- Attach Files
```

## 💡 Tips

1. **Pin a Message** explaining how the engagement system works
2. **Use Slow Mode** to prevent spam (if needed)
3. **Create Categories** for different tweet types (optional)

## 📝 Example Message to Pin:

```
📢 **Twitter Engagement Tracker**

This channel shows all tweets submitted for engagement tracking.

How to participate:
1. Click on any tweet link
2. Like, Retweet, or Reply on Twitter
3. Earn points based on your tier!

Points are awarded automatically by our batch processor.
``` 