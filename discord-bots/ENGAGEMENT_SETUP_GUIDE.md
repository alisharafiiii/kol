# Discord Engagement Bot - Twitter OAuth 1.0a Setup Guide

## ✅ SETUP COMPLETE - Bot is Working!

The engagement bot is now fully functional with proper OAuth 1.0a credentials:
- ✅ Tweet submission via Discord `/submit` command works
- ✅ Automatic engagement checking (likes/retweets) works
- ✅ Automatic points awarding works
- ✅ Successfully tested: Awarded 10 points to @sharafi_eth for liking

### To Run Engagement Checking:
```bash
# Manual run (for testing)
node discord-bots/engagement-batch-processor.js

# Automatic periodic checks (production)
node discord-bots/engagement-cron.js
```

---

## Setup Documentation (For Reference)

### Current Status
- ✅ Tweet submission via Discord `/submit` command works
- ❌ Automatic engagement checking (likes/retweets) doesn't work
- ❌ Automatic points awarding doesn't work

## Problem Identified
You're using **OAuth 2.0 Client ID/Secret** instead of **OAuth 1.0a API Key/Secret**. These are different values in Twitter Developer Portal!

## Solution Steps

### Get the Correct OAuth 1.0a Credentials
1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Select your app
3. Go to "Keys and tokens" tab
4. Find the **"Consumer Keys"** section (NOT "OAuth 2.0 Client ID and Client Secret")
5. You'll see:
   - **API Key**: ~25 characters (e.g., `AbCdEfGhIjKlMnOpQrStUvWxY`)
   - **API Secret**: ~50 characters

### Update Your Configuration
Replace only the API Key and Secret in `.env.local`:
```bash
# OAuth 1.0a Consumer Keys (from "Consumer Keys" section)
TWITTER_API_KEY=<your-25-char-api-key>
TWITTER_API_SECRET=<your-50-char-api-secret>

# Keep your regenerated access tokens (these are correct)
TWITTER_ACCESS_TOKEN=1458855197237821449-F8aTDYyef2YX7saj8OC5DKwV1sLlxQ
TWITTER_ACCESS_SECRET=9BYmxxxCmkziTGlz3mCGJZaJQgexNfIWxQzBhqE87elmT

# Keep OAuth 2.0 credentials (for Bearer token)
TWITTER_CLIENT_ID=UXo4X1ZVakFDTHUyNVNBUXl6Mzc6MTpjaQ
TWITTER_CLIENT_SECRET=-DbmLslP-CvxEVz36ic-C6lR9FsjT5uoAOV1mSu420mEFuJ42r
```

### Visual Reference
In Twitter Developer Portal:
```
Keys and tokens tab:
│
├── Consumer Keys ← GET THESE VALUES
│   ├── API Key: [Regenerate]
│   └── API Secret: (hidden)
│
├── Authentication Tokens ✓ Already have these
│   ├── Access Token
│   └── Access Token Secret
│
└── OAuth 2.0 Client ID and Client Secret ✓ Different from API Key/Secret
    ├── Client ID
    └── Client Secret
```

### Testing After Setup
```bash
node discord-bots/engagement-batch-processor.js
```

Success looks like:
- "✅ Awarded X points to @username for liking"
- "✅ Awarded X points to @username for retweeting"

### Important Notes
1. API Key (25 chars) ≠ Client ID (longer string with colons)
2. Access tokens you regenerated are correct - keep them
3. You need BOTH OAuth 1.0a and OAuth 2.0 credentials in your app
4. Free tier Twitter API has rate limits (300 requests/15 min)
5. You also need to run the cron job for automatic checking:
   ```bash
   node discord-bots/engagement-cron.js
   ``` 