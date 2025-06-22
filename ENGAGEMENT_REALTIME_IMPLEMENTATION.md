# Discord Engagement Dashboard Real-Time Implementation

## Overview
This document outlines the implementation of real-time updates and state persistence for the Discord Engagement Dashboard to address the following issues:
1. Newly submitted tweets not appearing in real-time
2. Unnecessary dashboard refreshes when switching browser tabs

## Implementation Details

### 1. Main Discord Admin Page (`app/admin/discord/page.tsx`)

#### State Management
```typescript
// [ENGAGEMENT STATE PERSISTENCE] - Preserve state when tab loses focus
const [lastEngagementFetch, setLastEngagementFetch] = useState<number>(0)
const [isEngagementStale, setIsEngagementStale] = useState(false)
```

#### Real-Time Updates
- Auto-refresh every 10 seconds when engagement view is active
- Uses `document.visibilityState` to pause updates when tab is not visible
- Marks data as stale when tab loses focus

#### Tab Focus Handler
- Refreshes stale data when tab regains focus
- Only refreshes if data is older than 10 seconds
- Prevents unnecessary API calls

#### API Fetch Optimization
```typescript
fetch('/api/engagement/tweets', { cache: 'no-store' })
```
- Forces fresh data from server
- Bypasses browser cache

### 2. Discord Engagement Dashboard Component (`components/admin/DiscordEngagementDashboard.tsx`)

#### State Persistence
```typescript
// [ENGAGEMENT DASHBOARD STATE PERSISTENCE]
const [lastFetchTime, setLastFetchTime] = useState<number>(0)
const [isStale, setIsStale] = useState(false)
```

#### Features
- Auto-refresh every 15 seconds for recent activity
- Silent refresh option to prevent loading spinner flicker
- Visual indicator showing when data was last updated
- Manual refresh button for immediate updates

#### Visibility Handling
- Pauses updates when tab is not visible
- Resumes updates when tab regains focus
- Prevents unnecessary network requests

### 3. Server Engagement Detail Page (`app/admin/discord/[id]/engagement/page.tsx`)

#### Real-Time Updates
- Auto-refresh every 20 seconds (slightly longer interval for detail pages)
- Same visibility handling as main dashboard
- Shows last update timestamp in header

#### Silent Refresh
```typescript
const fetchData = async (silent = false) => {
  if (!silent) setLoading(true)
  // ... fetch logic
  if (!silent) setLoading(false)
}
```

## Key Features

### 1. Smart Refresh Logic
- Only refreshes when tab is visible
- Tracks last fetch time to prevent redundant calls
- Different refresh intervals for different views

### 2. Visual Feedback
- "Updated X ago" indicators
- Manual refresh buttons
- Loading states preserved during silent updates

### 3. Performance Optimization
- No unnecessary re-renders when switching tabs
- Cache busting for real-time data
- Efficient use of network resources

## Benefits

1. **Real-Time Data**: Users see newly submitted tweets immediately
2. **State Persistence**: No loss of context when switching tabs
3. **Performance**: Reduced unnecessary API calls
4. **User Experience**: Smooth updates without jarring refreshes

## Future Enhancements

1. WebSocket integration for instant updates
2. Configurable refresh intervals
3. Push notifications for new tweets
4. Offline data caching

## Testing Checklist

- [ ] Verify tweets appear within 10-15 seconds of submission
- [ ] Confirm dashboard doesn't refresh when switching tabs
- [ ] Check that data updates when returning to tab after extended absence
- [ ] Ensure loading states work correctly
- [ ] Test manual refresh functionality
- [ ] Verify last update indicators show correct times

## Important Notes

- All changes are clearly marked with comments like `[ENGAGEMENT STATE PERSISTENCE]`
- Analytics functionality remains completely untouched
- Implementation follows existing patterns for consistency 