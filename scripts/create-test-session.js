#!/usr/bin/env node

// Create a test Discord verification session in Redis
require('dotenv').config({ path: '.env.local' })

const { Redis } = require('@upstash/redis')

const sessionId = process.argv[2] || `verify-918575895374082078-${Date.now()}`

async function createTestSession() {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN
  })
  
  console.log('🔧 Creating Test Discord Session\n')
  
  const sessionData = {
    discordId: '918575895374082078',
    discordUsername: 'nabulines',
    discordTag: 'nabulines#1234',
    timestamp: Date.now()
  }
  
  const sessionKey = `discord:verify:${sessionId}`
  
  try {
    // Create session with 10 minute expiry
    await redis.set(sessionKey, JSON.stringify(sessionData), { ex: 600 })
    
    console.log('✅ Session created successfully!')
    console.log('   Key:', sessionKey)
    console.log('   Data:', JSON.stringify(sessionData, null, 2))
    console.log('\n📎 Test URL:')
    console.log(`   http://localhost:3000/auth/discord-link?session=${sessionId}`)
    console.log('\n⏱️  Session expires in 10 minutes')
    
    // Verify it was saved
    const saved = await redis.get(sessionKey)
    if (saved) {
      console.log('\n✅ Verified: Session exists in Redis')
    } else {
      console.log('\n❌ Error: Session not found in Redis after saving')
    }
  } catch (error) {
    console.error('❌ Error creating session:', error)
  }
}

createTestSession() 