# Discord Analytics Bot - Points Integration

## Overview
Successfully integrated the Discord Analytics Bot with the centralized Points Service, allowing users to earn points for Discord messages while maintaining complete isolation between systems.

## Architecture

### 1. **Points Bridge Service** (`lib/services/discord-points-bridge.ts`)
- Acts as intermediary between Discord bot and Points system
- Handles user mapping, points calculation, and transaction logging
- Features:
  - Awards points based on configured actions and tiers
  - Daily limit of 50 messages per user (anti-spam)
  - Full transaction history logging
  - Leaderboard updates

### 2. **API Endpoint** (`app/api/discord/award-points/route.ts`)
- REST API for Discord bot to call
- Simple API key authentication
- Endpoints:
  - `POST /api/discord/award-points` - Award points for a message
  - `GET /api/discord/award-points` - View recent transactions

### 3. **Analytics Bot Integration**
- Bot calls API after successfully saving each message
- Non-blocking: Points failures don't affect message processing
- Logs points awards in console

## Configuration

### Environment Variables
```env
# For Discord Bot
POINTS_API_URL=http://localhost:3000/api/discord/award-points
DISCORD_BOT_API_KEY=discord-bot-points-key-2024

# For Main App (optional custom values)
DISCORD_BOT_API_KEY=your-secure-api-key
```

### Points Configuration
The "Discord Message" action is configured in the Points Management admin panel:
- Default: 10 points per message
- Applies tier multipliers automatically
- Category: "social"

## User Flow

1. **User Links Discord Account**
   - User connects Discord via `/auth/discord-link`
   - System creates mapping: `discord:user:map:{discordId}` → `user:{userId}`
   - User can now earn points

2. **User Sends Discord Message**
   - Analytics bot captures message
   - Bot calls points API with Discord user info
   - Bridge service:
     - Finds linked platform user
     - Checks daily limit (50 messages)
     - Calculates points based on user tier
     - Awards points and logs transaction

3. **Points Tracking**
   - Points added to user's `pointsBreakdown.discord`
   - Transaction logged with full details
   - Leaderboards updated (daily & all-time)

## Transaction Logging

Every point award creates a detailed log entry:
```json
{
  "userId": "user_sharafi",
  "twitterHandle": "@sharafi_eth",
  "discordUsername": "Sharafi",
  "discordUserId": "123456789",
  "projectId": "project:discord:xyz",
  "projectName": "Ledger",
  "messageId": "987654321",
  "points": 10,
  "timestamp": "2024-12-19T10:30:00Z",
  "metadata": {
    "tier": "tier_micro",
    "dailyCount": 5,
    "actionId": "action_discord_msg"
  }
}
```

## Safety Features

### 1. **Complete Isolation**
- Bot uses HTTP API only - no direct imports
- Separate process from main app
- Different Redis namespaces

### 2. **Anti-Spam Protection**
- 50 messages/day limit per user
- Only linked users can earn points
- Rate limiting via API

### 3. **Failure Handling**
- Points failures don't affect analytics
- All errors logged but not thrown
- Graceful degradation

## Monitoring & Testing

### Test Script
```bash
node scripts/test-discord-points.mjs
```
Shows:
- Points configuration status
- Discord user mappings
- Recent transactions
- Daily limits usage
- Current leaderboard

### Bot Logs
Monitor points awards in real-time:
```bash
tail -f discord-bots/analytics-bot.log | grep "💰"
```

### API Transactions
View recent Discord points transactions:
```bash
curl -H "x-api-key: discord-bot-points-key-2024" \
  http://localhost:3000/api/discord/award-points?limit=10
```

## Maintenance

### Adding/Removing Discord Users
Users are automatically linked when they connect Discord. To manually link:
```javascript
await DiscordPointsBridge.linkDiscordUser(discordId, platformUserId)
```

### Adjusting Points Values
1. Go to Admin Panel → Points
2. Edit "Discord Message" action base points
3. Changes apply immediately (no bot restart needed)

### Clearing Daily Limits
Daily limits auto-expire after 24 hours. Keys pattern: `points:discord:daily:{discordId}:{date}`

## Future Enhancements
- Bonus points for positive sentiment messages
- Streak bonuses for consecutive days
- Channel-specific multipliers
- Team/project-based competitions
- Weekly/monthly point decay 