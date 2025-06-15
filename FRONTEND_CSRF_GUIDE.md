# Frontend CSRF Implementation Guide

## Current Status

The bot reboot endpoint has CSRF protection implemented but temporarily disabled. To re-enable it, you need to update the frontend to send CSRF tokens.

## Quick Fix - Update Discord Admin Page

Replace the current fetch calls with the CSRF-aware version:

### 1. Import the CSRF hook at the top of `app/admin/discord/page.tsx`:

```typescript
'use client'

import { useCSRF } from '@/hooks/useCSRF'
// ... other imports
```

### 2. Use the hook in your component:

```typescript
export default function DiscordAdminPage() {
  const { secureFetch } = useCSRF()
  // ... rest of your component
```

### 3. Replace the fetch call in `rebootBot`:

```typescript
const rebootBot = async () => {
  if (!confirm('Are you sure you want to reboot the Discord bot?')) {
    return
  }
  
  setRebooting(true)
  try {
    // Use secureFetch instead of fetch
    const res = await secureFetch('/api/discord/bot-reboot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    const data = await res.json()
    
    if (res.ok) {
      alert(data.message || 'Bot restarted successfully!')
      setTimeout(fetchBotStatus, 5000)
    } else {
      alert(data.error || 'Failed to reboot bot')
    }
  } catch (error) {
    console.error('Bot reboot error:', error)
    alert('Failed to reboot bot')
  } finally {
    setRebooting(false)
  }
}
```

## Alternative - Use the standalone CSRF fetch

If you don't want to use the hook:

```typescript
import { csrfFetch } from '@/hooks/useCSRF'

// In your function:
const res = await csrfFetch('/api/discord/bot-reboot', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
})
```

## Re-enabling CSRF Protection

Once the frontend is updated, re-enable CSRF protection in `app/api/discord/bot-reboot/route.ts`:

```typescript
// Change this:
if (!csrfCheck.protected) {
  console.log(`⚠️ Bot reboot CSRF check failed for ${twitterHandle}: ${csrfCheck.error}`)
  console.log(`⚠️ CSRF protection temporarily disabled - proceeding anyway`)
  // TODO: Re-enable CSRF protection once frontend is updated
  // return NextResponse.json({ error: csrfCheck.error || 'CSRF protection failed' }, { status: 403 })
}

// To this:
if (!csrfCheck.protected) {
  console.log(`Bot reboot CSRF check failed for ${twitterHandle}: ${csrfCheck.error}`)
  return NextResponse.json({ error: csrfCheck.error || 'CSRF protection failed' }, { status: 403 })
}
```

## Testing

1. Update the frontend code
2. Clear your browser's session storage
3. Reload the page (this will fetch a new CSRF token)
4. Try rebooting the bot
5. Check the browser console for any errors
6. Check the server logs for CSRF-related messages

## Troubleshooting

If you get CSRF errors:

1. **Check session storage**: Open browser dev tools and check if `csrf-token` exists in session storage
2. **Check network requests**: Look for the `X-CSRF-Token` header in the request
3. **Check server logs**: The server will log detailed CSRF check information
4. **Force token refresh**: Clear session storage and reload the page

## Security Note

CSRF protection is temporarily disabled for the bot reboot endpoint. This is a security risk and should only be temporary. Please implement the frontend changes as soon as possible. 