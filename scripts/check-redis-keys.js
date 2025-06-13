#!/usr/bin/env node

const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')

// Load environment variables
config({ path: '.env.local' })

async function checkRedisKeys() {
  try {
    // Parse Redis URL to get the required parts
    const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL
    const matches = redisUrl.match(/redis:\/\/default:(.*)@(.*)\.upstash\.io:6379/)
    
    let redis
    if (matches) {
      // Convert redis:// URL to REST API format
      const token = matches[1]
      const host = matches[2]
      redis = new Redis({
        url: `https://${host}.upstash.io`,
        token: token
      })
    } else {
      // Use as-is if already in correct format
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
      })
    }

    console.log('🔍 Checking for legacy Redis keys...\n')

    // Check for old channel scan keys
    const scanKeys = await redis.keys('channels:scan:*')
    console.log(`📡 Channel scan keys: ${scanKeys.length}`)
    for (const key of scanKeys) {
      const value = await redis.get(key)
      console.log(`   ${key} → ${value}`)
    }

    // Check for channel metadata
    console.log('\n📁 Channel metadata:')
    const channelKeys = await redis.keys('channel:discord:*')
    for (const key of channelKeys.slice(0, 5)) {
      const data = await redis.json.get(key)
      console.log(`   ${key}:`)
      console.log(`      name: ${data.name}`)
      console.log(`      projectId: ${data.projectId}`)
    }

    // Check for any keys with just "project"
    console.log('\n⚠️  Checking for problematic keys:')
    const allKeys = await redis.keys('*project*')
    const problemKeys = allKeys.filter(key => key.includes(':project:') && !key.includes(':discord:'))
    if (problemKeys.length > 0) {
      console.log('Found keys with incomplete project IDs:')
      problemKeys.forEach(key => console.log(`   - ${key}`))
    } else {
      console.log('   No problematic keys found')
    }

  } catch (error) {
    console.error('Error:', error.message)
  }
}

checkRedisKeys() 