# Scout Page Crash Fix

## Issue
The Scout page was crashing with error: `TypeError: Cannot read properties of undefined (reading 'toUpperCase')`

## Root Cause
The ProjectCard component was trying to call `.toUpperCase()` on `project.priority` which was undefined for some projects. The project data was missing required fields like:
- `priority`
- `stage`
- Potentially `createdBy`, `assignedTo`, and `id`

## Solution
Added defensive programming checks in the ProjectCard component to handle undefined values:

1. **Priority field**: Default to 'low' if undefined
   ```tsx
   {(project.priority || 'low').toUpperCase()}
   ```

2. **Stage field**: Default to 'dmd' if undefined
   ```tsx
   {getStageColor(project.stage || 'dmd')}
   {getStageName(project.stage || 'dmd')}
   ```

3. **CreatedBy field**: Default to 'Unknown' if undefined
   ```tsx
   BY: {(project.createdBy || 'Unknown').substring(0, 8)}...
   ```

4. **AssignedTo field**: Default to 'Unknown' if undefined
   ```tsx
   ASSIGNED TO: {(project.assignedTo || 'Unknown').substring(0, 8)}...
   ```

5. **ID field**: Default to 'unknown' if undefined
   ```tsx
   ID-{(project.id || 'unknown').substring(0, 4)}
   ```

6. **Creator identicon**: Default seed to 'unknown' if createdBy is undefined
   ```tsx
   seed=${project.createdBy || 'unknown'}
   ```

## Files Modified
- `components/ProjectCard.tsx`: Added defensive checks for all potentially undefined fields

## Impact
The Scout page should now render without crashing, even if project data is incomplete. Projects with missing fields will show default values instead of causing runtime errors.

## Next Steps
- Investigate why some projects are missing required fields in the database
- Consider adding validation when creating/updating projects to ensure required fields are always present
- Update the Project type definition to mark optional fields appropriately 