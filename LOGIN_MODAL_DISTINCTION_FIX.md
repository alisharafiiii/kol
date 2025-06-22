# Login Modal Distinction Fix

## Problem
The recent changes to automatically hide the login modal for admin/core users was too aggressive and prevented the main landing page login modal from showing when explicitly triggered via triple-click.

## Root Cause
The login modal was being automatically hidden for admin/core/approved users without distinguishing between:
1. **Explicit triggers** (user triple-clicks logo or calls window.openLogin)
2. **Automatic displays** (modal appearing due to authentication requirements)

## Solution
Added an `explicitlyTriggered` state flag to track when the modal is opened explicitly vs automatically.

### Code Changes in `components/LoginModal.tsx`:

1. **Added state to track explicit triggers**:
   ```typescript
   const [explicitlyTriggered, setExplicitlyTriggered] = useState(false)
   ```

2. **Set flag when explicitly triggered**:
   - In `handleTripleTap`: Sets `explicitlyTriggered(true)` when triple-clicking
   - In `window.openLogin`: Sets `explicitlyTriggered(true)` when called
   
3. **Modified auto-hide logic**:
   - Only hides modal automatically if `!explicitlyTriggered`
   - Admin/core users can now see the modal when they explicitly trigger it
   
4. **Reset flag on close**:
   - `handleClose` resets `explicitlyTriggered(false)`

## Result
- **Main Landing Page Login Modal**: Works correctly when triple-clicking the logo
  - Shows for all users (including admin/core) when explicitly triggered
  - Has buttons: Enter, Apply/Profile, Scout (for approved users)
  
- **Secondary Login Modal**: Continues to work for authentication
  - Auto-hides for admin/core users to prevent unnecessary prompts
  - Shows for unauthenticated users accessing protected pages

## Verification
Both modals now coexist without conflicts:
- ✅ Triple-click → Modal shows for everyone (including admins)
- ✅ Direct navigation while logged in → No unnecessary modal
- ✅ Protected page access while logged out → Authentication modal shows
- ✅ No regressions in authentication flow 