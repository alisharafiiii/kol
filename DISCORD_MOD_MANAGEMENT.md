# Discord Moderator Management Enhancement

## Overview
Enhanced Discord project moderator management with team role filtering, profile pictures, searchable dropdown, shift scheduling, and timezone conversion features.

## Features

### 1. Team Role Filtering
- **Only team members** (Admin, Core, Team, Intern roles) appear in the moderator dropdown
- KOL users are excluded from Discord moderation
- Clear role hierarchy for team management

### 2. Profile Picture Display
- Moderator profile pictures shown in the list
- Fallback to initials if no profile picture available
- Visual identification of team members

### 3. Role Badges
- Color-coded role badges for quick identification:
  - **Admin**: Red badge (highest privilege)
  - **Core**: Purple badge (core team member)
  - **Team**: Green badge (team member)
  - **Intern**: Blue badge (team intern)

### 4. Searchable Moderator Selection
- Real-time search by name or handle
- Dropdown filters as you type
- Auto-selects exact matches

### 5. Shift Scheduling
- Define work hours with start/end times
- Multiple timezone support (EDT, EST, PDT, PST, UTC, CET, CEST)
- Visual timezone conversion display

### 6. Timezone Conversion
- Automatic conversion between timezones
- Shows shift times in:
  - Selected timezone
  - EDT (Eastern Daylight Time)
  - UTC (Universal Time)
  - Moderator's local timezone (if set)

## Data Structure

```json
{
  "handle": "username",
  "name": "Display Name",
  "profileImageUrl": "https://example.com/avatar.jpg",
  "role": "team",
  "timezone": "PST",
  "shift": {
    "startTime": "09:00",
    "endTime": "17:00",
    "timezone": "EDT"
  },
  "twoFactorEnabled": false,
  "lastCheckIn": null
}
```

## UI Components

### Moderator List Display
- Profile picture (40x40px rounded)
- Name and handle
- Role badge with appropriate color
- Shift times with timezone conversions
- Remove button

### Add Moderator Modal
- Search input for filtering team members
- Dropdown showing: Name (@handle) - Role
- Time inputs for shift start/end
- Timezone selector
- Live timezone conversion preview
- Future 2FA integration notice

## API Integration

### GET /api/profiles/approved
Returns all approved users with roles. Frontend filters for team roles only (admin, core, team, intern).

### PUT /api/discord/projects/{id}
Updates project with moderator list stored in `teamMods` array.

## Implementation Details

1. **Role Filtering**: Applied in `fetchApprovedUsers()` to show only team members
2. **Profile Pictures**: Included in moderator data structure with fallback UI
3. **Backward Compatibility**: Supports legacy string format for existing moderators
4. **Timezone Logic**: Simple offset-based conversion (production should use proper timezone library)

## Testing

Run the test script to verify functionality:
```bash
node scripts/test-discord-mod-team-roles.js
```

## Future Enhancements

1. **2FA Check-in System**
   - Moderators verify presence at shift start
   - Automatic alerts for missed check-ins
   - Integration with security protocols

2. **Shift Coverage Dashboard**
   - Visual timeline of moderator coverage
   - Gap detection and alerts
   - Overlap optimization

3. **Performance Metrics**
   - Response time tracking
   - Issue resolution stats
   - Moderator activity reports

## How to Use

### Adding a Moderator

1. Navigate to **Admin Panel** → **Discord Analytics Hub**
2. Click on your Discord server project
3. Click the **Settings** button
4. In the **Team Moderators** section, click **+ Add Moderator**
5. In the modal:
   - Search and select a user from the dropdown
   - Set shift start and end times
   - Choose the timezone for the shift times
   - Review timezone conversions
   - Click **Add Moderator**

### Removing a Moderator

1. In the Team Moderators list, find the moderator
2. Click the **Remove** button next to their name
3. The moderator will be immediately removed from the project

## Timezone Support

### Currently Supported Timezones
- **EDT**: Eastern Daylight Time (UTC-4)
- **EST**: Eastern Standard Time (UTC-5)
- **PDT**: Pacific Daylight Time (UTC-7)
- **PST**: Pacific Standard Time (UTC-8)
- **UTC**: Universal Coordinated Time (UTC+0)
- **CET**: Central European Time (UTC+1)
- **CEST**: Central European Summer Time (UTC+2)

### Conversion Examples
If a shift is set as 9:00 AM - 5:00 PM EDT:
- **UTC**: 1:00 PM - 9:00 PM
- **PST**: 6:00 AM - 2:00 PM
- **CET**: 3:00 PM - 11:00 PM

## Best Practices

1. **Clear Shift Definitions**: Always specify clear start and end times
2. **Timezone Awareness**: Double-check timezone conversions for international teams
3. **Regular Reviews**: Periodically review and update moderator assignments
4. **Documentation**: Keep notes on why specific moderators were assigned
5. **Overlap Planning**: Consider timezone overlaps for 24/7 coverage

## Troubleshooting

### Moderator Not Appearing in Dropdown
- Ensure the user has an approved role (admin, core, team, or kol)
- Check that the user exists in the ProfileService database
- Verify the `/api/profiles/approved` endpoint is accessible

### Timezone Conversion Issues
- Verify the selected timezones are correct
- Check for daylight saving time considerations
- Use the visual conversion display to confirm times

### Save Failures
- Check network connectivity
- Ensure you have admin or core role permissions
- Verify the Discord project exists and is active 