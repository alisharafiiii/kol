# Production Session Cookie Debug Guide

## Issue Description
When logged in as admin (sharafi_eth) and trying to access /admin, the middleware redirects to the signin page, but the signin page correctly detects the user is authenticated - creating a redirect loop.

## Root Cause Analysis
The issue appears to be a mismatch between:
1. How NextAuth sets session cookies in production (HTTPS)
2. How the middleware attempts to read those cookies

## Changes Implemented

### 1. Enhanced Middleware Logging (`middleware.ts`)
Added detailed logging to understand cookie detection:
```typescript
console.log('[Middleware] Cookie configuration:', {
  isProduction,
  isHttps,
  expectedCookieName: cookieName,
  nodeEnv: process.env.NODE_ENV,
  url: request.url
})

console.log('[Middleware] Session cookie check:', {
  hasSessionToken: cookies.includes('next-auth.session-token'),
  hasSecureSessionToken: cookies.includes('__Secure-next-auth.session-token'),
  hasHostPrefixedToken: cookies.includes('__Host-next-auth.session-token')
})
```

### 2. Cookie Configuration Updates (`lib/auth-config.ts`)
Updated to handle secure cookie names properly:
```typescript
cookieName: isHttps && isProduction ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
```

Also changed `sameSite` from "none" to "lax" for better compatibility.

### 3. SignIn Page Improvements (`app/auth/signin/page.tsx`)
- Added redirect loop prevention with `useRef`
- Using `window.location.href` for more reliable redirects
- Enhanced debug logging to show session state

## What to Check in Production Logs

### 1. Middleware Logs
Look for these log entries when accessing /admin:
```
[Middleware] Checking protected path: /admin
[Middleware] Request headers: { cookie: "...", host: "...", referer: "..." }
[Middleware] Cookie configuration: { 
  isProduction: true/false, 
  isHttps: true/false, 
  expectedCookieName: "..." 
}
[Middleware] Session cookie check: {
  hasSessionToken: true/false,
  hasSecureSessionToken: true/false,
  hasHostPrefixedToken: true/false
}
[Middleware] Token check result: { exists: true/false, ... }
```

### 2. SignIn Page Logs
Look for:
```
SignIn Page: Session status on mount: authenticated/unauthenticated/loading
SignIn Page: Document cookies: [array of cookie names]
SignIn Page: Already authenticated, attempting redirect to: /admin
```

## Possible Issues & Solutions

### Issue 1: Cookie Name Mismatch
If logs show:
- `hasSessionToken: false`
- `hasSecureSessionToken: true`

This means NextAuth is using secure cookie names but middleware is looking for the wrong name.

### Issue 2: Cookie Domain/Path Issues
Check if cookies are being set on the correct domain/path. The cookies should be set on the root path "/" with no specific domain.

### Issue 3: SameSite Policy
If the cookie isn't being sent with requests, it might be due to SameSite policy. We've changed it from "none" to "lax" which should work better.

## Temporary Workaround
If the issue persists, users can:
1. Clear all cookies for the domain
2. Sign in again
3. The new cookie configuration should take effect

## Next Steps
1. Deploy these changes
2. Monitor the production logs
3. Check which cookie names are actually being used
4. Adjust the middleware cookie name detection if needed

## Environment Variables to Verify
Ensure these are set correctly in production:
- `NEXTAUTH_URL` - Should be `https://www.nabulines.com`
- `NEXTAUTH_SECRET` - Must be set
- `NODE_ENV` - Should be `production` 