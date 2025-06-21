# Engagement Bot Fix Documentation

## Issue
The engagement bot `/connect` command was showing an error "Your Twitter account is not approved. Please apply through the website first" instead of creating a profile for new users like other login flows.

## Solution
Modified the engagement bot to create pending profiles for new users, matching the behavior of other authentication flows in the system.

## Changes Made

### 1. Added Profile Creation Function
Added `createUserProfile` function that creates a new user profile with:
- Status: `pending` (requires admin approval)
- Role: `user` (default role)
- Tier: `micro` (default tier)
- Proper indexing in Redis

### 2. Updated User Check Logic
Modified `isUserApproved` to return an `exists` flag to differentiate between:
- User doesn't exist (create new profile)
- User exists but not approved (show pending message)
- User exists and is approved (allow connection)

### 3. Enhanced Connect Flow
The `/connect` command now:
- Creates a profile for new users with pending status
- Shows appropriate messages for each state
- Maintains existing behavior for approved users

## User Experience

### New Users
```
📝 Your Twitter account @username has been registered!

⏳ **Your account is pending approval.** An admin will review and approve your account soon.
📢 You'll be notified once approved and can then use the engagement features.
```

### Existing Pending Users
```
❌ Your Twitter account is pending approval. Please wait for an admin to approve your account.
```

### Approved Users
Normal connection flow continues as before.

## Files Modified
- `discord-bots/engagement-bot.js` - Main bot file with the fixes

## Backup
- `discord-bots/engagement-bot-original.js` - Original version backup

## To Restore Original
```bash
cp discord-bots/engagement-bot-original.js discord-bots/engagement-bot.js
pkill -f engagement-bot.js
cd discord-bots && node engagement-bot.js
```

## Admin Actions Required
After users register via `/connect`:
1. Go to admin panel
2. Review pending users
3. Approve users to grant access to engagement features

## Testing
1. In Discord, use `/connect` with a new Twitter handle
2. Verify profile is created in admin panel as "pending"
3. Approve the user in admin panel
4. User can now use engagement features

## No Impact On
- Analytics bot functionality
- Other authentication flows
- Existing approved users
- Other bot features 