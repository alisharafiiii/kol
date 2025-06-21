import { Redis } from '@upstash/redis'
import { config } from 'dotenv'

config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

const PROJECT_ID = 'project:discord:OVPuPOX3_zHBnLUscRbdM' // Ledger

async function testAnalytics() {
  console.log('📊 Testing Analytics Calculation\n')
  
  try {
    // Get current time
    const now = new Date()
    console.log(`Current time: ${now.toString()}\n`)
    
    // Define time ranges
    const ranges = {
      'Last 24 hours': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      'Last 7 days': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      'Last 30 days': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
    
    // Get all message IDs
    const messageIds = await redis.smembers(`discord:messages:project:${PROJECT_ID}`)
    console.log(`Total messages in database: ${messageIds.length}\n`)
    
    // Count messages for each range
    for (const [rangeName, startDate] of Object.entries(ranges)) {
      let count = 0
      const uniqueUsers = new Set()
      
      // Sample check - get a batch of messages
      const batchSize = 100
      for (let i = 0; i < Math.min(messageIds.length, 500); i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize)
        
        for (const msgId of batch) {
          const msg = await redis.json.get(msgId)
          if (msg && msg.timestamp) {
            const msgDate = new Date(msg.timestamp)
            if (msgDate >= startDate && msgDate <= now) {
              count++
              uniqueUsers.add(msg.userId)
            }
          }
        }
      }
      
      console.log(`${rangeName}: ${count} messages, ${uniqueUsers.size} unique users`)
    }
    
    // Check the most recent messages
    console.log('\n📝 Recent messages:')
    const recentIds = messageIds.slice(-5)
    for (const msgId of recentIds) {
      const msg = await redis.json.get(msgId)
      if (msg) {
        console.log(`  ${new Date(msg.timestamp).toLocaleString()}: ${msg.username} in #${msg.channelName}`)
      }
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

testAnalytics() 