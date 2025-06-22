# Discord Username Display Fix - December 2024

## Issue Summary
Users reported that after connecting their Discord account via the bot's `/connect` command, their Discord username wasn't showing in the admin panel's social section - only their Twitter handle appeared.

## Investigation Results
1. **parsa_nftt's profile data is CORRECT**:
   - Discord ID: 934508701639905391
   - Discord Username: nftt.parsa
   - Social accounts properly formatted with both Twitter and Discord

2. **Data structure is correct**:
   ```json
   {
     "socialAccounts": {
       "twitter": {
         "handle": "parsa_nftt",
         "connected": true
       },
       "discord": {
         "id": "934508701639905391",
         "username": "nftt.parsa",
         "tag": "nftt.parsa",
         "connected": true
       }
     }
   }
   ```

## Fixes Applied

### 1. Updated Discord Bot Profile Creation
- Modified `createUserProfile` function to accept and store Discord username
- Updated modal submission handler to pass Discord username when creating profiles
- Added proper socialAccounts.discord structure when creating new profiles

### 2. Code Changes in `discord-bots/engagement-bot.js`:
- Line 109: Added `discordUsername` parameter to `createUserProfile` function
- Line 119: Added `discordUsername` field to new user profiles
- Line 129-135: Added Discord info to socialAccounts when username is provided
- Line 1005: Updated profile creation call to include `interaction.user.username`

## For Users Experiencing Display Issues

If Discord username is not showing in admin panel despite being connected:

1. **Hard refresh the admin panel** (Ctrl+F5 or Cmd+Shift+R)
2. **Clear browser cache** for the application
3. **Log out and log back in** to refresh session data
4. **Check in incognito/private browsing** to rule out cache issues

## For New Connections
Users connecting via `/connect` command going forward will have their Discord username properly saved and displayed.

## Verification
Run this command to check if a user's Discord info is properly stored:
```bash
node -e "
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const profile = await redis.json.get('user_USERNAME_HERE');
console.log('Discord info:', profile?.socialAccounts?.discord || 'Not found');
"
```

Replace `USERNAME_HERE` with the user's Twitter handle (lowercase, no @). 