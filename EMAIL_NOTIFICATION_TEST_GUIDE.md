# Email Notification Test Guide for Profile Notes

## Overview
This guide explains how to test email notifications that are sent when admin/core users add notes to KOL profiles within campaigns.

## Current Implementation Status ✅

### What's Implemented:
1. **Email notifications trigger** when notes are added to KOL profiles
2. **Recipients**: All admin/core team members of the campaign
3. **Email content includes**:
   - Campaign name
   - KOL name and handle
   - Note author name, handle, timestamp, and profile picture
   - The new note content
   - Complete note history for that KOL in the campaign
   - Link to view the campaign
4. **Actual email sending** with nodemailer (not just simulation)
5. **Comprehensive logging** throughout the entire flow
6. **Debug endpoints** to check and process notifications

### Email Configuration:
- **SMTP Server**: mail.privateemail.com:587
- **From Address**: notifications@nabulines.com
- **Status**: ✅ Configured and ready
- **Implementation**: Using nodemailer for actual email delivery

## Pre-Test Setup

### 1. Check Current Configuration
```bash
npm run debug:email-test
```

This will show:
- SMTP configuration status
- Notification queue status
- Admin/core users with email addresses

### 2. Add Email Addresses to Admin/Core Users
If admin/core users don't have email addresses:

```bash
npm run add:test-emails
```

Options:
- **Option 1**: Add test emails to all users (e.g., username@test.com)
- **Option 2**: Add specific real email to specific user

## Test Steps

### Step 1: Start the Development Server
```bash
npm run dev
```

### Step 2: Monitor Server Logs
Open a new terminal and watch the logs:
```bash
# On macOS/Linux
tail -f .next/server/app*.log | grep "📧"

# Or just watch the main terminal for console output
```

### Step 3: Perform the Test

1. **Log in** as an admin or core role user
2. **Navigate** to any campaign (e.g., /campaigns/your-campaign-slug)
3. **Click** on any KOL profile card to open the profile modal
4. **Add a note**:
   - Type: "Cursor email notification test - [current time]"
   - Click "Add Note"

### Step 4: Check Results

#### A. Server Logs (Immediate)
Look for these log messages:
```
📧 Total notes for this KOL in campaign: [number]
📧 Campaign details: { campaignName: '...', createdBy: '...', teamMembers: [...] }
📧 Checking team members for email notifications: [...]
📧 Checking member [handle]: { hasProfile: true, role: 'admin', hasEmail: true }
📧 Collected notification emails: ['email1@domain.com', 'email2@domain.com']
📧 Sending email notifications to: [...]
📧 Email notifications queued: { success: true, notificationIds: [...] }
```

#### B. Email Simulation (If SMTP not fully configured)
If using email simulation, you'll see:
```
📧 [EMAIL SIMULATION] - No SMTP credentials configured
📧 =================== EMAIL CONTENT ===================
📧 TO: recipient@email.com
📧 SUBJECT: New note added for [KOL Name] in [Campaign Name]
📧 TYPE: note_added
📧 PRIORITY: high
📧 FORMAT: HTML
📧 [HTML Content - Preview not shown in console]
📧 METADATA: {
  "campaignId": "...",
  "campaignName": "...",
  "kolName": "...",
  "noteAuthor": "...",
  "noteContent": "...",
  "totalNotes": 2
}
📧 =====================================================
```

#### C. Actual Email (If SMTP configured)
Check the inbox of admin/core users for:
- **From**: notifications@nabulines.com
- **Subject**: "New note added for [KOL Name] in [Campaign Name]"
- **Content**: HTML email with:
  - Campaign info box (green themed)
  - Author info with profile picture
  - Latest note content
  - Complete note history (if any previous notes exist)
  - "View Campaign" button

## Expected Email Content

The email should contain:

1. **Header**: "New Note Added" in green
2. **Campaign Info Box**:
   - Campaign name
   - KOL name and handle
   - Note author and timestamp
   - Author's profile picture (48x48 round)
3. **Latest Note Box**:
   - The note text you just added
4. **Note History Box** (if applicable):
   - All previous notes for this KOL in this campaign
   - Each with author name, image, timestamp
5. **View Campaign Button**: Links to the campaign page

## Troubleshooting

### No Emails Received?

1. **Run the comprehensive email flow test**:
   ```bash
   npm run test:email-flow
   ```
   This will:
   - Check all environment variables
   - Test SMTP connection
   - Send a test email to ali.sharafi85@gmail.com
   - Show Redis queue status
   - Display any pending notifications

2. **Check if users have emails**:
   ```bash
   npm run debug:email-test
   ```
   Look for "No admin/core users have email addresses configured"

3. **Add test emails**:
   ```bash
   npm run add:test-emails
   ```

4. **Check notification queue**:
   ```bash
   npm run check:notification-keys
   ```
   Verify all keys are of type "list"

5. **Manually process pending notifications**:
   ```bash
   # While logged in as admin in browser, get your cookie and run:
   curl -X POST http://localhost:3000/api/notifications/process \
     -H "Cookie: <your-auth-cookie-here>"
   ```

6. **Check queue status without processing**:
   ```bash
   curl http://localhost:3000/api/notifications/process \
     -H "Cookie: <your-auth-cookie-here>"
   ```

### Email Not Formatting Correctly?

- Check server logs for the HTML content length
- The email uses inline CSS for compatibility
- Green/black theme matches the platform design

### Testing Different Scenarios

1. **First Note**: Add a note to a KOL with no previous notes
2. **Multiple Notes**: Add several notes to see history building
3. **Different Authors**: Have multiple admin/core users add notes
4. **Long Notes**: Test with longer note content
5. **Special Characters**: Test with emojis, quotes, line breaks

## Debug Commands Summary

```bash
# Check email configuration and queue
npm run debug:email-test

# Add test emails to admin/core users
npm run add:test-emails

# Check campaign data (including team members)
npm run debug:campaign-data [campaign-id]

# Process any pending notifications manually
curl -X POST http://localhost:3000/api/notifications/process
```

## Success Criteria ✅

The test is successful when:
1. All admin/core team members receive the email
2. Email arrives from notifications@nabulines.com
3. Email content includes all required elements
4. Note history is complete and accurate
5. Profile pictures display correctly
6. View Campaign link works

## Notes

- Emails are sent with HIGH priority for immediate delivery
- If SMTP is not configured, emails are simulated in console
- The system checks both new ProfileService and legacy InfluencerProfile systems for user data
- Email extraction tries multiple fields (email, contacts.email, shippingInfo, bio, etc.) 