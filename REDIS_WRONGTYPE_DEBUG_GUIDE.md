# Redis WRONGTYPE Error Debug Guide

## Overview
This guide helps resolve Redis WRONGTYPE errors in the notification system. These errors occur when Redis operations expect one data type but find another.

## What Was Implemented

### 1. Enhanced Debugging in NotificationService
Added detailed logging to all Redis operations in `lib/notification-service.ts`:
- Logs the exact Redis key being accessed
- Shows the operation being attempted (LPUSH, LRANGE, LLEN, etc.)
- Captures and logs WRONGTYPE errors with key names and expected vs actual types

### 2. Diagnostic Utility Script
**Usage:** `npm run check:notification-keys`

This script:
- Checks all predefined notification keys (`notifications:queue`, `notifications:sent`, `notifications:failed`)
- Shows each key's existence status and Redis type
- For lists, shows the number of items and a sample
- Searches for any other notification-related keys
- Highlights keys with wrong types with ⚠️ warnings

### 3. Fix Utility Script
**Usage:** `npm run fix:notification-keys`

This script:
- Identifies notification keys with wrong Redis types
- Backs up existing data before making changes
- Deletes wrong-typed keys and prepares them for use as lists
- Shows backup key names for data recovery if needed

## Debugging Process

### Step 1: Check Current State
```bash
npm run check:notification-keys
```

Look for any keys marked with ⚠️ warnings.

### Step 2: Monitor Server Logs
When the WRONGTYPE error occurs, look for these log patterns:
```
[NotificationService] Redis WRONGTYPE error on key: <key-name>
[NotificationService] Expected: list, but key holds different type
[NotificationService] Actual Redis type for <key-name>: <actual-type>
```

### Step 3: Fix Wrong-Typed Keys
If any notification keys have the wrong type:
```bash
npm run fix:notification-keys
```

This will:
1. Show problematic keys
2. Ask for confirmation
3. Backup existing data
4. Fix the key types

## Common WRONGTYPE Scenarios

### Scenario 1: Key is a String instead of List
**Symptom:** Error when using LPUSH, LRANGE, or LLEN
**Cause:** Key was set using SET command instead of list operations
**Fix:** Use the fix script to convert to list

### Scenario 2: Key is a Hash instead of List
**Symptom:** Error when using list operations
**Cause:** Key was created with HSET operations
**Fix:** Use the fix script, data will be backed up

### Scenario 3: Key is a Set instead of List
**Symptom:** Error when using list operations
**Cause:** Key was created with SADD operations
**Fix:** Use the fix script, members will be backed up

## Current Status

As of the last check:
- ✅ `notifications:queue` - Correct type (list) with 10 items
- ✅ `notifications:sent` - Correct type (list) with 5 items
- ✅ `notifications:failed` - Does not exist (will be created as list when needed)

## Prevention

1. **Always use correct Redis operations:**
   - For notification queues: `LPUSH`, `RPUSH`, `LRANGE`, `LLEN`, `LREM`
   - Never use: `SET`, `HSET`, `SADD` on notification keys

2. **Check key type before operations:**
   ```javascript
   const type = await redis.type(key)
   if (type !== 'list' && type !== 'none') {
     console.error(`Wrong type for ${key}: ${type}`)
   }
   ```

3. **Use the enhanced NotificationService** which includes error handling and logging

## Manual Redis Commands

If you need to manually inspect or fix keys:

```javascript
// Check type
await redis.type('notifications:queue')

// Delete a key
await redis.del('notifications:queue')

// View list contents
await redis.lrange('notifications:queue', 0, -1)

// Get list length
await redis.llen('notifications:queue')
```

## If Error Persists

If the WRONGTYPE error continues after fixing notification keys:
1. Check server logs for the exact key name causing the error
2. The error might be from a different part of the system
3. Use `redis.keys('*')` to list all keys and check their types
4. Look for any custom notification-related keys your app might be using 