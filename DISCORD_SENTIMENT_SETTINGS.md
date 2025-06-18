# Discord Sentiment Settings Guide

## Overview

The Discord analytics system now supports customizable sentiment analysis settings for each Discord server. This allows you to define custom keywords and emojis that indicate bullish or bearish sentiment, ignore specific channels, and set minimum message length requirements.

## Features

### 1. Customizable Keywords
- **Bullish Keywords**: Words that indicate positive sentiment (e.g., "moon", "pump", "bullish")
- **Bearish Keywords**: Words that indicate negative sentiment (e.g., "dump", "crash", "bearish")

### 2. Emoji Detection
- **Bullish Emojis**: Emojis that indicate positive sentiment (e.g., 🚀, 🌙, 💎)
- **Bearish Emojis**: Emojis that indicate negative sentiment (e.g., 📉, 💩, 🔴)

### 3. Channel Filtering
- **Ignored Channels**: Select channels to exclude from sentiment analysis
- Useful for excluding bot channels, announcement channels, or off-topic channels

### 4. Message Length Filter
- **Minimum Message Length**: Set the minimum character count for messages to be analyzed
- Default is 3 characters
- Helps filter out very short messages that may not contain meaningful sentiment

## How to Configure

1. Navigate to **Admin Panel** → **Discord Analytics Hub**
2. Click on your Discord server project
3. Click the **Settings** button
4. Scroll to **Sentiment Analysis Settings**
5. Configure your preferences:
   - Enter comma-separated keywords for bullish/bearish indicators
   - Enter comma-separated emojis
   - Select channels to ignore (hold Ctrl/Cmd for multiple)
   - Adjust minimum message length slider
6. Click **Save Settings**

## How It Works

### Sentiment Detection Priority

1. **Custom Keywords/Emojis First**: The system first checks for your custom keywords and emojis
2. **AI Analysis Fallback**: If no custom indicators are found, it falls back to Gemini AI analysis
3. **Confidence Scoring**: More keyword/emoji matches increase the confidence score

### Real-time Updates

- Settings take effect within 30 seconds of saving
- No need to restart the Discord bot
- The analytics bot automatically reloads settings when changes are detected

### Example Configuration

```
Bullish Keywords: moon, pump, bullish, amazing, great, lfg, wagmi
Bearish Keywords: dump, crash, bearish, terrible, scam, rug, rekt
Bullish Emojis: 🚀, 🌙, 💎, 🔥, ✨, 📈, 💚
Bearish Emojis: 📉, 💩, 🔴, ⬇️, 😢, 🐻, ❌
Ignored Channels: [bot-commands, announcements]
Minimum Message Length: 5
```

## Technical Details

### Storage
- Settings are stored in Redis under key: `discord:sentiment:{projectId}`
- Reload flags are set with 60-second TTL: `discord:sentiment:reload:{projectId}`

### API Endpoints
- GET `/api/discord/projects/{id}/sentiment-settings` - Retrieve current settings
- PUT `/api/discord/projects/{id}/sentiment-settings` - Update settings

### Bot Integration
- The analytics bot checks for reload flags every 30 seconds
- Settings are cached in memory for performance
- Channel filtering happens before sentiment analysis to save resources

## Default Behavior

If no custom settings are configured:
- Minimum message length: 3 characters
- No custom keywords or emojis
- All channels are analyzed
- Pure AI-based sentiment analysis using Gemini

## Best Practices

1. **Start Simple**: Begin with a few obvious keywords and add more over time
2. **Monitor Results**: Check the analytics dashboard to see how your settings affect sentiment scores
3. **Community-Specific**: Tailor keywords to your community's language and culture
4. **Regular Updates**: Review and update settings as community language evolves
5. **Balance**: Don't add too many keywords that might bias results too heavily

## Troubleshooting

### Settings Not Taking Effect
- Wait at least 30 seconds after saving
- Check the analytics bot logs for reload messages
- Ensure the analytics bot is running

### Unexpected Sentiment Scores
- Review your keyword lists for conflicts
- Check if certain channels should be ignored
- Verify minimum message length isn't filtering too many messages

### Performance Issues
- Limit the number of keywords to under 50 per category
- Consider increasing minimum message length
- Ignore high-traffic non-discussion channels 