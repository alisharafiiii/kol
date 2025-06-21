# Discord OAuth Implementation

## Overview
The engagement bot now uses Twitter OAuth for secure account linking instead of manual Twitter handle input.

## How It Works

### 1. User Initiates Connection
- User types `/connect` in Discord
- Bot generates a unique verification session ID
- Session is stored in Redis with 10-minute expiration

### 2. OAuth Flow
- Bot sends a button with OAuth link
- User clicks button → redirected to website
- Website redirects to Twitter OAuth login
- After Twitter auth, accounts are linked

### 3. Account Linking Logic
- **Existing User**: Discord ID is added to their social accounts
- **New User**: Profile created with both Twitter and Discord linked
- New users are set to "pending" approval status

## Technical Details

### Session Storage
```javascript
// Session key format
const sessionKey = `discord:verify:${sessionId}`

// Session data structure
{
  discordId: '123456789',
  discordUsername: 'username',
  discordTag: 'username#1234',
  timestamp: 1234567890
}
```

### Profile Structure
```javascript
// Social accounts in profile
socialAccounts: {
  twitter: {
    handle: 'username',
    connected: true
  },
  discord: {
    id: '123456789',
    username: 'username',
    tag: 'username#1234',
    connected: true
  }
}
```

### Engagement Connection
```javascript
// Stored at: engagement:connection:{discordId}
{
  discordId: '123456789',
  twitterHandle: 'username',
  tier: 'micro',
  connectedAt: '2025-01-22T...',
  totalPoints: 0,
  role: 'user'
}
```

## Files Modified

1. **discord-bots/engagement-bot-working.js**
   - Replaced modal with OAuth button
   - Generates verification sessions
   - Sends OAuth link to users

2. **app/auth/discord-link/page.tsx**
   - Handles OAuth callback
   - Shows loading/success/error states
   - Redirects to Twitter if not authenticated

3. **app/api/auth/discord-link/route.ts**
   - Links Discord to existing profiles
   - Creates new profiles for new users
   - Sets up engagement connections

## Testing

Run the test script:
```bash
node scripts/test-discord-oauth-flow.js
```

## Security Features

- Unique session IDs prevent replay attacks
- Sessions expire after 10 minutes
- OAuth ensures Twitter account ownership
- Ephemeral Discord messages for privacy 