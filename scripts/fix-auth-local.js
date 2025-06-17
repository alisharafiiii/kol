#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔧 NextAuth Local Development Fix\n');
console.log('This script will help you fix X/Twitter login issues in local development.\n');

// Check current port
const checkPort = () => {
  return new Promise((resolve) => {
    rl.question('What port is your Next.js app running on? (default: 3000): ', (port) => {
      resolve(port || '3000');
    });
  });
};

const main = async () => {
  const port = await checkPort();
  const correctUrl = `http://localhost:${port}`;
  
  console.log('\n📋 Required Configuration:\n');
  console.log('1. Update your .env.local file:');
  console.log('   -------------------------------');
  console.log(`   NEXTAUTH_URL=${correctUrl}`);
  console.log('   NEXTAUTH_SECRET=<your-secret>');
  console.log('   TWITTER_CLIENT_ID=<your-client-id>');
  console.log('   TWITTER_CLIENT_SECRET=<your-client-secret>');
  
  console.log('\n2. Update your Twitter App settings:');
  console.log('   -------------------------------');
  console.log('   Go to: https://developer.twitter.com/en/portal/projects');
  console.log('   Select your app → "User authentication settings" → Edit');
  console.log('   ');
  console.log('   OAuth 2.0 Settings:');
  console.log('   - Type of App: Web App');
  console.log(`   - Callback URL: ${correctUrl}/api/auth/callback/twitter`);
  console.log('   - Website URL: ' + correctUrl);
  console.log('   ');
  console.log('   ⚠️  IMPORTANT: The callback URL must match EXACTLY!');
  
  console.log('\n3. Clear browser data:');
  console.log('   -------------------------------');
  console.log('   - Clear cookies for localhost');
  console.log('   - Clear localStorage');
  console.log('   - Try incognito/private mode');
  
  console.log('\n4. Common issues to check:');
  console.log('   -------------------------------');
  console.log('   ❌ Using https:// instead of http:// for localhost');
  console.log('   ❌ Using 127.0.0.1 instead of localhost');
  console.log('   ❌ Port mismatch (e.g., app on 3000 but NEXTAUTH_URL says 3003)');
  console.log('   ❌ Trailing slash in NEXTAUTH_URL');
  console.log('   ❌ Old session cookies from previous attempts');
  
  console.log('\n5. Test the configuration:');
  console.log('   -------------------------------');
  console.log('   1. Restart your Next.js server');
  console.log('   2. Open a new incognito window');
  console.log(`   3. Go to ${correctUrl}`);
  console.log('   4. Try to sign in with X/Twitter');
  
  console.log('\n✨ If you still see "Something went wrong":\n');
  console.log('   - Check browser console for specific errors');
  console.log('   - Check terminal for server-side errors');
  console.log('   - Make sure your Twitter App is not suspended');
  console.log('   - Verify OAuth 2.0 is enabled in Twitter App settings');
  
  rl.close();
};

main().catch(console.error); 