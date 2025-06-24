# Email Notification Debugging Summary

## Problem
SMTP test via command line (nodemailer) successfully sent emails ✅, but notification emails were not being sent when adding notes in the app ❌.

## What Was Fixed

### 1. **Enhanced Logging Throughout the Flow**

#### In `app/api/campaigns/[id]/kols/[kolId]/notes/route.ts`:
- Added `[START]`, `[SENDING]`, `[QUEUED]`, `[PROCESSING]`, `[COMPLETE]`, and `[ERROR]` log stages
- Environment variable checks logged at runtime
- Team member email extraction logging
- Detailed error stack traces

#### In `lib/notification-service.ts`:
- Added logging to `queue()`, `processPending()`, `processNotification()`, and `sendEmail()`
- Logs show exact Redis keys, operations, and data
- WRONGTYPE error handling with detailed diagnostics

### 2. **Implemented Actual Email Sending**
- Added `nodemailer` to dependencies
- Updated `sendEmail()` method to use nodemailer transporter
- SMTP connection verification before sending
- Detailed logging of SMTP operations

### 3. **Created Debug Tools**

#### `npm run test:email-flow` - Comprehensive email flow test:
- Checks all SMTP environment variables
- Tests SMTP connection with nodemailer
- Sends actual test email to ali.sharafi85@gmail.com
- Shows Redis queue status
- Displays pending notification samples

#### Enhanced `/api/notifications/process` endpoint:
- GET: Check queue status and environment without processing
- POST: Process pending notifications with detailed logging
- Shows before/after queue counts
- Returns environment variable status

### 4. **Key Findings & Solutions**

The issue was likely that:
1. ✅ SMTP was configured correctly
2. ✅ Redis queues were working
3. ❌ Actual email sending was commented out (only simulation)
4. ❌ No automatic worker to process queued notifications

Now fixed:
1. ✅ Nodemailer properly sends emails
2. ✅ `processPending()` is called after queueing
3. ✅ Comprehensive logging shows exactly where issues occur

## How to Debug Email Issues

### 1. Test the full flow:
```bash
npm run test:email-flow
```

### 2. Add emails to admin/core users:
```bash
npm run add:test-emails
```

### 3. Monitor server logs:
```bash
npm run dev
# Watch for 📧 emoji messages
```

### 4. Check notification queues:
```bash
npm run check:notification-keys
```

### 5. Manually process notifications:
```bash
# Get auth cookie from browser DevTools
curl -X POST http://localhost:3000/api/notifications/process \
  -H "Cookie: next-auth.session-token=..."
```

### 6. Check queue status:
```bash
curl http://localhost:3000/api/notifications/process \
  -H "Cookie: next-auth.session-token=..."
```

## What to Look For in Logs

### Successful Flow:
```
📧 [START] Email notification process for note
📧 Total email recipients found: 2
📧 [SENDING] Starting email notification process...
📧 Environment check:
📧   SMTP_HOST: ✅ SET
📧   SMTP_PORT: ✅ SET
📧   SMTP_USER: ✅ SET
📧   SMTP_PASS: ✅ SET
📧   SMTP_FROM: ✅ SET
📧 [QUEUED] Notifications queued successfully: ['notif_...']
📧 [PROCESSING] Calling NotificationService.processPending()...
📧 [processNotification] Processing notification: notif_...
📧 [sendEmail] Starting email send process
📧 [SMTP] Creating nodemailer transporter...
📧 [SMTP] Transporter verified successfully
📧 [SMTP] Email sent successfully!
📧 [COMPLETE] Email notification process finished
```

### Common Issues:

1. **No recipients found**:
   - Admin/core users don't have email addresses
   - Run `npm run add:test-emails`

2. **SMTP connection failed**:
   - Check environment variables
   - Verify SMTP credentials

3. **Notifications queued but not sent**:
   - Check if `processPending()` is being called
   - Manually process via API endpoint

4. **Redis WRONGTYPE errors**:
   - Run `npm run check:notification-keys`
   - Run `npm run fix:notification-keys` if needed

## Environment Variables Required

```env
SMTP_HOST=mail.privateemail.com
SMTP_PORT=587
SMTP_USER=notifications@nabulines.com
SMTP_PASS=your-password-here
SMTP_FROM=notifications@nabulines.com
```

## Testing Checklist

- [ ] Environment variables are set
- [ ] SMTP credentials are valid
- [ ] Admin/core users have email addresses
- [ ] Redis notification keys are correct type (list)
- [ ] Server logs show full flow completion
- [ ] Test email received when using `npm run test:email-flow`
- [ ] Actual notification emails received when adding notes 