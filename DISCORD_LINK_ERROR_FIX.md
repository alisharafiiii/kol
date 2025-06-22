# Discord Link Error Fix - December 2024

## Issues Fixed

### 1. Discord Points Bridge User ID Mismatch
**Problem**: The Discord link API was stripping prefixes from user IDs before passing to DiscordPointsBridge, but the bridge was re-adding a "user:" prefix, causing mismatched keys.

**Solution**: 
- Modified `app/api/auth/discord-link/route.ts` to pass the full userId without stripping prefixes
- Updated `lib/services/discord-points-bridge.ts` to not add the "user:" prefix since userId already contains the full key

### 2. WRONGTYPE Redis Error for MADMATT3M
**Problem**: The username index `idx:username:madmatt3m` was stored as a string instead of a set, causing a WRONGTYPE error when trying to use set operations.

**Solution**:
- Deleted the corrupted string index
- Recreated it properly as a set with the correct user key

### 3. Deprecated Meta Tag Warning
**Problem**: `apple-mobile-web-app-capable` meta tag is deprecated

**Solution**: Added the modern `mobile-web-app-capable` meta tag in `app/layout.tsx` alongside the Apple-specific one for backward compatibility

## Verification Steps

1. MADMATT3M should now be able to:
   - Log in to the web app with Twitter
   - Use `/connect` command in Discord
   - Click the link and complete the connection without errors

2. The Discord points system should properly link users for point tracking

## Files Modified
- `app/api/auth/discord-link/route.ts`
- `lib/services/discord-points-bridge.ts`
- `app/layout.tsx` 