# Tweet Sync Setup Guide

## Overview
The tweet sync feature allows you to fetch real-time metrics (views, likes, retweets, comments) for tweets linked to campaigns. This guide covers both the permissions and Twitter API setup required.

## Fixing "Forbidden" Error

### 1. Role Requirements
Tweet syncing requires one of these roles:
- **`admin`** - Full administrative access
- **`core`** - Core team member access
- **`team`** - Team member access (newly added)

If you're getting "Forbidden" error, ask an admin to update your role.

### 2. Check Your Current Role
You can check your role in the admin panel or by looking at your profile.

## Twitter API Setup

### 1. Get Twitter Bearer Token
To sync tweet metrics, you need a Twitter API Bearer Token:

1. **Create a Twitter Developer Account**
   - Go to https://developer.twitter.com
   - Apply for developer access
   - Create a new app in the developer portal

2. **Get Your Bearer Token**
   - In your Twitter app settings, find "Keys and tokens"
   - Generate a Bearer Token
   - Copy the token (you won't be able to see it again)

3. **Add to Environment Variables**
   ```bash
   # In your .env.local or .env file
   TWITTER_BEARER_TOKEN=your_bearer_token_here
   ```

### 2. Twitter API Rate Limits
The system handles Twitter's rate limits automatically:
- **Free Tier**: 300 requests per 15 minutes
- Campaigns are queued if rate limit is reached
- The system will retry queued campaigns automatically

## How Tweet Syncing Works

1. **Automatic Extraction**: The system extracts tweet IDs from URLs in campaign KOL links
2. **Batch Processing**: Multiple tweets are fetched in batches (up to 100 per request)
3. **Metrics Updated**: Views, likes, retweets, and comments are updated for each KOL
4. **Rate Limit Handling**: If rate limited, campaigns are queued for later processing

## Troubleshooting

### Common Issues:

1. **"Forbidden" Error**
   - Your role doesn't have permission
   - Solution: Get admin/core/team role

2. **"Twitter Bearer Token not configured"**
   - Missing TWITTER_BEARER_TOKEN in environment
   - Solution: Add token to .env file

3. **"Rate limited"**
   - Too many API requests
   - Solution: Wait 15 minutes or let the queue process automatically

4. **"No tweets found to sync"**
   - No valid tweet URLs in campaign
   - Solution: Ensure KOLs have proper Twitter URLs in their links

### Checking System Status
Visit `/api/system/status` to check:
- Redis connection
- Twitter API configuration
- Current rate limit status

## Best Practices

1. **Sync Timing**: Don't sync too frequently - Twitter metrics update gradually
2. **Bulk Syncing**: The system handles multiple tweets efficiently in batches
3. **Rate Limits**: Be mindful of rate limits when syncing multiple campaigns

## API Response Examples

### Successful Sync:
```json
{
  "message": "Sync completed",
  "result": {
    "synced": 5,
    "failed": 0,
    "rateLimited": false
  }
}
```

### Rate Limited:
```json
{
  "message": "Campaign queued for sync due to rate limit",
  "queued": true,
  "result": {
    "synced": 0,
    "failed": 0,
    "rateLimited": true
  }
}
``` 