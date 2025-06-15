# Production Environment Variables Guide

## Required Environment Variables for Authentication

To fix the login loop issue on production, ensure these environment variables are set correctly:

### 1. **NEXTAUTH_URL** (CRITICAL)
```
# For production:
NEXTAUTH_URL=https://www.nabulines.com

# For local development:
NEXTAUTH_URL=http://localhost:3000
```

### 2. **NEXTAUTH_SECRET**
Generate a secure secret:
```bash
openssl rand -base64 32
```

### 3. **Twitter OAuth Credentials**
```
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
```

### 4. **Twitter App Configuration**
In your Twitter Developer Portal, ensure these callback URLs are added:
- `https://www.nabulines.com/api/auth/callback/twitter`
- `http://localhost:3000/api/auth/callback/twitter` (for development)

## Common Issues and Solutions

### Login Loop Issue
If users are redirected back to the login page after authenticating:

1. **Check NEXTAUTH_URL**: Must match your production URL exactly
2. **Check Twitter App Callbacks**: Must include your production callback URL
3. **Check HTTPS**: Production must use HTTPS for secure cookies

### Cookie Issues
If cookies aren't being set properly:

1. **Domain Mismatch**: Ensure no subdomain issues (www vs non-www)
2. **Secure Cookies**: On production, cookies require HTTPS
3. **SameSite Policy**: May need adjustment for cross-domain scenarios

## Debugging Steps

1. **Check Browser Console**: Look for redirect logs and errors
2. **Check Network Tab**: Verify the OAuth callback response
3. **Check Application Tab**: Verify session cookies are being set
4. **Server Logs**: Check for NextAuth debug messages

## Production Checklist

- [ ] NEXTAUTH_URL set to production URL
- [ ] NEXTAUTH_SECRET is secure and consistent
- [ ] Twitter OAuth credentials are correct
- [ ] Twitter app has production callback URL
- [ ] HTTPS is enabled on production
- [ ] Cookies are configured for production domain 