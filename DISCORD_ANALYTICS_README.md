# Discord Analytics & Sentiment System

## Overview
This is a multi-server Discord analytics system with sentiment analysis powered by Gemini AI. It tracks messages, analyzes sentiment, and provides detailed analytics for each Discord server.

## Features

### Phase 1 (Implemented)
- **Multi-Server Support**: Connect and manage multiple Discord servers
- **Message Tracking**: Automatically log messages from selected channels
- **Sentiment Analysis**: Uses Gemini AI to analyze message sentiment (positive/neutral/negative)
- **Real-time Analytics**: View activity trends, user engagement, and sentiment breakdowns
- **Team Management**: Assign team moderators to each Discord project
- **Reporting**: Generate and download PDF reports, share analytics with links
- **Admin Panel**: Comprehensive admin interface for managing all Discord projects

### Phase 2 (Planned)
- Engagement points system based on activity and sentiment
- Onchain reward system
- Public leaderboards for each project
- Team moderator reward redemption

## Setup Instructions

### 1. Discord Bot Setup

1. Create a Discord Application:
   - Go to https://discord.com/developers/applications
   - Click "New Application" and give it a name
   - Navigate to the "Bot" section
   - Click "Add Bot"
   - Copy the bot token

2. Set Bot Permissions:
   - In the Bot section, ensure these intents are enabled:
     - Message Content Intent
     - Server Members Intent
     - Guilds Intent
   - Generate an invite link with these permissions:
     - Read Messages
     - Read Message History
     - View Channels

3. Add Environment Variable:
   ```bash
   DISCORD_BOT_TOKEN=your_bot_token_here
   ```

### 2. Gemini AI Setup

1. Get a Gemini API Key:
   - Visit https://makersuite.google.com/app/apikey
   - Create a new API key
   - Add it in the admin panel under Discord > Gemini AI Configuration

### 3. Running the Discord Bot

The Discord bot runs separately from the main application:

```bash
# Using PM2 (Recommended)
pm2 start bot-enhanced.js --name discord-bot

# View logs
pm2 logs discord-bot

# Restart bot
pm2 restart discord-bot

# Stop bot
pm2 stop discord-bot
```

**Bot Commands:**
- `!ping` - Check if bot is online
- `!analytics-status` - See tracking info for current server
- `!refresh-channels` - Force refresh channel metadata

### 4. Admin Panel Usage

1. **Access Discord Analytics**:
   - Navigate to Admin Panel > Discord tab
   - Or directly visit `/admin/discord`

2. **Connect a Discord Server**:
   - Click "Add Server"
   - **Select a Scout Project** (REQUIRED) - Links Discord to existing Scout project
   - Enter the server details:
     - Project Name: A friendly name for the project
     - Server ID: The Discord server ID (enable Developer Mode to copy)
     - Server Name: As shown in Discord
     - Icon URL (optional): Server icon image URL
   
   **Important**: Discord servers must be linked to Scout projects for:
   - Bot avatar to update to Scout project's profile picture
   - Unified analytics across platforms
   - Cross-platform reporting

3. **Configure Tracked Channels**:
   - Click on a Discord project
   - Click "Settings"
   - Select which channels to track for analytics

4. **Manage Team Moderators**:
   - In project settings, add team moderators by their Twitter handle
   - Moderators can view analytics but not modify settings

5. **View Analytics**:
   - Select timeframe: Daily, Weekly, or Monthly
   - View real-time metrics:
     - Total messages and active users
     - Sentiment distribution (positive/neutral/negative)
     - Activity trends over time
     - Top contributors with sentiment scores
     - Channel activity breakdown

6. **Generate Reports**:
   - Click "Download PDF" to get a full report
   - Click "Share" to generate a shareable link for the current view

## Architecture

### Data Storage (Redis)
- **Discord Projects**: `project:discord:{id}`
- **Messages**: `message:discord:{projectId}:{messageId}`
- **Users**: `discord:user:{userId}`
- **Indexes**: For efficient queries by project, channel, and user

### Services
- **DiscordService**: Handles all Discord-related operations
- **GeminiService**: Manages sentiment analysis using Google's Gemini AI
- **Discord Bot**: Separate process that connects to Discord and logs messages

### API Endpoints
- `GET /api/discord/projects` - List all Discord projects
- `POST /api/discord/projects` - Create new Discord project
- `GET /api/discord/projects/{id}` - Get project details
- `PUT /api/discord/projects/{id}` - Update project
- `GET /api/discord/projects/{id}/analytics` - Get analytics data
- `GET /api/discord/projects/{id}/channels` - List channels
- `PUT /api/discord/projects/{id}/channels` - Update tracked channels
- `GET /api/discord/gemini-key` - Get masked API key
- `PUT /api/discord/gemini-key` - Update Gemini API key

## Security
- Admin/Core role required for all Discord analytics features
- API keys are stored securely in Redis
- Shareable links include access tokens for viewer-only access
- Bot token should never be exposed client-side

## Troubleshooting

### Bot Not Logging Messages
1. Ensure bot has proper permissions in the Discord server
2. Check that channels are marked as tracked in settings
3. Verify bot is online (green status in Discord)
4. Check bot logs for errors

### Sentiment Analysis Not Working
1. Verify Gemini API key is set correctly
2. Check for rate limiting (implements automatic retry)
3. Ensure message content intent is enabled

### Analytics Not Updating
1. Messages may take a few seconds to process
2. Refresh the page to see latest data
3. Check Redis connection is active

### Analytics Not Showing Data

If the bot is working (saving messages) but analytics show 0 messages:

1. **Check your system clock**: Run `date` in terminal. If the date is incorrect:
   ```bash
   # macOS: Sync with time server (requires admin password)
   sudo sntp -sS time.apple.com
   
   # Alternative: Fix through System Preferences
   # 1. Open System Preferences > Date & Time
   # 2. Click the lock to make changes
   # 3. Uncheck "Set date and time automatically"
   # 4. Set the correct date and time manually
   # 5. Re-check "Set date and time automatically"
   ```

2. **Messages saved with wrong timestamps**: If your system clock was wrong when messages were saved, they might have future timestamps. The analytics "last 7 days" filter won't include future messages.

3. **Test analytics manually**:
   ```bash
   node scripts/test-analytics-all-time.js
   ```

### Testing Sentiment Analysis

1. **Send a test message** in Discord in a tracked channel
2. **Check bot logs** to see sentiment:
   ```bash
   tail -f bot.log | grep sentiment
   ```
3. **Check stored messages**:
   ```bash
   node scripts/check-messages.js
   ```

### Share Link Authentication

The Discord analytics share links require authentication and proper role permissions:
- **Allowed roles**: admin, core, team, viewer
- **Access denied**: Users without these roles will see an access denied message
- **Login required**: Unauthenticated users will be redirected to login

**Note**: After logging in, you'll be redirected back to the share page automatically.

## Testing

### Check Bot Status
```bash
# Check if messages are being saved
node scripts/check-messages.js

# Test Discord channel setup
node scripts/test-discord-channel.js
```

### Current Bot Features
- **Enhanced Bot** (`bot-enhanced.js`):
  - Automatically updates channel metadata
  - Sets bot avatar to Scout project PFP (when linked)
  - Tracks unique users accurately
  - Loads Scout project data
  - Refreshes data every 5 minutes

## Future Enhancements
- Real-time WebSocket updates for live analytics
- Custom sentiment training for specific communities
- Integration with campaign management
- Automated moderation based on sentiment
- Export analytics to external platforms

## Recent Fixes

### Share Page URL Issue (Fixed)
The share page was showing 404 errors due to URL encoding of the project ID. Fixed by decoding the URL parameter in the share page component.

### Sentiment Analysis (Fixed)
Sentiment was always showing as "neutral" because:
1. The Gemini model name changed from `gemini-pro` to `gemini-1.5-flash`
2. Updated the model name in `lib/services/gemini-service.ts`
3. Bot now calls the API endpoint which properly analyzes sentiment

**To test sentiment analysis:**
1. Send a message with clear sentiment in Discord (e.g., "This is amazing!" or "I hate this")
2. Check the logs: `tail -f bot.log | grep sentiment`
3. View analytics to see sentiment distribution

## Testing
```bash
# Check if messages are being saved
node scripts/check-messages.js

# Test Discord channel setup
node scripts/test-discord-channel.js
```

### Current Bot Features
- **Enhanced Bot** (`bot-enhanced.js`):
  - Automatically updates channel metadata
  - Sets bot avatar to Scout project PFP (when linked)
  - Tracks unique users accurately
  - Loads Scout project data
  - Refreshes data every 5 minutes

## Future Enhancements
- Real-time WebSocket updates for live analytics
- Custom sentiment training for specific communities
- Integration with campaign management
- Automated moderation based on sentiment
- Export analytics to external platforms 