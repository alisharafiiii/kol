# Discord Twitter Engagement Tracking System

## Overview

This system tracks Twitter engagement for Discord users using a points-based reward system. Users must be approved in the KOL management system before they can connect their Twitter accounts. The system automatically checks for likes, retweets, and replies from other connected users and awards points based on tier-based rules with configurable bonus multipliers.

## Key Features

### User Access Control
- **Approved Users Only**: Users must be approved in the KOL management system before they can use the bot
- **Automatic Role Assignment**: When connecting Twitter, users automatically receive the 'kol' role unless they have higher roles (admin, core, team)
- **Role Hierarchy**: admin > core > team > kol > user

### Tier-Based Scenarios
Each tier has configurable presets that admins can customize:
- **Daily Tweet Limits**: Control how many tweets users can submit per day
- **Categories**: Define allowed tweet categories per tier
- **Minimum Followers**: Set follower requirements (for future use)
- **Bonus Multipliers**: Apply point multipliers to reward higher tiers

## Architecture

The system consists of two parts:

### 1. Web Application (Next.js)
- **Admin Panel** (`app/admin/engagement/`)
- **API Routes** (`app/api/engagement/`)
- **Service Layer** (`lib/services/engagement-service.ts`)
- **Type Definitions** (`lib/types/engagement.ts`)

### 2. Discord Bot & Batch Processor (Node.js - Runs Separately)
- **Discord Bot** (`engagement-bot.js`) - Handles Discord interactions
- **Batch Processor** (`scripts/engagement-batch-processor.js`) - Processes Twitter engagements
- **Cron Job** (`scripts/engagement-cron.js`) - Schedules batch processing

> **Important**: The Discord bot and batch processor run as separate Node.js processes outside of the Next.js application. They communicate with the same Redis database but are not bundled with the web app.

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
- `/connect` - Connect your Twitter account (requires approved status)
- `/submit <url> [category]` - Submit a tweet for tracking (respects daily limits)
- `/stats` - View your engagement stats
- `/leaderboard` - View the top engagers

### Admin Commands
- `/tier <user> <level>` - Set a user's tier (1-3)
- `/scenarios <tier> [options]` - Configure tier scenarios (daily limit, categories, bonus)

## Point System

### Default Tiers and Points

| Tier | Level | Like | Retweet | Reply | Bonus Multiplier | Daily Limit |
|------|-------|------|---------|-------|-----------------|-------------|
| 1    | Basic | 1    | 2       | 3     | 1.0x            | 3 tweets    |
| 2    | Active| 2    | 4       | 6     | 1.5x            | 5 tweets    |
| 3    | Power | 3    | 6       | 9     | 2.0x            | 10 tweets   |

### Tier Scenarios (Configurable)
Each tier has configurable scenarios:
- **Daily Tweet Limit**: Maximum tweets per day
- **Categories**: Allowed tweet categories (e.g., General, DeFi, NFT, Gaming)
- **Bonus Multiplier**: Points multiplication factor
- **Minimum Followers**: Required follower count (future feature)

### How Points Work
1. User submits a tweet (must be approved user)
2. Batch processor checks who engaged with it
3. Base points calculated from tier rules
4. Bonus multiplier applied: `final_points = base_points × bonus_multiplier`
5. Points accumulate in user's total

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
- Base point configuration

### Scenarios Tab
- Configure tier-specific settings
- Set daily tweet limits
- Manage allowed categories
- Adjust bonus multipliers
- Set minimum follower requirements

### Batch Jobs Tab
- View job history
- Success/failure status
- Processing stats
- Manual trigger option

## Database Schema

### Redis Keys Structure

**Connections:**
- `engagement:connection:{discordId}` - User's Twitter connection (includes role info)
- `engagement:twitter:{handle}` - Reverse lookup

**Scenarios:**
- `engagement:scenarios:tier{1-3}` - Tier-specific configuration

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