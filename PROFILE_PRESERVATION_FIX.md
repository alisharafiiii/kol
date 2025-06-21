# Profile Preservation Fix

## Issue
When users with existing approved profiles logged in with Twitter/X, their profile role and approval status were being reset to default values ('user' role and 'pending' status).

## Root Causes

1. **Profile API Fallback Values**: The `/api/user/profile` endpoint was returning fallback values when fields were undefined:
   ```typescript
   approvalStatus: unifiedProfile.approvalStatus || 'pending',
   role: unifiedProfile.role || 'user',
   ```

2. **JWT Callback Overwriting**: The JWT callback in auth-config.ts was always setting role and approvalStatus from the API response, even when undefined:
   ```typescript
   token.role = profileData.user.role || 'user';
   token.approvalStatus = profileData.user.approvalStatus || 'pending';
   ```

3. **SignIn Callback**: While the signIn callback had comments about preserving fields, it was directly modifying the existing profile object.

## Fixes Applied

### 1. Profile API (`app/api/user/profile/route.ts`)
- Removed fallback values for `approvalStatus` and `role`
- Now returns actual values (which may be undefined) instead of defaulting to 'pending' and 'user'

### 2. JWT Callback (`lib/auth-config.ts`)
- Updated to only set token values when explicitly provided:
  ```typescript
  if (profileData.user.role !== undefined && profileData.user.role !== null) {
    token.role = profileData.user.role;
  }
  if (profileData.user.approvalStatus !== undefined && profileData.user.approvalStatus !== null) {
    token.approvalStatus = profileData.user.approvalStatus;
  }
  ```

### 3. SignIn Callback (`lib/auth-config.ts`)
- Created a new profile object instead of modifying the existing one
- Explicitly preserves all admin-controlled fields:
  - `role`
  - `approvalStatus`
  - `isKOL`
  - `tier`
  - `currentTier`
- Only updates Twitter-related fields:
  - `profileImageUrl`
  - `name`
  - `lastLoginAt`
  - `socialLinks.twitter`
  - `followerCount` (if available)

## Result
Users with existing profiles will now maintain their role and approval status when logging in with Twitter/X. Only their Twitter-related data (profile picture, name, follower count) will be updated.
