# Admin Status Update Fix

## Issue
When trying to change a user's role or approval status in the admin panel, you were getting "User not found" errors. This was happening because:

1. The `/api/admin/update-status` endpoint was only checking the old Redis system
2. Many users now exist in the new ProfileService system
3. The endpoint wasn't checking ProfileService at all

## Solution
Updated the `/api/admin/update-status` endpoint to:

1. **Check ProfileService first** - Tries to find the user by:
   - Twitter handle (if userId is in format "user_username", extracts the username)
   - Profile ID (if not found by handle)

2. **Fall back to Redis** - If not found in ProfileService, checks the old Redis system

3. **Better error handling** - Returns "User not found in any system" if not found in either

## Code Changes

### `/api/admin/update-status/route.ts`
- Added imports for `ProfileService` and admin utilities
- Added ProfileService lookup before Redis lookup
- Handles both handle-based and ID-based lookups
- Logs which system was used for the update

## How It Works Now

1. When you click to change approval status in the admin panel:
   - First checks ProfileService by handle
   - If not found, checks ProfileService by ID
   - If still not found, checks old Redis system
   - Updates in whichever system the user is found

2. The response includes which system was used:
   ```json
   {
     "success": true,
     "userId": "user_username",
     "status": "approved",
     "updatedBy": "admin_user",
     "system": "ProfileService" // or "Redis"
   }
   ```

## Testing
To test the fix:
1. Go to the admin panel
2. Find a user and try changing their approval status
3. It should now work for users in both ProfileService and Redis

## Note
The `/api/admin/update-role` endpoint already had this dual-system support, which is why role changes were working but status changes were not.
