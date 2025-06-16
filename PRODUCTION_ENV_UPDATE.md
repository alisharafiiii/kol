# Production Environment Variables Update

## Critical Environment Variables for Authentication

The following environment variables MUST be set correctly in your production environment:

### 1. NEXTAUTH_URL
```
NEXTAUTH_URL=https://nabulines.com
```
**Important**: This should be your production domain WITHOUT a trailing slash.

### 2. NEXTAUTH_SECRET
```
NEXTAUTH_SECRET=your-secret-key-here
```
**Important**: This should be a secure random string. You can generate one using:
```bash
openssl rand -base64 32
```

### 3. Twitter OAuth Credentials
```
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
TWITTER_BEARER_TOKEN=your-twitter-bearer-token
```

### 4. Redis/Upstash Configuration
```
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

## Deployment Checklist

1. **Update Environment Variables**
   - Go to your hosting provider (Vercel, Netlify, etc.)
   - Update the environment variables listed above
   - Make sure NEXTAUTH_URL matches your production domain

2. **Clear Browser Cache**
   - Clear cookies for your domain
   - Clear local storage
   - Try in an incognito/private window

3. **Redeploy**
   - Trigger a new deployment after updating environment variables
   - Some providers cache environment variables

## Common Issues

### "Access Denied" Error
- Check that NEXTAUTH_URL is set to your production domain
- Ensure you're accessing the site via HTTPS
- Clear all cookies and try logging in again

### Login Loop
- NEXTAUTH_URL mismatch is the most common cause
- Check that your Twitter OAuth app has the correct callback URL:
  ```
  https://nabulines.com/api/auth/callback/twitter
  ```

### Session Not Persisting
- Ensure NEXTAUTH_SECRET is set and consistent across deployments
- Check cookie settings in production (should be secure, sameSite=none for HTTPS)

## Quick Fix for Current Issue

Since you're getting access denied on production, the most likely cause is:

1. **NEXTAUTH_URL is not set correctly** - It should be `https://nabulines.com` (or your actual domain)
2. **You need to log in again** - The session from localhost won't work on production

## Vercel Specific

If using Vercel, update environment variables:
```bash
vercel env add NEXTAUTH_URL production
# Enter: https://nabulines.com

vercel env add NEXTAUTH_SECRET production
# Enter: your-secret-key

# Then redeploy
vercel --prod
```

## Testing Production Auth

1. Open browser developer tools
2. Go to Application/Storage → Cookies
3. Delete all cookies for your domain
4. Navigate to https://nabulines.com
5. Click login and authenticate with Twitter
6. Check the Network tab for any 401/403 errors

The authentication should work after setting the correct NEXTAUTH_URL for production. 