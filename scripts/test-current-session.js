#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function testSession() {
  const sessionId = 'verify-918575895374082078-1750447003813'
  const sessionKey = `discord:verify:${sessionId}`
  
  console.log('🔍 Checking session:', sessionId)
  
  try {
    const sessionData = await redis.get(sessionKey)
    
    if (sessionData) {
      console.log('✅ Session found!')
      console.log('Data:', JSON.stringify(sessionData, null, 2))
      
      const ttl = await redis.ttl(sessionKey)
      console.log(`TTL: ${ttl} seconds (${Math.floor(ttl/60)} minutes remaining)`)
      
      console.log('\n📝 Next steps:')
      console.log('1. Make sure you are signed in with Twitter')
      console.log('2. Go to: http://localhost:3000/test-discord-link.html?session=' + sessionId)
      console.log('3. Click "Check Session" to verify Twitter auth')
      console.log('4. Click "Test Link API" to complete the linking')
    } else {
      console.log('❌ Session not found')
    }
  } catch (error) {
    console.error('Error:', error.message)
  }
  
  process.exit(0)
}

testSession() 