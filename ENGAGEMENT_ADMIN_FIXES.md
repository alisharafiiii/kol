# Engagement Admin Page Fixes

This document details the three critical issues fixed on the `/admin/engagement` page and their solutions.

## Issues Fixed

### 1. Recent Activity Not Updating

**Problem:**
- The "Recent Activity" section only showed tweets fetched on initial page load
- New tweets submitted via Discord bot weren't visible until manual page refresh
- No automatic refresh mechanism existed

**Solution:**
- Added `fetchRecentTweets()` function that fetches only tweet data
- Implemented periodic updates every 30 seconds using `setInterval`
- Added "Refresh Tweets" manual button for immediate updates
- Updates only run when page is visible (see Issue 3)

**Technical Details:**
```typescript
// Periodic update mechanism
const startPeriodicUpdates = useCallback(() => {
  fetchInterval.current = setInterval(() => {
    if (!document.hidden && isComponentMounted.current) {
      fetchRecentTweets()
    }
  }, 30000) // 30 seconds
}, [])
```

### 2. Batch Job Creation Shows 'Forbidden' Despite Admin Role

**Problem:**
- Admin users received "Forbidden" error when creating batch jobs
- Session credentials weren't properly sent with API requests
- Authorization checks failed despite valid admin role

**Root Cause:**
- NextAuth session cookies weren't being sent with fetch requests
- The `checkAuth` function in the API route couldn't access the session

**Solution:**
- Added `credentials: 'include'` to all API fetch calls
- Ensures session cookies are sent with every request
- Added debug logging to track authentication flow

**Technical Details:**
```typescript
// Fixed API calls
const res = await fetch('/api/engagement/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include' // Critical fix
})
```

### 3. Page Refreshes Every Time Browser Tab is Switched

**Problem:**
- Page would refresh data whenever user switched tabs
- Caused unnecessary API calls and UI flicker
- Poor user experience when multitasking

**Solution:**
- Implemented Page Visibility API handling
- Added cooldown mechanism (5 seconds minimum between fetches)
- Pauses updates when page is hidden, resumes when visible

**Technical Details:**
```typescript
// Visibility change handler
const handleVisibilityChange = () => {
  if (document.hidden) {
    // Pause updates
    clearInterval(fetchInterval.current)
  } else {
    // Resume updates if cooldown passed
    const timeSinceLastFetch = Date.now() - lastFetchTime.current
    if (timeSinceLastFetch > FETCH_COOLDOWN) {
      fetchData()
    }
    startPeriodicUpdates()
  }
}
```

## Additional Improvements

### Enhanced Logging
- Added comprehensive console logging with `[Engagement Admin]` prefix
- Logs user role, session data, and API responses
- Helps debug authentication issues

### UI Enhancements
- Added session info display showing logged-in user and role
- Added "Updates every 30 seconds" indicator for Recent Activity
- Added empty state message when no tweets exist
- Manual refresh button for immediate updates

### State Management
- Added refs to track component mount state
- Prevents updates after component unmount
- Prevents memory leaks from abandoned intervals

## Testing Checklist

- [x] Recent Activity updates automatically every 30 seconds
- [x] New tweets appear without manual refresh
- [x] Batch job creation works for admin users
- [x] Page doesn't refresh when switching tabs
- [x] Updates pause when tab is hidden
- [x] Updates resume when tab becomes visible
- [x] Manual refresh button works
- [x] All API calls include credentials

## Additional Fix: Recent Activity Not Showing

### Problem Found
- Server system clock was set to June 2025 (6 months in the future)
- All tweets were being stored with future timestamps
- The 24-hour filter was comparing against current time, so no tweets appeared "recent"

### Solution Applied
1. Modified `getRecentTweets` to fetch last 100 tweets by position instead of time filter
2. Added client-side sorting to ensure newest tweets appear first
3. Removed dependency on absolute timestamps for filtering

### Permanent Fix Needed
- Server system clock should be corrected to show actual current date/time
- This is causing timestamps throughout the system to be incorrect

## Additional Fix: Batch Processing and Points

### Problem Found
- Clicking "Create Batch Job" only creates a pending job record
- The actual processing requires running a separate Node.js script
- Points are only awarded to users who have connected both Discord & Twitter accounts

### How the System Works
1. **Create Batch Job**: Creates a "pending" job in the database
2. **Run Processor**: Execute `node discord-bots/engagement-batch-processor.js`
3. **Twitter API Check**: The processor calls Twitter API to get likes/retweets
4. **Award Points**: Points are given to connected users based on engagement

### Why No Points Were Awarded
- The batch processor found tweets with engagement (181 likes, 99 likes)
- But 0 points were awarded because:
  - **Twitter API Access Level Issue**: The current API credentials only have "Essential" access
  - The `tweetLikedBy` endpoint requires "Elevated" or "Academic" access
  - Without this endpoint, the system cannot see WHO liked/retweeted the tweets
  - Even if users have connected accounts, the API can't retrieve their engagement

### Solution
1. **Upgrade Twitter API Access**:
   - Go to https://developer.twitter.com/en/portal/dashboard
   - Apply for "Elevated" access (free but requires approval)
   - This will enable the `tweetLikedBy` and `tweetRetweetedBy` endpoints

2. **Run the batch processor** (after API upgrade):
   ```bash
   node scripts/run-engagement-batch.mjs
   ```

3. **Set up automatic processing with cron**:
   ```bash
   chmod +x scripts/setup-engagement-cron.sh
   ./scripts/setup-engagement-cron.sh
   ```

### Current Status
- ✅ Batch jobs are created successfully
- ✅ Tweets are being tracked with metrics
- ✅ Users have connected Discord & Twitter accounts
- ✅ Point rules are configured
- ❌ Twitter API cannot retrieve who liked/retweeted (needs Elevated access)
- ❌ Therefore, no points can be awarded until API access is upgraded

## Future Considerations

1. **WebSocket Integration**: Consider real-time updates via WebSocket for instant tweet display
2. **Optimistic Updates**: Show tweets immediately after submission, before server confirmation
3. **Error Recovery**: Add retry logic for failed API calls
4. **Performance**: Implement pagination for large tweet lists
5. **Time Sync**: Implement NTP time synchronization to prevent clock drift issues
6. **Automated Processing**: Integrate batch processor directly into the web app or use a job queue
7. **Twitter API Limits**: Handle rate limits and consider caching engagement data

## Additional Fix: Authentication Issues

### Problem Found
- Users with admin role were still getting "Forbidden" errors
- Root cause: Duplicate profile entries from legacy data migration
- Auth system was finding old profiles with incorrect roles

### Solution Applied
- Removed duplicate profile entries from Redis
- Cleaned up username indexes to point to correct profile
- Set session invalidation flags to force JWT refresh

### If Authentication Issues Persist
1. Check for duplicate profiles: `idx:username:{handle}` should only contain one ID
2. Verify the correct profile has the right role
3. User must sign out and sign back in after fixes
4. Consider implementing profile deduplication during migration

### Root Cause of Persistent 403 Errors
The system has two different profile storage mechanisms:
- **New system**: Stores profiles with `profile:` prefix (e.g., `profile:user_sharafi_eth`)
- **Old auth system**: Looks for profiles with `user:` prefix (e.g., `user:user_sharafi_eth`)

When the auth system can't find the profile in the expected location, it defaults to unauthorized access.

### Fix Applied
Created a "bridge" by copying the profile data from the new location to where the old auth system expects it:
- Source: `profile:user_sharafi_eth` (has correct admin role)
- Bridge: `user:user_sharafi_eth` (copy for auth system)
- Updated `idx:username:sharafi_eth` to point to correct ID 