# Twitter Sync Deployment Checklist

## Prerequisites

1. **Twitter Bearer Token**
   - [ ] Obtain a Twitter Bearer Token from [Twitter Developer Portal](https://developer.twitter.com)
   - [ ] The token should start with "AAAAAAAAAA..." and be about 116 characters long

## Local Verification

1. **Add to .env.local**
   ```
   TWITTER_BEARER_TOKEN=your_bearer_token_here
   ```

2. **Test locally**
   ```bash
   npm run debug:twitter-sync
   ```
   You should see:
   - ✅ Twitter API connection successful
   - ✅ Redis connection successful

3. **Test campaign sync**
   ```bash
   npm run debug:campaign-tweets campaign:Te-1hZJ5AfwCwAEayvwLI
   ```
   You should see tweet links and metrics.

## Vercel Deployment

1. **Add Environment Variable**
   - Go to your Vercel project settings
   - Navigate to Settings → Environment Variables
   - Add: `TWITTER_BEARER_TOKEN` with your token value
   - Select all environments (Production, Preview, Development)

2. **Deploy Changes**
   ```bash
   git add .
   git commit -m "Fix Twitter sync - add better logging and handle mixed KOL formats"
   git push origin main
   ```

3. **Verify Deployment**
   - Wait for Vercel to finish deploying
   - Check the deployment logs for any errors
   - Visit your production site

## Troubleshooting

### Still showing "No tweets found to sync"?

1. **Check Vercel Function Logs**
   - Go to Vercel Dashboard → Functions tab
   - Look for `/api/campaigns/[id]/sync-tweets`
   - Check the logs for:
     - "Bearer Token present: true"
     - "Found X KOLs in campaign object"
     - Any error messages

2. **Verify KOLs have tweet links**
   - In the campaign, check that KOLs have tweet URLs
   - URLs should be in format: `https://x.com/user/status/1234567890`

3. **Check Environment Variables**
   - In Vercel, go to Settings → Environment Variables
   - Ensure `TWITTER_BEARER_TOKEN` is set
   - Click "..." → "Edit" to verify it's not empty

4. **Force Redeploy**
   - In Vercel, go to Deployments
   - Click "..." on the latest deployment
   - Select "Redeploy"
   - Choose "Use existing Build Cache: No"

## Expected Results

When sync works correctly, you should see:
- Server logs showing "Found 16 KOLs in campaign object"
- Server logs showing "Total unique tweet IDs: 4" (for your campaign)
- Client alert: "Successfully synced 4 tweets"
- Updated view counts and engagement metrics on KOLs

## Common Issues

1. **Bearer Token not set in production**
   - Most common issue - double-check Vercel env vars

2. **Old deployment cached**
   - Force redeploy without cache

3. **Tweet URLs in wrong format**
   - Should be `https://x.com/...` or `https://twitter.com/...`

4. **Rate limiting**
   - Free tier allows 300 requests per 15 minutes
   - Check if you see "Rate limited" in logs 