#!/usr/bin/env node

const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')

// Load environment variables
config({ path: '.env.local' })

async function checkMessageDetails() {
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

    console.log('🔍 Examining message details...\n')

    // Get message keys
    const messageKeys = await redis.keys('message:discord:*')
    console.log(`Found ${messageKeys.length} messages\n`)

    // Show first few messages in detail
    console.log('📝 First 3 messages:')
    for (const key of messageKeys.slice(0, 3)) {
      console.log(`\n🔑 Key: ${key}`)
      const message = await redis.json.get(key)
      console.log('   ID:', message.id)
      console.log('   Project ID:', message.projectId)
      console.log('   Channel:', message.channelName)
      console.log('   User:', message.username)
      console.log('   Content:', message.content.substring(0, 50) + '...')
    }

    // Check the project index
    console.log('\n📦 Checking project indexes:')
    const projectIndexKeys = await redis.keys('discord:messages:project:*')
    for (const key of projectIndexKeys) {
      const messageCount = await redis.scard(key)
      console.log(`   ${key} → ${messageCount} messages`)
    }

  } catch (error) {
    console.error('Error:', error.message)
  }
}

checkMessageDetails() 