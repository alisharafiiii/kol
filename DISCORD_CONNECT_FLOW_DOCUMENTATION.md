# Discord Engagement Bot `/connect` Command Documentation

## Overview
The `/connect` command allows Discord users to link their Twitter accounts to the engagement tracking system using secure OAuth authentication.

## How It Works

### 1. User Initiates Connection
When a user types `/connect` in Discord:
- The bot creates a unique verification session in Redis
- Session key: `discord:verify:verify-{discordId}-{timestamp}`
- Session expires in 10 minutes
- Bot generates a verification URL pointing to the web app

### 2. OAuth Flow
User clicks the verification button in Discord:
- Redirected to `{baseUrl}/auth/discord-link?session={sessionId}`
- If not signed in, redirected to Twitter OAuth
- After Twitter auth, returns to the discord-link page
- Page automatically calls the API to complete linking

### 3. Account Linking Process
The API endpoint (`/api/auth/discord-link`) performs:
1. **Session Validation**: Verifies the Discord session exists
2. **Profile Management**: 
   - Creates new profile if user doesn't exist
   - Updates existing profile with Discord info
3. **Engagement Connection**: Creates connection for tweet tracking
4. **Points Bridge**: Links Discord user to platform for points
5. **Cleanup**: Removes verification session

### 4. Data Structures Created

#### User Profile
```json
{
  "id": "user_{twitterHandle}",
  "twitterHandle": "@{handle}",
  "discordId": "{discordId}",
  "discordUsername": "{username}",
  "socialAccounts": {
    "twitter": { "handle": "{handle}", "connected": true },
    "discord": { "id": "{id}", "username": "{username}", "connected": true }
  }
}
```

#### Engagement Connection
```json
{
  "discordId": "{discordId}",
  "twitterHandle": "{handle}",
  "tier": "micro",
  "connectedAt": "{timestamp}",
  "totalPoints": 0,
  "role": "{user|admin|core}"
}
```

#### Redis Keys Created
- `engagement:connection:{discordId}` - Main connection record
- `engagement:twitter:{twitterHandle}` - Twitter to Discord mapping
- `discord:user:map:{discordId}` - Discord to platform user mapping

## Current Status

### ✅ Working Components
1. **Discord Bot Command**: `/connect` creates verification session
2. **OAuth Flow**: Twitter authentication works correctly
3. **Profile Creation**: User profiles created/updated successfully
4. **Engagement Connection**: Connections created for tweet tracking
5. **Session Management**: Verification sessions expire properly

### ⚠️ Issue Found
The Discord points bridge mapping is not being created due to user ID format mismatch. This has been fixed to handle both `user:` and `user_` prefixes.

## Testing Results

From the test data:
- 3 users have successfully connected their accounts
- 5 tweets have been submitted through the system
- Tier scenarios are properly configured
- OAuth flow completes successfully

## Security Features
1. **Temporary Sessions**: 10-minute expiration for verification
2. **OAuth Authentication**: Uses Twitter's secure OAuth flow
3. **Session Cleanup**: Verification sessions deleted after use
4. **Role Verification**: User roles checked from profile data

## Usage Instructions

### For Users:
1. Type `/connect` in any Discord channel where the bot is present
2. Click the "Verify Twitter Account" button
3. Sign in with Twitter (if not already signed in)
4. Authorize the connection
5. Close the success window and return to Discord

### For Admins:
- Monitor connections in Redis under `engagement:connection:*`
- Check Twitter mappings under `engagement:twitter:*`
- View Discord point mappings under `discord:user:map:*`

## Troubleshooting

### Common Issues:
1. **"Verification session expired"**: User took longer than 10 minutes
2. **"Not authenticated"**: Twitter session expired, need to sign in again
3. **No points awarded**: Check if Discord user mapping exists

### Debug Commands:
```bash
# Check all connections
node scripts/check-engagement-connections.mjs

# Test the flow
node scripts/test-discord-connect-flow.mjs
``` 