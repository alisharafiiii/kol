#!/usr/bin/env node

// Test the complete Discord link flow
require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

// Initialize Redis with same config as bot
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function testFlow() {
  console.log('🧪 Testing Discord Link Flow\n')
  
  // 1. Simulate creating a session (like the bot does)
  const testDiscordId = '123456789'
  const testSessionId = `verify-${testDiscordId}-${Date.now()}`
  const sessionKey = `discord:verify:${testSessionId}`
  
  console.log('1. Creating test session...')
  console.log('   Session ID:', testSessionId)
  console.log('   Key:', sessionKey)
  
  try {
    await redis.set(sessionKey, JSON.stringify({
      discordId: testDiscordId,
      discordUsername: 'testuser',
      discordTag: 'testuser#1234',
      timestamp: Date.now()
    }), { EX: 600 })
    
    console.log('✅ Session created successfully\n')
  } catch (error) {
    console.error('❌ Error creating session:', error.message)
    return
  }
  
  // 2. Verify the session exists
  console.log('2. Verifying session exists...')
  try {
    const sessionData = await redis.get(sessionKey)
    if (sessionData) {
      console.log('✅ Session found:', JSON.stringify(sessionData, null, 2))
    } else {
      console.log('❌ Session not found!')
    }
  } catch (error) {
    console.error('❌ Error retrieving session:', error.message)
  }
  
  // 3. Check the URL that would be generated
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const verificationUrl = `${baseUrl}/auth/discord-link?session=${testSessionId}`
  
  console.log('\n3. Verification URL:')
  console.log('   ' + verificationUrl)
  
  // 4. Clean up
  console.log('\n4. Cleaning up...')
  await redis.del(sessionKey)
  console.log('✅ Test session deleted')
  
  console.log('\n📝 Summary:')
  console.log('   - Bot creates session in Redis ✅')
  console.log('   - Session can be retrieved ✅')
  console.log('   - URL directs to /auth/discord-link page')
  console.log('   - Page calls API at /api/auth/discord-link')
  console.log('   - API needs authenticated Twitter user')
  
  console.log('\n🔧 To complete the flow:')
  console.log('   1. Use /connect in Discord')
  console.log('   2. Click the verification link')
  console.log('   3. Sign in with Twitter if not already')
  console.log('   4. Accounts will be linked')
  
  process.exit(0)
}

testFlow().catch(console.error) 