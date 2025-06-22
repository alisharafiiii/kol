# Discord Engagement Bot - Twitter API Authentication Analysis

## Executive Summary

The Discord engagement bot's batch processor **cannot use the existing Twitter Bearer token** (used by tweet-sync) because the required Twitter API endpoints need different authentication.

## Current State

### What Works
- **Tweet-sync functionality**: Uses Bearer token (App-only auth) to fetch tweet metrics
- **Tweet submission**: Discord bot successfully accepts and stores tweet submissions
- **Basic tweet data fetching**: Can get tweet content and public metrics with Bearer token

### What Doesn't Work
- **Engagement checking**: Cannot fetch who liked or retweeted tweets
- **Points awarding**: Cannot award points because we can't see who engaged

## Confirmed Environment Variables

Current Twitter credentials in `.env.local`:
- ✅ `TWITTER_BEARER_TOKEN` - Used by tweet-sync (App-only auth)
- ✅ `TWITTER_CLIENT_ID` - OAuth 2.0 client ID
- ✅ `TWITTER_CLIENT_SECRET` - OAuth 2.0 client secret
- ✅ `TWITTER_API_KEY` - Added (same as CLIENT_ID)
- ✅ `TWITTER_API_SECRET` - Added (same as CLIENT_SECRET)
- ✅ `TWITTER_ACCESS_TOKEN` - Added by user
- ✅ `TWITTER_ACCESS_SECRET` - Added by user

## OAuth 1.0a Testing Results (December 2024)

### First Credentials Added
1. User provided OAuth 1.0a access tokens:
   - `TWITTER_ACCESS_TOKEN=1458855197237821449-PrVrjP9iUO4V7Yf1OWXYLzMLMkgU5T`
   - `TWITTER_ACCESS_SECRET=gKqbB9DTKK2l2X0QfL2RklETaziHKVgSsfvHX4L0D6oLM`

2. Created aliases for API key/secret:
   - `TWITTER_API_KEY` = Same as `TWITTER_CLIENT_ID`
   - `TWITTER_API_SECRET` = Same as `TWITTER_CLIENT_SECRET`

3. Installed `twitter-api-v2` package

### First Test Results
- ❌ **Authentication Failed**: 401 Unauthorized error
- The access token/secret appear to be from a different Twitter app than the API key/secret
- OAuth 1.0a requires all 4 credentials to be from the same Twitter app

### Second Credentials Testing
1. User provided updated OAuth 1.0a access tokens:
   - `TWITTER_ACCESS_TOKEN=1458855197237821449-TsFPsthXjy44qdQRTgYXJjdzxPoP5q`
   - `TWITTER_ACCESS_SECRET=ZlP5wfwTh6ToeHguvjza5Ds78RfWyphHfZQdww1B3MlNT`

2. Test Results:
   - ❌ **Authentication Still Failed**: 401 Unauthorized error
   - Same issue - credentials don't match the Twitter app

### Root Cause
The OAuth 1.0a access tokens provided don't match the Twitter app (Client ID/Secret). This is a common issue when:
1. Access tokens were generated from a different Twitter app
2. The tokens have expired or been revoked
3. The app's permissions have changed

## Critical Discovery: OAuth Version Mismatch

### The Problem
**You are using OAuth 2.0 Client ID/Secret as OAuth 1.0a API Key/Secret**

In Twitter Developer Portal, these are DIFFERENT values:
- **OAuth 2.0**: Uses "Client ID" and "Client Secret" (what you have)
- **OAuth 1.0a**: Uses "API Key" and "API Secret" (what you need)

### Current Configuration
- `TWITTER_API_KEY` = `UXo4X1ZVakFDTHUyNVNBUXl6Mzc6MTpjaQ` (OAuth 2.0 Client ID) ❌
- `TWITTER_API_SECRET` = OAuth 2.0 Client Secret ❌
- `TWITTER_ACCESS_TOKEN` = Correctly regenerated ✅
- `TWITTER_ACCESS_SECRET` = Correctly regenerated ✅

### Why This Matters
- OAuth 2.0 Client ID/Secret → Used for Bearer token (app-only auth) ✅ Working
- OAuth 1.0a API Key/Secret → Used for user context auth ❌ Not working

## Technical Details

### Authentication Types
1. **Bearer Token (App-only)** - What we have
   - Used by: `lib/services/twitter-sync-service.ts`
   - Can access: Tweet content, public metrics (like count, retweet count)
   - Cannot access: Who liked/retweeted (user lists)

2. **OAuth 1.0a or OAuth 2.0 User Context** - What we need
   - Required for: `/tweets/:id/liking_users` and `/tweets/:id/retweeted_by` endpoints
   - Needs: User authentication flow, not just app credentials

### Error Evidence
```
Twitter API error (403): {
  "title": "Unsupported Authentication",
  "detail": "Authenticating with OAuth 2.0 Application-Only is forbidden for this endpoint. 
            Supported authentication types are [OAuth 1.0a User Context, OAuth 2.0 User Context].",
  "type": "https://api.twitter.com/2/problems/unsupported-authentication",
  "status": 403
}
```

## Why Tweet-Sync Works But Engagement Doesn't

| Feature | Endpoint | Auth Required | Status |
|---------|----------|---------------|---------|
| Get tweet metrics | `/tweets/:id` | Bearer Token ✓ | ✅ Works |
| Get who liked | `/tweets/:id/liking_users` | User Auth ✗ | ❌ Fails |
| Get who retweeted | `/tweets/:id/retweeted_by` | User Auth ✗ | ❌ Fails |

## Required Changes to Make Engagement Work

### Option 1: OAuth 1.0a (Traditional)
Need these environment variables:
- `TWITTER_API_KEY` (Consumer Key)
- `TWITTER_API_SECRET` (Consumer Secret)  
- `TWITTER_ACCESS_TOKEN` (User Access Token)
- `TWITTER_ACCESS_SECRET` (User Access Secret)

### Option 2: OAuth 2.0 User Context (Modern)
Need to:
1. Implement OAuth 2.0 flow
2. Store user tokens
3. Handle token refresh

## Current Code State

### Fixed Issues
- ✅ Environment loading from parent directory
- ✅ Removed dependency on `twitter-api-v2` package
- ✅ Using same Bearer token as tweet-sync
- ✅ Proper error handling

### Remaining Issues
- ❌ Cannot access user engagement endpoints with Bearer token
- ❌ No OAuth 1.0a credentials configured
- ❌ Engagement cron job not running

## Recommendations

### To Make Engagement Checking Work

You need the **OAuth 1.0a Consumer Keys** from Twitter Developer Portal:

1. **Go to Twitter Developer Portal**
   - Navigate to your app's "Keys and tokens" tab
   - Look for the **"Consumer Keys"** section (NOT "OAuth 2.0 Client ID and Client Secret")

2. **Get the OAuth 1.0a Credentials**
   - **API Key**: ~25 characters (e.g., `AbCdEfGhIjKlMnOpQrStUvWxY`)
   - **API Secret**: ~50 characters

3. **Update `.env.local`**
   ```bash
   # Replace these with actual OAuth 1.0a values
   TWITTER_API_KEY=<25-char API Key from Consumer Keys section>
   TWITTER_API_SECRET=<50-char API Secret from Consumer Keys section>
   
   # Keep your regenerated access tokens
   TWITTER_ACCESS_TOKEN=1458855197237821449-F8aTDYyef2YX7saj8OC5DKwV1sLlxQ
   TWITTER_ACCESS_SECRET=9BYmxxxCmkziTGlz3mCGJZaJQgexNfIWxQzBhqE87elmT
   
   # Keep OAuth 2.0 credentials for Bearer token
   TWITTER_CLIENT_ID=UXo4X1ZVakFDTHUyNVNBUXl6Mzc6MTpjaQ
   TWITTER_CLIENT_SECRET=-DbmLslP-CvxEVz36ic-C6lR9FsjT5uoAOV1mSu420mEFuJ42r
   ```

4. **Test Again**
   ```bash
   node discord-bots/engagement-batch-processor.js
   ```

### Visual Guide
In Twitter Developer Portal, you need values from:
```
Keys and tokens tab:
├── Consumer Keys (OAuth 1.0a) ← YOU NEED THESE
│   ├── API Key: AbCdEf... (25 chars)
│   └── API Secret: AbCdEf... (50 chars)
│
├── Authentication Tokens (OAuth 1.0a) ✅ You have these
│   ├── Access Token: 145885...
│   └── Access Token Secret: 9BYmxxx...
│
└── OAuth 2.0 Client ID and Client Secret ✅ You have these
    ├── Client ID: UXo4X1ZV...
    └── Client Secret: -DbmLslP...
```

### Current Workaround

Without proper OAuth 1.0a API Key/Secret:
- Tweet submission continues to work ✅
- Tweet metrics sync continues to work ✅
- Manual engagement verification required ❌
- No automatic points awarding ❌

## Safe Verification Complete

- ✅ All requested credentials added to `.env.local`
- ✅ No existing entries were overwritten
- ✅ `twitter-api-v2` package installed
- ✅ Root cause identified: OAuth version mismatch
- ✅ No impact to existing tweet-sync functionality
- ❌ Engagement checking requires correct OAuth 1.0a API Key/Secret

## Final Success (December 2024)

### Solution Implemented
User provided the correct OAuth 1.0a Consumer Keys:
- `TWITTER_API_KEY` = 25-character OAuth 1.0a API Key ✅
- `TWITTER_API_SECRET` = 50-character OAuth 1.0a API Secret ✅

### Working Configuration
All 7 Twitter credentials now properly configured:
1. **OAuth 1.0a** (for user context - engagement checking):
   - `TWITTER_API_KEY` - Consumer Key
   - `TWITTER_API_SECRET` - Consumer Secret  
   - `TWITTER_ACCESS_TOKEN` - User Access Token
   - `TWITTER_ACCESS_SECRET` - User Access Secret

2. **OAuth 2.0** (for app-only auth - tweet metrics):
   - `TWITTER_CLIENT_ID` - OAuth 2.0 Client ID
   - `TWITTER_CLIENT_SECRET` - OAuth 2.0 Client Secret
   - `TWITTER_BEARER_TOKEN` - Bearer Token

### Verified Functionality
- ✅ OAuth 1.0a authentication successful (@sharafi_eth)
- ✅ Can fetch who liked tweets
- ✅ Can fetch who retweeted
- ✅ Points successfully awarded (10 points to @sharafi_eth for liking)
- ✅ Engagement batch processor fully operational

### Next Steps
To enable automatic engagement checking:
```bash
# Run the cron job for periodic checks
node discord-bots/engagement-cron.js

# Or run batch processor manually
node discord-bots/engagement-batch-processor.js
``` 