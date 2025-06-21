# Discord Bots Configuration

## Bot Setup

### 1. Environment Variables

Create a `.env.local` file in the root directory with:

```env
# Discord Bot Tokens
DISCORD_BOT_TOKEN=your_engagement_bot_token_here
DISCORD_ANALYTICS_BOT_TOKEN=your_analytics_bot_token_here

# Redis Configuration
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Optional: Debug Mode
DEBUG_BOT=false
```

### 2. Required Bot Permissions

When inviting the bots to your Discord server, ensure they have:

- **Engagement Bot**:
  - View Channels
  - Send Messages
  - Embed Links
  - Read Message History
  - Use External Emojis
  - Manage Roles (for KOL role assignment)

- **Analytics Bot**:
  - View Channels
  - Send Messages
  - Embed Links
  - Read Message History

### 3. Running the Bots

```bash
# Engagement Bot
node discord-bots/engagement-bot.js

# Analytics Bot
node discord-bots/analytics-bot.js
```

### 4. Bot Commands

**Engagement Bot:**
- `/connect` - Link Twitter account
- `/check-role` - Check current role status
- Submit tweets by pasting Twitter URLs

**Analytics Bot:**
- Various analytics commands for tracking engagement

### 5. Troubleshooting

- **Frequent disconnections**: Check network stability and ensure bot token is not being used in multiple places
- **Permission errors**: Verify bot has all required permissions and its role is positioned correctly
- **Redis errors**: Ensure Redis credentials are correct and service is accessible

### 6. Best Practices

- Use separate tokens for each bot
- Keep bot tokens secure and never commit them
- Monitor bot logs for errors
- Restart bots periodically if memory usage grows 