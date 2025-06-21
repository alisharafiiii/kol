#!/usr/bin/env node

// Test script for Discord-Twitter linking
require('dotenv').config({ path: '.env.local' })

const sessionId = process.argv[2] || `verify-test-${Date.now()}`

console.log('🧪 Discord-Twitter Link Test\n')

console.log('1. Simulating Discord session creation...')
const sessionData = {
  discordId: '918575895374082078', // Your Discord ID from the URL
  discordUsername: 'testuser',
  discordTag: 'testuser#1234',
  timestamp: Date.now()
}

console.log('   Session ID:', sessionId)
console.log('   Session data:', JSON.stringify(sessionData, null, 2))

console.log('\n2. Test URLs:')
console.log(`   Local: http://localhost:3000/auth/discord-link?session=${sessionId}`)
console.log(`   Production: https://yourdomain.com/auth/discord-link?session=${sessionId}`)

console.log('\n3. Manual test steps:')
console.log('   a) Make sure the dev server is running (npm run dev)')
console.log('   b) Open the local URL in your browser')
console.log('   c) You should be redirected to Twitter sign-in')
console.log('   d) After signing in, accounts should be linked')

console.log('\n4. Common issues:')
console.log('   - If you get 500 error: Check if session exists in Redis')
console.log('   - If redirect fails: Check NEXTAUTH_URL in .env.local')
console.log('   - If Twitter auth fails: Check TWITTER_CLIENT_ID/SECRET')

console.log('\n5. To create a test session in Redis:')
console.log(`   Run: node scripts/create-test-session.js ${sessionId}`)

console.log('\n6. Current environment:')
console.log(`   NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || 'Not set'}`)
console.log(`   NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL || 'Not set'}`)
console.log(`   Twitter OAuth: ${process.env.TWITTER_CLIENT_ID ? '✅ Configured' : '❌ Missing'}`) 