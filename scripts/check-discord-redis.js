#!/usr/bin/env node

// Check Discord verification sessions in Redis
require('dotenv').config({ path: '.env.local' })
const Redis = require('ioredis')

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

async function checkSessions() {
  console.log('🔍 Checking Discord verification sessions in Redis\n')
  
  try {
    // Check all discord:verify:* keys
    const keys = await redis.keys('discord:verify:*')
    console.log(`Found ${keys.length} verification sessions:\n`)
    
    for (const key of keys) {
      const data = await redis.get(key)
      const ttl = await redis.ttl(key)
      
      console.log(`📌 ${key}`)
      console.log(`   Data: ${data}`)
      console.log(`   TTL: ${ttl} seconds`)
      console.log('')
    }
    
    // Check specific session from your test
    const testSession = 'verify-alinabu-1750444898'
    console.log(`\n🔍 Checking specific session: ${testSession}`)
    const testKey = `discord:verify:${testSession}`
    const testData = await redis.get(testKey)
    
    if (testData) {
      console.log('✅ Found session data:', testData)
    } else {
      console.log('❌ Session not found')
      
      // Check if it might be under a different key format
      console.log('\n🔍 Checking alternative key formats:')
      const altKeys = [
        `discord:session:${testSession}`,
        `discord:${testSession}`,
        testSession
      ]
      
      for (const altKey of altKeys) {
        const altData = await redis.get(altKey)
        if (altData) {
          console.log(`✅ Found under ${altKey}:`, altData)
        }
      }
    }
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

checkSessions() 