#!/usr/bin/env node

// Test the specific session mentioned by the user
require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function testSession() {
  const sessionId = 'verify-alinabu-1750444898'
  const sessionKey = `discord:verify:${sessionId}`
  
  console.log('🔍 Checking for session:', sessionId)
  console.log('   Key:', sessionKey)
  
  try {
    const sessionData = await redis.get(sessionKey)
    
    if (sessionData) {
      console.log('✅ Session found:', JSON.stringify(sessionData, null, 2))
      
      // Check TTL
      const ttl = await redis.ttl(sessionKey)
      console.log(`   TTL: ${ttl} seconds (${Math.floor(ttl/60)} minutes)`)
    } else {
      console.log('❌ Session not found - it may have expired')
      console.log('\n📝 Sessions expire after 10 minutes')
      console.log('   Please use /connect command again in Discord')
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
  
  process.exit(0)
}

testSession() 