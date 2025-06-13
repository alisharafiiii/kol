# Share Links Access Control

This document describes the access control logic for share links in the KOL Scout platform.

## Discord Analytics Share Links

**URL Format**: `/discord/share/[projectId]`

### Access Requirements
Users must be signed in with Twitter/X and have one of the following roles:
- `admin` - Full administrative access
- `core` - Core team members  
- `viewer` - Special viewer access

### Mobile Considerations
- Uses `redirect: false` in NextAuth signIn to prevent redirect loops
- Falls back to direct auth URL if OAuth callback fails
- Provides helpful error messages for mobile browser issues (cookies, tracking prevention)

## Campaign Brief Share Links

**URL Format**: `/brief/[campaignId]`

### Access Requirements
Users must be signed in with Twitter/X and meet ONE of the following criteria:

1. **Role-based access** - User has one of these roles:
   - `admin` - Full administrative access
   - `core` - Core team members
   - `viewer` - Special viewer access
   - `kol` - Global KOL access

2. **Campaign-specific access**:
   - User is the campaign creator
   - User is listed as a team member
   - User is added as a KOL in the specific campaign

### Mobile Considerations
- Same mobile-friendly authentication flow as Discord share links
- Handles OAuth callback failures gracefully
- Provides retry options in error states

## Implementation Details

Both share pages follow the same pattern:

1. **Authentication Check**
   - Shows sign-in page if not authenticated
   - Mobile-optimized sign-in flow

2. **Profile Fetch**
   - Gets user profile from `/api/user/profile`
   - Retries on mobile to handle network issues

3. **Access Validation**
   - Checks user role against allowed roles
   - For campaign briefs, also checks campaign-specific access

4. **Error Handling**
   - Clear error messages with role requirements
   - Mobile browser troubleshooting tips
   - Retry options for failed authentication

## Testing Access

To test share links:

1. **Discord Analytics**: Share a link from the Discord admin panel
2. **Campaign Brief**: Click "Share" button on campaign page

The system will validate access based on the user's current role, not their cached JWT role. 