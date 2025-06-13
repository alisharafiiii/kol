# Discord Share Authentication Fix Guide

## Issue
When accessing Discord share links, users experience:
1. Login module flickering
2. Access denied even with admin accounts

## Root Causes
1. Session state race condition
2. Browser cookie/cache issues
3. Authentication credentials not being sent with API requests

## Solution Steps

### 1. Clear Browser Data
**This is the most important step!**

#### Chrome/Edge:
1. Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
2. Select "Cookies and other site data" and "Cached images and files"
3. Choose "All time" for time range
4. Click "Clear data"

#### Safari:
1. Go to Safari → Preferences → Privacy
2. Click "Manage Website Data"
3. Search for "localhost"
4. Remove all localhost entries
5. Also go to Develop → Empty Caches

#### Firefox:
1. Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
2. Select "Cookies" and "Cache"
3. Click "Clear"

### 2. Test Authentication Flow

1. **Sign Out Completely**
   - Go to: http://localhost:3000/api/auth/signout
   - Wait for redirect

2. **Sign In Fresh**
   - Go to: http://localhost:3000/api/auth/signin
   - Click "Sign in with X"
   - Authorize the app

3. **Verify Session**
   - Open: http://localhost:3000/api/debug/session
   - You should see:
   ```json
   {
     "success": true,
     "session": {
       "authenticated": true,
       "twitterHandle": "sharafi_eth",
       "role": "admin"
     }
   }
   ```

4. **Test Discord Share Link**
   - Now try accessing your Discord share link
   - It should work without flickering

### 3. Browser Console Debugging

Open browser console (F12) and look for these logs:

**Success flow:**
```
Discord Share: Session status: authenticated
Discord Share: User authenticated as: sharafi_eth
Discord Share: User profile: {role: "admin", ...}
Discord Share: Hardcoded admin detected: sharafi_eth
Discord Share: Access granted. Role: admin
Discord Share: Project loaded: [project name]
Discord Share: Analytics loaded
```

**If you see access denied:**
- Check the role shown in the error
- Ensure you're signed in as the correct account

### 4. Alternative Solutions

If still having issues:

1. **Use Incognito/Private Mode**
   - Opens with fresh cookies
   - No extensions interfering

2. **Try Different Browser**
   - Chrome, Firefox, or Edge
   - Avoid Safari on mobile

3. **Disable Browser Extensions**
   - Ad blockers can interfere
   - Privacy extensions may block cookies

4. **Check Development Server**
   - Restart with `npm run dev`
   - Check for Redis errors

### 5. Mobile-Specific Issues

For mobile browsers:

1. **Safari Settings**
   - Settings → Safari → Privacy & Security
   - Disable "Prevent Cross-Site Tracking"
   - Enable "Allow Cookies"

2. **Chrome Mobile**
   - Settings → Site Settings → Cookies
   - Allow all cookies

3. **Use Desktop Mode**
   - Long press refresh → Request Desktop Site

## Technical Details

The fixes applied:
1. Added `credentials: 'include'` to all API calls
2. Added `cache: 'no-store'` to prevent stale auth data
3. Improved session state handling to prevent race conditions
4. Added proper error handling for expired sessions
5. Hardcoded admin check for sharafi_eth and alinabu

## Allowed Roles for Discord Analytics
- `admin` - Full access
- `core` - Core team members
- `viewer` - View-only access

## If Nothing Works

1. Check server logs for errors
2. Verify Redis is running: `redis-cli ping`
3. Check `.env` file has all required variables
4. Try accessing from a different network
5. Contact system administrator 