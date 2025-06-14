# 🐦 Twitter API Setup for Automatic Tweet Content

The engagement bot now automatically fetches tweet content when URLs are submitted! Here's how to set it up:

## 🔑 Required Environment Variable

Add this to your `.env.local` file:
```
TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here
```

## 📋 How to Get Your Bearer Token

1. **Go to Twitter Developer Portal**
   - Visit https://developer.twitter.com/en/portal/dashboard

2. **Create a Project/App** (if you don't have one)
   - Click "Create Project"
   - Follow the setup wizard
   - Save your credentials

3. **Get Bearer Token**
   - Go to your app's "Keys and tokens" section
   - Under "Authentication Tokens", find "Bearer Token"
   - Click "Regenerate" if needed
   - Copy the token

## 🎯 What It Does

When a user submits a tweet URL:
1. Bot extracts the tweet ID from URL
2. Fetches tweet content from Twitter API
3. Shows the actual tweet text in the preview
4. Falls back gracefully if API fails

## ⚡ Benefits

- **No manual input needed** - Users just paste URL
- **Always accurate** - Content comes directly from Twitter
- **Better engagement** - Users can see what they're engaging with
- **Cleaner process** - One less field to fill

## 🚨 Important Notes

- **Rate Limits**: Twitter API has rate limits (300 requests/15min for app auth)
- **Fallback**: If API fails, preview still works without content
- **Privacy**: Only public tweets can be fetched
- **Cost**: Basic API access is free for up to 500k tweets/month

## 🔧 Troubleshooting

**"Could not fetch tweet content"**
- Check if TWITTER_BEARER_TOKEN is set correctly
- Verify the tweet is public
- Check Twitter API status

**No content showing**
- Some tweets (deleted/private) won't have accessible content
- Check bot logs for specific errors

## 📝 Example Flow

1. User runs: `/submit url:https://twitter.com/user/status/123`
2. Bot fetches tweet content automatically
3. Preview shows:
   ```
   @username
   "This is the actual tweet content fetched from Twitter!"
   
   💰 Earn 1.5x points:
   ❤️ Like: 15 pts | 🔁 RT: 30 pts | 💬 Reply: 45 pts
   ```

No more asking users to copy/paste tweet content! 🎉 