#!/bin/bash

echo "🔍 Testing New Twitter OAuth Configuration"
echo "========================================="
echo ""

# Test direct OAuth URL with new Client ID
CLIENT_ID="UXo4X1ZVakFDTHUyNVNBUXl6Mzc6MTpjaQ"

echo "Testing OAuth flow with new credentials..."
echo ""
echo "For Vercel deployment, open this URL in your browser:"
echo "https://twitter.com/i/oauth2/authorize?response_type=code&client_id=$CLIENT_ID&redirect_uri=https%3A%2F%2Fkol-test-nabus-projects-b8bca9ec.vercel.app%2Fapi%2Fauth%2Fcallback%2Ftwitter&scope=users.read%20tweet.read%20offline.access&state=test&code_challenge=test&code_challenge_method=plain"
echo ""
echo "For local development (port 3002), use:"
echo "https://twitter.com/i/oauth2/authorize?response_type=code&client_id=$CLIENT_ID&redirect_uri=http%3A%2F%2Flocalhost%3A3002%2Fapi%2Fauth%2Fcallback%2Ftwitter&scope=users.read%20tweet.read%20offline.access&state=test&code_challenge=test&code_challenge_method=plain"
echo ""
echo "If these URLs work, your new credentials are valid!"
echo ""
echo "Important Reminders:"
echo "==================="
echo "1. Update .env.local with the new credentials"
echo "2. Update Vercel environment variables"
echo "3. Make sure these callback URLs are in your Twitter app:"
echo "   - https://kol-test-nabus-projects-b8bca9ec.vercel.app/api/auth/callback/twitter"
echo "   - https://kol-test-git-main-nabus-projects-b8bca9ec.vercel.app/api/auth/callback/twitter"
echo "   - http://localhost:3000/api/auth/callback/twitter"
echo "   - http://localhost:3002/api/auth/callback/twitter"
echo ""
echo "4. Ensure OAuth 2.0 is enabled in your Twitter app settings" 