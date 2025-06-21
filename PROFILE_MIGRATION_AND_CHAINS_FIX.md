# Profile Migration and Active Chains Fix

## Issues Found and Fixed

### 1. Points System Not Showing
- **Issue**: Points field was not being migrated from old profiles to new profiles
- **Fix**: Updated `profile-migration.ts` to include points field in migration
- **Script**: `scripts/add-points-to-profile.js` - adds points to individual profiles
- **Script**: `scripts/fix-all-profiles.js` - comprehensive fix for all profiles

### 2. Active Chains Changing Randomly
- **Issue**: Admin panel was showing `user.chains` (old format) instead of `user.activeChains` (new format)
- **Root Cause**: The old profile format uses `chains` field, new format should use `activeChains`
- **Fix**: 
  1. Added `activeChains` field to UnifiedProfile type
  2. Updated migration service to copy chains → activeChains
  3. Updated AdminPanel component to use `activeChains || chains` for backward compatibility

### 3. Profile Data Not Fully Migrated
- **Issue**: Many fields from old profiles were not being migrated to new format
- **Fields Added**:
  - activeChains (from chains)
  - points, pointsBreakdown, pointsHistory
  - audienceTypes, contentTypes
  - pricePerPost, priceMonthly
  - bestCollabUrls, experience
  - audienceLocations, targetAudience

## How to Fix Existing Data

1. Run the comprehensive fix script:
   ```bash
   node scripts/fix-all-profiles.js
   ```

2. To fix individual profiles:
   ```bash
   node scripts/add-points-to-profile.js
   ```

## Code Changes Made

### 1. lib/types/profile.ts
- Added `activeChains?: string[]` field to UnifiedProfile interface

### 2. lib/services/profile-migration.ts
- Added mapping: `activeChains: oldProfile.chains || []`
- Added points preservation

### 3. components/AdminPanel.tsx
- Updated chain distribution function to use `activeChains || chains`
- Updated profile modal chains display
- Updated quick stats chains display (needs manual update)

## Remaining Manual Updates Needed

In `components/AdminPanel.tsx`, around line 2821, update:
```tsx
// Old:
{user.chains && user.chains.length > 0 && (
  <div className="flex flex-wrap gap-1 hidden sm:flex">
    {Array.isArray(user.chains) 
      ? user.chains.slice(0, 3).map(chain => (

// New:
{((user.activeChains && user.activeChains.length > 0) || (user.chains && user.chains.length > 0)) && (
  <div className="flex flex-wrap gap-1 hidden sm:flex">
    {(() => {
      const chains = user.activeChains || user.chains || [];
      return Array.isArray(chains) 
        ? chains.slice(0, 3).map(chain => (
```

## Testing

1. Check profile in admin panel - chains should now be stable
2. Check profile page - points should now be visible
3. Refresh multiple times - active chains should not change

## Future Considerations

1. Complete migration from old to new profile format
2. Remove dependency on old profile format
3. Add validation to ensure all required fields are present
4. Consider adding a profile version field for easier migrations
