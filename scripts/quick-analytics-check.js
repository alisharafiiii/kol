import { Redis } from '@upstash/redis'
import { config } from 'dotenv'

config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

const PROJECT_ID = 'project:discord:OVPuPOX3_zHBnLUscRbdM' // Ledger

async function quickCheck() {
  console.log('🔍 Quick Analytics Check\n')
  
  try {
    const now = new Date()
    console.log(`Current time: ${now.toISOString()}\n`)
    
    // Get message count
    const messageIds = await redis.smembers(`discord:messages:project:${PROJECT_ID}`)
    console.log(`Total messages: ${messageIds.length}`)
    
    // Check last 10 messages
    console.log('\nLast 10 messages:')
    const recentIds = messageIds.slice(-10)
    
    let todayCount = 0
    let last24hCount = 0
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    for (const msgId of recentIds) {
      const msg = await redis.json.get(msgId)
      if (msg) {
        const msgDate = new Date(msg.timestamp)
        console.log(`  ${msgDate.toISOString()} - ${msg.username}: ${msg.content.substring(0, 30)}...`)
        
        // Count messages from last 24h
        if (msgDate >= yesterday) {
          last24hCount++
        }
        
        // Count messages from today
        if (msgDate.toDateString() === now.toDateString()) {
          todayCount++
        }
      }
    }
    
    console.log(`\nMessages in last 24 hours (from sample): ${last24hCount}`)
    console.log(`Messages today (from sample): ${todayCount}`)
    
  } catch (error) {
    console.error('Error:', error)
  }
}

quickCheck() 