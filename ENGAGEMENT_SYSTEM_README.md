# Discord Twitter Engagement Tracking System

## Overview

This system tracks Twitter engagement for Discord users using a points-based reward system. Users connect their Twitter accounts and submit tweets for tracking. The system automatically checks for likes, retweets, and replies from other connected users and awards points based on tier-based rules.

## Architecture

### Components

1. **Discord Bot** (`engagement-bot.js`)
   - Handles user commands and interactions
   - Manages Twitter account connections
   - Accepts tweet submissions
   - Shows stats and leaderboard

2. **Batch Processor** (`scripts/engagement-batch-processor.js`)
   - Runs every 30-60 minutes
   - Fetches tweets from the last 24 hours
   - Uses Twitter API to check engagements
   - Awards points based on interaction type and user tier

3. **Admin Panel** (`app/admin/engagement/`)
   - Manage submitted tweets
   - View and edit point rules
   - Monitor leaderboard
   - Track batch job status

4. **API Routes** (`app/api/engagement/`)
   - RESTful endpoints for all operations
   - Authentication and role-based access
   - Data management and reporting

## Bot Commands

### User Commands
- `/connect` - Connect your Twitter account
- `/submit <url> [category]` - Submit a tweet for tracking
- `/stats` - View your engagement stats
- `/leaderboard` - View the top engagers

### Admin Commands
- `/tier <user> <level>` - Set a user's tier (1-3)

## Point System

### Default Tiers and Points

| Tier | Level | Like | Retweet | Reply |
|------|-------|------|---------|-------|
| 1    | Basic | 1    | 2       | 3     |
| 2    | Active| 2    | 4       | 6     |
| 3    | Power | 3    | 6       | 9     |

### How Points Work
1. User submits a tweet
2. Batch processor checks who engaged with it
3. Points awarded based on:
   - Type of engagement (like/RT/reply)
   - Tier of the engaging user
4. Points accumulate in user's total

## Setup Instructions

### 1. Environment Variables
Add to your `.env.local`:
```
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_APPLICATION_ID=your_app_id
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret
```

### 2. Install Dependencies
```bash
npm install discord.js twitter-api-v2 node-cron
```

### 3. Start the Bot
```bash
# Run the Discord bot
node engagement-bot.js

# Run the batch processor cron job
node scripts/engagement-cron.js

# Or run batch processor once
node scripts/engagement-batch-processor.js
```

### 4. Create Discord Channel
Create a channel named `engagement-tracker` in your Discord server for tweet submissions.

## Admin Panel Features

### Overview Tab
- Active tweets count
- Connected users count
- Top score display
- Last batch run time

### Tweets Tab
- View all submitted tweets
- See engagement metrics
- Delete invalid submissions
- Filter by category

### Leaderboard Tab
- Top users by total points
- Weekly points tracking
- Tier display
- Export functionality (future)

### Rules Tab
- Edit points for each tier/interaction
- Setup default rules
- Custom multipliers (future)

### Batch Jobs Tab
- View job history
- Success/failure status
- Processing stats
- Manual trigger option

## Database Schema

### Redis Keys Structure

**Connections:**
- `engagement:connection:{discordId}` - User's Twitter connection
- `engagement:twitter:{handle}` - Reverse lookup

**Tweets:**
- `engagement:tweet:{id}` - Tweet data
- `engagement:tweetid:{tweetId}` - Duplicate check
- `engagement:tweets:recent` - Sorted set by timestamp

**Logs:**
- `engagement:log:{id}` - Individual engagement log
- `engagement:user:{discordId}:logs` - User's engagement history
- `engagement:tweet:{tweetId}:logs` - Tweet's engagement logs

**Rules:**
- `engagement:rules:{tier}-{type}` - Point rules

**Batch Jobs:**
- `engagement:batch:{id}` - Batch job data
- `engagement:batches` - Sorted set of jobs

## Future Enhancements

### Token System
- Convert points to tokens
- Implement token economics
- Wallet integration

### Marketplace
- Redeem tokens for rewards
- Premium features
- NFT integration

### Advanced Features
- Sentiment analysis categories
- Campaign-specific tracking
- Team competitions
- Automated payouts

## Troubleshooting

### Common Issues

**Bot not responding:**
- Check bot token and permissions
- Ensure bot has message/command permissions
- Verify channel name matches

**No points awarded:**
- Ensure users have connected Twitter accounts
- Check if batch processor is running
- Verify Twitter API credentials

**Duplicate tweets:**
- System prevents duplicate submissions
- Check by tweet ID, not URL

### Debug Commands
```bash
# Check Redis connection
redis-cli ping

# View recent tweets
redis-cli zrange engagement:tweets:recent 0 -1

# Check user connection
redis-cli json.get engagement:connection:{discordId}
```

## Security Considerations

1. **Authentication:** All API routes require authentication
2. **Role-based Access:** Admin functions restricted to admin/core roles
3. **Rate Limiting:** Consider implementing rate limits for submissions
4. **Data Privacy:** Twitter handles stored, not passwords
5. **Audit Logs:** All point awards are logged with batch IDs

## Monitoring

### Metrics to Track
- Daily active users
- Tweets submitted per day
- Average engagement rate
- Points distribution
- Batch job success rate

### Alerts to Configure
- Batch job failures
- Unusual point accumulation
- API rate limit warnings
- Database connection issues 