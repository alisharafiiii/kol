console.log(`
=== Discord Share Authentication Debugging Guide ===

If you're seeing flickering or access denied issues, follow these steps:

1. Clear your browser cache and cookies:
   - Chrome: Settings > Privacy > Clear browsing data
   - Safari: Develop > Empty Caches
   - Firefox: Settings > Privacy > Clear Data

2. Open the browser console (F12) and check for these logs:
   - "Discord Share: Session status:"
   - "Discord Share: User authenticated, checking access..."
   - "Discord Share: User profile:"
   - "Discord Share: Access granted" or "Access denied"

3. Test the authentication flow:
   a. Go to: http://localhost:3000/api/auth/signout
   b. Then go to: http://localhost:3000/api/auth/signin
   c. Sign in with your Twitter/X account
   d. Try the Discord share link again

4. Check your session manually:
   - Open: http://localhost:3000/api/debug/session
   - Look for:
     * "authenticated": true
     * "twitterHandle": "your_handle"
     * "role": "admin"

5. Common issues and solutions:
   
   Issue: Login module flickers
   Solution: Clear cookies and try a different browser
   
   Issue: Access denied even with admin account
   Solution: 
   - Make sure you're signed in as the correct account
   - Check that your handle is exactly "sharafi_eth" (no @ symbol)
   - Try signing out and signing in again
   
   Issue: Session not persisting
   Solution:
   - Check if cookies are enabled
   - Try disabling browser extensions
   - Use an incognito/private window

6. Test URLs:
   - Profile API: http://localhost:3000/api/user/profile?handle=sharafi_eth
   - Debug session: http://localhost:3000/api/debug/session
   - Sign out: http://localhost:3000/api/auth/signout
   - Sign in: http://localhost:3000/api/auth/signin

7. If still having issues:
   - Check the server logs for errors
   - Verify Redis is running: redis-cli ping
   - Restart the development server
`); 