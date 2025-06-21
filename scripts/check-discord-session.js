#!/usr/bin/env node

// Check if a Discord verification session exists
require('dotenv').config({ path: '.env.local' })

const { Redis } = require('@upstash/redis')

const sessionId = process.argv[2] || 'verify-918575895374082078-1750444309077'

async function checkSession() {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN
  })
  
  console.log('🔍 Checking Discord Session\n')
  
  const sessionKey = `discord:verify:${sessionId}`
  
  try {
    const sessionData = await redis.get(sessionKey)
    
    if (sessionData) {
      console.log('✅ Session found!')
      console.log('   Key:', sessionKey)
      console.log('   Data:', JSON.stringify(sessionData, null, 2))
      
      // Check TTL
      const ttl = await redis.ttl(sessionKey)
      console.log(`\n⏱️  Expires in: ${ttl} seconds (${Math.floor(ttl/60)} minutes)`)
    } else {
      console.log('❌ Session not found or expired')
      console.log('   Key:', sessionKey)
      console.log('\n💡 Possible reasons:')
      console.log('   - Session expired (10 minute timeout)')
      console.log('   - Session was already used')
      console.log('   - Wrong session ID')
    }
  } catch (error) {
    console.error('❌ Error checking session:', error)
  }
}

checkSession() 