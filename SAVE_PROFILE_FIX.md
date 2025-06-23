# Save Profile Endpoint Fix

## Issue
New users signing up were getting "failed to save your profile" error when submitting their profile information.

## Root Cause
The `/api/save-profile` endpoint was moved to `pages.backup/api/save-profile.ts` during the migration from pages to app directory, but was never recreated in the new structure.

## Solution
Created `app/api/save-profile/route.ts` with the exact same functionality as the old endpoint.

## Technical Details
- **Location**: `app/api/save-profile/route.ts`
- **Method**: POST
- **Function**: Uses `saveProfileWithDuplicateCheck` from `@/lib/redis`
- **No changes to**:
  - Authentication flow
  - Access control
  - Profile data structure
  - Response format

## Testing
New users should now be able to complete the signup flow without errors. 