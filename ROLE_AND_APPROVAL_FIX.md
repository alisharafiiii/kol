# Role and Approval Status Fix Documentation

## Issues Fixed

### 1. Core Role Access Denied
**Root Cause**: While the middleware correctly allows 'core' role for admin paths, some individual API endpoints and components were only checking for 'admin' role, causing inconsistent access control.

**Solution**: 
- Created centralized role constants in `lib/constants/roles.ts`
- Defined clear role hierarchies (ADMIN_ROLES includes both 'admin' and 'core')
- Provided helper functions for consistent role checking across the application

### 2. Profile Approval Status Reverting to Pending
**Root Cause**: In `lib/auth-config.ts` JWT callback, when the profile API failed to fetch user data, it was setting default values for role and approvalStatus regardless of whether the user was new or existing:

```typescript
// OLD CODE - PROBLEMATIC
if (!token.role) {
  token.role = 'scout';
}
if (!token.approvalStatus) {
  token.approvalStatus = 'pending';
}
```

**Solution**: Updated the JWT callback to only set defaults for NEW users:
```typescript
// NEW CODE - FIXED
const isNewUser = !token.sub || trigger === 'signUp';

if (isNewUser) {
  // Only for brand new users, set defaults
  if (!token.role) {
    token.role = 'user';
  }
  if (!token.approvalStatus) {
    token.approvalStatus = 'pending';
  }
} else {
  // For existing users, preserve their current values
  // Don't override with defaults
}
```

## Current State

### Core Role Users (8 total)
All core users have approved status and should have full access to:
- ✅ Admin panel (/admin)
- ✅ User management features
- ✅ Discord analytics
- ✅ Campaign management
- ✅ Profile updates

### Middleware Access
The middleware correctly includes "core" in allowed roles for:
- ✅ /admin paths
- ✅ /api/admin paths
- ✅ Discord share pages

## Files Modified

1. **`lib/constants/roles.ts`** (NEW)
   - Centralized role definitions
   - Role hierarchy constants
   - Helper functions for role checking

2. **`lib/auth-config.ts`**
   - Fixed JWT callback to preserve existing user values
   - Only sets defaults for new users
   - Added points field for new profiles

3. **`app/campaigns/page.tsx`**
   - Fixed admin notice to show for both 'admin' and 'core' roles
   - Changed from `userRole === 'admin'` to `(userRole === 'admin' || userRole === 'core')`

4. **Scripts Created**
   - `scripts/fix-role-and-approval-issues.mjs` - Fix existing users
   - `scripts/check-core-role-access.mjs` - Verify core user access
   - `scripts/verify-fixes.mjs` - Verify all fixes are working

## Testing

To verify the fixes:

1. **Core Role Access**: Users with 'core' role should be able to access:
   - Admin panel at `/admin`
   - All admin API endpoints
   - Discord analytics pages
   - User management features

2. **Profile Status Persistence**: 
   - Approved users should remain approved after login
   - Role should not change during authentication
   - Only Twitter-related data (profile pic, name) should update

## Future Recommendations

1. **Use Centralized Role Constants**: Import from `lib/constants/roles.ts` instead of hardcoding role names
2. **Consistent Role Checking**: Use the helper functions (hasAdminRole, hasTeamRole, etc.) for consistent access control
3. **Avoid Setting Defaults on API Failure**: Never override existing user data when external API calls fail 