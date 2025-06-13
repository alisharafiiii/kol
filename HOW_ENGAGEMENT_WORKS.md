# How the Twitter Engagement System Works

## 🎯 Overview

The engagement system creates a community-driven Twitter engagement pool where KOLs support each other's tweets and earn points.

## 📢 How KOLs See & Engage with Tweets

### 1. **Automatic Channel Posting**
When someone submits a tweet using `/submit`, the bot automatically posts it to the **#engagement-tracker** channel with:
- 🐦 Clickable title linking directly to the tweet
- 👤 Author's Twitter handle (clickable)
- 🏷️ Category (DeFi, NFT, Gaming, etc.)
- ⭐ Tier level of the author
- 🎯 Bonus multiplier for that tier
- 📤 Who submitted it
- 💡 Reminder to engage for points

### 2. **New `/tweets` Command**
Users can also use `/tweets` to see the last 10 submitted tweets anytime.

### 3. **Engagement Process**
```
1. KOL sees tweet in #engagement-tracker or via /tweets
2. Clicks the tweet link
3. Likes, Retweets, or Replies on Twitter
4. Batch processor runs every 30 mins
5. Points are automatically awarded
6. Check points with /stats
```

## 🔄 The Complete Flow

### For Tweet Submitters:
1. Connect Twitter account: `/connect`
2. Submit your tweet: `/submit [url]`
3. Bot posts to #engagement-tracker
4. Other KOLs engage with your tweet
5. You get visibility and engagement

### For Engagers:
1. See tweets in #engagement-tracker
2. Click and engage on Twitter
3. Earn points based on:
   - Your tier (1-3)
   - Type of engagement (Like/RT/Reply)
   - Bonus multipliers

## 📊 Point System Example

**Base Points:**
- Like: 1-3 points
- Retweet: 2-6 points  
- Reply: 3-9 points

**With Tier 2 (1.5x bonus):**
- Like: 3 points
- Retweet: 6 points
- Reply: 9 points

## 🚀 Quick Start for Your Server

1. **Create #engagement-tracker channel**
   ```
   - Text channel
   - KOLs can view, bot can post
   - Consider read-only for KOLs
   ```

2. **Test the Flow**
   - Have someone `/connect` their Twitter
   - They `/submit` a tweet
   - Check #engagement-tracker for the post
   - Others engage and earn points

3. **Run Batch Processor** (for automatic points)
   ```bash
   cd discord-bots
   node engagement-batch-processor.js
   ```

## 📱 Available Commands

- `/connect` - Connect Twitter account
- `/submit` - Submit a tweet
- `/stats` - View your points
- `/leaderboard` - See top performers
- `/tweets` - View recent tweets
- `/tier @user 2` - (Admin) Set user tier
- `/scenarios` - (Admin) Configure tiers

## 💡 Pro Tips

1. **Pin Instructions** in #engagement-tracker
2. **Set Daily Limits** to prevent spam
3. **Adjust Bonus Multipliers** to incentivize higher tiers
4. **Run Batch Processor** regularly (cron job recommended)
5. **Monitor Leaderboard** to ensure fair play

The system is designed to be self-sustaining - KOLs help each other while earning rewards! 