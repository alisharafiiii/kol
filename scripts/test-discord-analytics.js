#!/usr/bin/env node

const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')

// Load environment variables
config({ path: '.env.local' })

async function testDiscordAnalytics() {
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

    const projectId = 'project:discord:GEpk5t8yZkQzaWYDHDZHS'
    
    console.log('🔍 Testing Discord Analytics for project:', projectId)
    console.log('📅 Current system date:', new Date().toString())
    console.log()

    // Check messages directly
    const messageSetKey = `discord:messages:project:${projectId}`
    const messageIds = await redis.smembers(messageSetKey)
    console.log(`📬 Found ${messageIds.length} message IDs in the set`)

    if (messageIds.length > 0) {
      // Get first few messages to check their dates
      console.log('\n📝 Sample messages:')
      for (let i = 0; i < Math.min(3, messageIds.length); i++) {
        const message = await redis.json.get(messageIds[i])
        if (message) {
          console.log(`   - ${message.content.substring(0, 30)}...`)
          console.log(`     Timestamp: ${message.timestamp} (${new Date(message.timestamp).toLocaleString()})`)
          console.log(`     Sentiment: ${message.sentiment?.score || 'none'}`)
        }
      }
    }

    // Test the analytics calculation directly
    console.log('\n📊 Testing analytics calculation:')
    
    // Load the module using the correct path
    const path = require('path')
    const projectRoot = path.resolve(__dirname, '..')
    
    // We need to compile TypeScript first or use the built version
    // For now, let's just test the Redis data directly
    
    // Manual date calculation to test
    const now = new Date()
    console.log(`\n📅 Date calculations:`)
    console.log(`   Now: ${now.toISOString()}`)
    
    const daily = new Date(now)
    daily.setDate(daily.getDate() - 1)
    console.log(`   Daily (1 day ago): ${daily.toISOString()}`)
    
    const weekly = new Date(now)
    weekly.setDate(weekly.getDate() - 7)
    console.log(`   Weekly (7 days ago): ${weekly.toISOString()}`)
    
    const monthly = new Date(now)
    monthly.setMonth(monthly.getMonth() - 1)
    console.log(`   Monthly (1 month ago): ${monthly.toISOString()}`)
    
    // Count messages in each timeframe
    console.log('\n📊 Message counts by timeframe:')
    
    let dailyCount = 0
    let weeklyCount = 0
    let monthlyCount = 0
    let allTimeCount = messageIds.length
    
    for (const messageId of messageIds) {
      const message = await redis.json.get(messageId)
      if (message && message.timestamp) {
        const msgDate = new Date(message.timestamp)
        
        if (msgDate >= daily) dailyCount++
        if (msgDate >= weekly) weeklyCount++
        if (msgDate >= monthly) monthlyCount++
      }
    }
    
    console.log(`   Daily: ${dailyCount} messages`)
    console.log(`   Weekly: ${weeklyCount} messages`)
    console.log(`   Monthly: ${monthlyCount} messages`)
    console.log(`   All Time: ${allTimeCount} messages`)

  } catch (error) {
    console.error('Error:', error.message)
  }
}

testDiscordAnalytics() 