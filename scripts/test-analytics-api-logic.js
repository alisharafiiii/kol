import { Redis } from '@upstash/redis'
import { config } from 'dotenv'

config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

const PROJECT_ID = 'project:discord:OVPuPOX3_zHBnLUscRbdM' // Ledger

async function getAnalytics(timeframe) {
  const now = new Date()
  let start, end
  
  switch (timeframe) {
    case 'daily':
      // Last 24 hours from now
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      end = now
      break
    case 'weekly':
      start = new Date(now)
      start.setDate(start.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      end = now
      break
    case 'monthly':
      start = new Date(now)
      start.setDate(start.getDate() - 30)
      start.setHours(0, 0, 0, 0)
      end = now
      break
    case 'allTime':
      start = new Date('2020-01-01')
      end = now
      break
  }
  
  console.log(`\n📊 Analytics for ${timeframe}`)
  console.log(`Start: ${start.toISOString()}`)
  console.log(`End: ${end.toISOString()}\n`)
  
  // Get all message IDs
  const messageIds = await redis.smembers(`discord:messages:project:${PROJECT_ID}`)
  console.log(`Total messages in database: ${messageIds.length}`)
  
  // Count messages in timeframe
  let messageCount = 0
  const uniqueUsers = new Set()
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 }
  
  // Process in batches
  const batchSize = 50
  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, i + batchSize)
    
    for (const msgId of batch) {
      const msg = await redis.json.get(msgId)
      if (msg && msg.timestamp) {
        const msgDate = new Date(msg.timestamp)
        
        if (msgDate >= start && msgDate <= end) {
          messageCount++
          uniqueUsers.add(msg.userId)
          
          if (msg.sentiment?.score) {
            sentimentCounts[msg.sentiment.score]++
          }
        }
      }
    }
    
    // Show progress
    if (i % 200 === 0) {
      process.stdout.write(`\rProcessed ${i}/${messageIds.length} messages...`)
    }
  }
  
  console.log(`\rProcessed ${messageIds.length}/${messageIds.length} messages`)
  console.log(`\nMessages in timeframe: ${messageCount}`)
  console.log(`Unique users: ${uniqueUsers.size}`)
  console.log(`Sentiment breakdown:`)
  console.log(`  Positive: ${sentimentCounts.positive}`)
  console.log(`  Neutral: ${sentimentCounts.neutral}`)
  console.log(`  Negative: ${sentimentCounts.negative}`)
  
  // Calculate sentiment score
  const totalSentiment = sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative
  let avgSentiment = 0
  if (totalSentiment > 0) {
    avgSentiment = ((sentimentCounts.positive * 1) + (sentimentCounts.neutral * 0) + (sentimentCounts.negative * -1)) / totalSentiment
  }
  console.log(`Average sentiment: ${avgSentiment.toFixed(2)}`)
}

async function testAllTimeframes() {
  console.log('🔍 Testing Analytics API Logic\n')
  console.log(`Current time: ${new Date().toISOString()}`)
  
  const timeframes = ['daily', 'weekly', 'monthly', 'allTime']
  
  for (const timeframe of timeframes) {
    await getAnalytics(timeframe)
    console.log('\n' + '-'.repeat(60))
  }
}

testAllTimeframes() 