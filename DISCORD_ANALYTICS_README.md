# Discord Analytics System Documentation

## Overview
This is a comprehensive Discord analytics system with Gemini AI sentiment analysis, bot integration, and web dashboard.

## Components

### 1. Discord Bot (`bot-enhanced.js`)
- Tracks messages in configured channels
- Sends messages to API for sentiment analysis
- Updates channel metadata every 5 minutes
- Integrates with Scout project avatars
- Uses Redis for data storage

### 2. Admin Panel
- `/admin/discord` - List all Discord projects
- `/admin/discord/[id]` - View project details and analytics
- Full CRUD operations for Discord projects
- Channel management interface

### 3. Share Links
- `/discord/share/[id]` - Public analytics viewing
- URL-safe format: converts `:` to `--` in project IDs
- Authentication required (login page for unauthenticated users)
- Role-based access: admin, core, team, viewer roles allowed
- Gets role directly from session for reliability

### 4. API Endpoints
- `/api/discord/projects` - CRUD operations
- `/api/discord/projects/[id]/analytics` - Get analytics data
- `/api/discord/messages` - Bot endpoint for sentiment analysis
- `/api/discord/projects/[id]/channels` - Channel management

## Setup Instructions

### Environment Variables
```env
DISCORD_BOT_TOKEN=your_bot_token
GEMINI_API_KEY=your_gemini_key
REDIS_URL=your_redis_url
```

### Running the Bot
```bash
node bot-enhanced.js > bot.log 2>&1 &
```

### Bot Commands
- In any tracked channel: Just send messages normally
- Bot will automatically analyze sentiment and store data

## Technical Details

### Data Storage
- Project IDs: `project:discord:[nanoid]`
- Messages: `message:discord:[projectId]:[messageId]`
- Analytics: Calculated from stored messages

### Sentiment Analysis
- Uses Gemini 1.5 Flash model
- Categories: positive, negative, neutral
- Bot sends messages to `/api/discord/messages` for analysis

## Common Issues & Solutions

### 1. Authentication Issues
- **Problem**: Access denied even with admin role
- **Solution**: Role is now checked directly from session instead of profile API
- **Fixed**: Discord share page uses `(session as any)?.role || (session.user as any)?.role`

### 2. URL Format Issues
- **Problem**: Project IDs with colons break Next.js routing
- **Solution**: URLs convert `:` to `--` automatically

### 3. System Clock Issues
- **Problem**: Wrong system date affects analytics
- **Solution**: Check system date with `date` command

### 4. Bot Cache Issues
- **Problem**: Bot caches old project IDs
- **Solution**: Restart bot to clear cache

## Testing

### Check Messages
```bash
node scripts/check-messages.js
```

### Test Analytics (All Time)
```bash
node scripts/test-analytics-all-time.js
```

### Monitor Bot Activity
```bash
tail -f bot.log | grep -E "(📨|sentiment)"
```

## Current Status
- ✅ Bot tracking messages in configured channels
- ✅ Sentiment analysis working (positive/negative/neutral)
- ✅ Share links functional with authentication
- ✅ Analytics dashboard displaying data
- ✅ Role-based access control working 