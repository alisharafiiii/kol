# Campaign Duplicate Bug Fix

## Issue
When creating a new campaign, it would appear duplicated in the UI even though only one instance existed in the database.

## Root Cause
The issue was caused by a race condition and improper state management:

1. **Race Condition**: Two `useEffect` hooks were fetching campaigns simultaneously:
   - First effect: Initial load that checks access and fetches campaigns
   - Second effect: Runs when `activeTab` changes and also fetches campaigns

2. **State Management Bug**: When creating a new campaign, the code was appending it to the existing state:
   ```javascript
   setCampaigns([...campaigns, newCampaign])
   ```
   This could cause duplicates if the campaign was already fetched by one of the effects.

## Solution

### 1. Fixed Campaign Creation
Instead of appending to state, now we refresh the entire campaign list from the server after creation:
```javascript
// Old approach (buggy)
setCampaigns([...campaigns, newCampaign])

// New approach (fixed)
const refreshRes = await fetch(activeTab === 'my' ? '/api/campaigns?user=true' : '/api/campaigns')
if (refreshRes.ok) {
  const data = await refreshRes.json()
  setCampaigns(Array.isArray(data) ? data : [])
}
```

### 2. Prevented Duplicate Fetches
Added an `isInitialLoad` flag to prevent the tab change effect from running during initial page load:
- The flag starts as `true`
- Set to `false` after initial campaigns are loaded
- The tab change effect skips if `isInitialLoad` is true

## Files Modified
- `app/campaigns/page.tsx`: 
  - Updated `handleCreateCampaign` to refresh from server
  - Added `isInitialLoad` state flag
  - Modified effects to prevent duplicate fetches

## Result
- No more duplicate campaigns in the UI
- Campaign creation properly syncs with server state
- Eliminated race conditions between multiple fetch operations 