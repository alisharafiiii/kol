#!/usr/bin/env node

// Test Upstash Redis connection
require('dotenv').config({ path: '.env.local' })
const Redis = require('ioredis')

console.log('🔍 Testing Upstash Redis connection...\n')

const redisUrl = process.env.REDIS_URL
if (!redisUrl) {
  console.error('❌ REDIS_URL not found in .env.local')
  process.exit(1)
}

console.log('Redis URL (masked):', redisUrl.replace(/:[^:@]+@/, ':****@'))

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000)
    console.log(`Retry attempt ${times}, waiting ${delay}ms...`)
    return delay
  }
})

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message)
})

redis.on('connect', () => {
  console.log('✅ Connected to Redis!')
})

async function test() {
  try {
    // Simple ping test
    const pong = await redis.ping()
    console.log('\n✅ PING response:', pong)
    
    // Set a test value
    await redis.set('test:connection', 'working', 'EX', 10)
    console.log('✅ SET test value')
    
    // Get the test value
    const value = await redis.get('test:connection')
    console.log('✅ GET test value:', value)
    
    // Check for Discord sessions
    console.log('\n🔍 Checking Discord sessions...')
    const keys = await redis.keys('discord:verify:*')
    console.log(`Found ${keys.length} Discord verification sessions`)
    
    if (keys.length > 0) {
      console.log('\nRecent sessions:')
      for (const key of keys.slice(0, 5)) {
        const ttl = await redis.ttl(key)
        console.log(`  ${key} (expires in ${ttl}s)`)
      }
    }
    
    await redis.quit()
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    await redis.quit()
    process.exit(1)
  }
}

// Give it a moment to connect
setTimeout(test, 1000) 