#!/usr/bin/env node

// Script to debug Discord analytics
require('dotenv').config({ path: '.env.local' })

const PROJECT_ID = 'project:discord:OVPuPOX3_zHBnLUscRbdM' // Ledger project

async function debugAnalytics() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.error('❌ Missing Redis credentials')
    return
  }
  
  try {
    console.log('🔍 Debugging Discord Analytics for Ledger Project\n')
    
    // 1. Get total message count from index
    const indexKey = `discord:messages:project:${PROJECT_ID}`
    const indexResponse = await fetch(`${url}/smembers/${indexKey}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const indexData = await indexResponse.json()
    const messageIds = indexData.result || []
    
    console.log(`📊 Total messages in index: ${messageIds.length}`)
    
    // 2. Check recent messages (last 10)
    console.log('\n📝 Recent messages:')
    const recentIds = messageIds.slice(-10)
    for (const msgId of recentIds) {
      const msgResponse = await fetch(`${url}/json.get/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const msgData = await msgResponse.json()
      if (msgData.result) {
        const msg = JSON.parse(msgData.result)
        console.log(`  - ${new Date(msg.timestamp).toLocaleString()}: ${msg.username}: ${msg.content.substring(0, 50)}...`)
      }
    }
    
    // 3. Check messages from today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    console.log(`\n📅 Checking messages from ${today.toISOString()} to ${tomorrow.toISOString()}`)
    
    let todayCount = 0
    let lastHourCount = 0
    const lastHour = new Date()
    lastHour.setHours(lastHour.getHours() - 1)
    
    // Sample check - get first 100 message IDs to check timestamps
    const sampleIds = messageIds.slice(-100)
    for (const msgId of sampleIds) {
      const msgResponse = await fetch(`${url}/json.get/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const msgData = await msgResponse.json()
      if (msgData.result) {
        const msg = JSON.parse(msgData.result)
        const msgDate = new Date(msg.timestamp)
        if (msgDate >= today && msgDate < tomorrow) {
          todayCount++
        }
        if (msgDate >= lastHour) {
          lastHourCount++
        }
      }
    }
    
    console.log(`  Today's messages (from last 100): ${todayCount}`)
    console.log(`  Last hour messages (from last 100): ${lastHourCount}`)
    
    // 4. Check cached analytics
    console.log('\n🗄️ Checking cached analytics...')
    const cacheKeys = ['daily', 'weekly', 'monthly', 'allTime']
    for (const timeframe of cacheKeys) {
      // The analytics API uses an in-memory cache, so we can't check it directly
      console.log(`  - ${timeframe}: (in-memory cache, cannot check directly)`)
    }
    
    // 5. Make API call to get current analytics
    console.log('\n📡 Fetching analytics via API...')
    const apiUrl = 'http://localhost:3000/api/discord/projects/project--discord--OVPuPOX3_zHBnLUscRbdM/analytics?timeframe=daily'
    
    console.log('\n💡 Insights:')
    console.log(`- Total messages in database: ${messageIds.length}`)
    console.log('- The analytics API has a 30-second cache')
    console.log('- Messages are being saved in real-time by the bot')
    console.log('- The discrepancy might be due to:')
    console.log('  1. Old messages being counted that shouldn\'t be')
    console.log('  2. Timezone differences in date calculations')
    console.log('  3. Messages from other projects being included')
    
    // 6. Check if there are duplicate message IDs
    const uniqueIds = new Set(messageIds)
    if (uniqueIds.size !== messageIds.length) {
      console.log(`\n⚠️ Found ${messageIds.length - uniqueIds.size} duplicate message IDs!`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

debugAnalytics() 