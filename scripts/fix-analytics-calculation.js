#!/usr/bin/env node

// Fix analytics calculation to show proper counts
require('dotenv').config({ path: '.env.local' })

const PROJECT_ID = 'project:discord:OVPuPOX3_zHBnLUscRbdM' // Ledger project

async function calculateProperAnalytics() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.error('❌ Missing Redis credentials')
    return
  }
  
  try {
    console.log('📊 Calculating proper Discord analytics\n')
    
    // Get current time
    const now = new Date()
    console.log(`Current time: ${now.toString()}`)
    console.log(`Current time (ISO): ${now.toISOString()}\n`)
    
    // Get all message IDs
    const indexKey = `discord:messages:project:${PROJECT_ID}`
    const indexResponse = await fetch(`${url}/smembers/${indexKey}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const indexData = await indexResponse.json()
    const messageIds = indexData.result || []
    
    console.log(`Total messages in database: ${messageIds.length}`)
    
    // For "daily" - should be last 24 hours from NOW
    const daily24hAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000))
    
    // For "weekly" - should be last 7 days
    const weekly7dAgo = new Date(now)
    weekly7dAgo.setDate(weekly7dAgo.getDate() - 7)
    weekly7dAgo.setHours(0, 0, 0, 0)
    
    // For "monthly" - should be last 30 days
    const monthly30dAgo = new Date(now)
    monthly30dAgo.setDate(monthly30dAgo.getDate() - 30)
    monthly30dAgo.setHours(0, 0, 0, 0)
    
    console.log('\n📅 Time ranges:')
    console.log(`Daily (last 24h): ${daily24hAgo.toISOString()} to ${now.toISOString()}`)
    console.log(`Weekly (last 7d): ${weekly7dAgo.toISOString()} to ${now.toISOString()}`)
    console.log(`Monthly (last 30d): ${monthly30dAgo.toISOString()} to ${now.toISOString()}`)
    
    // Count messages for each timeframe
    let dailyCount = 0
    let weeklyCount = 0
    let monthlyCount = 0
    let allTimeCount = messageIds.length
    const dailyUsers = new Set()
    const weeklyUsers = new Set()
    const monthlyUsers = new Set()
    
    // Get a few sample messages to show
    const sampleMessages = []
    
    for (const msgId of messageIds) {
      const msgResponse = await fetch(`${url}/json.get/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const msgData = await msgResponse.json()
      
      if (msgData.result) {
        try {
          const msg = JSON.parse(msgData.result)
          if (msg.timestamp) {
            const msgDate = new Date(msg.timestamp)
            
            // Daily (last 24 hours)
            if (msgDate >= daily24hAgo && msgDate <= now) {
              dailyCount++
              dailyUsers.add(msg.userId)
              if (sampleMessages.length < 5) {
                sampleMessages.push({
                  time: msgDate.toLocaleString(),
                  user: msg.username,
                  content: (msg.content || '').substring(0, 50)
                })
              }
            }
            
            // Weekly
            if (msgDate >= weekly7dAgo && msgDate <= now) {
              weeklyCount++
              weeklyUsers.add(msg.userId)
            }
            
            // Monthly
            if (msgDate >= monthly30dAgo && msgDate <= now) {
              monthlyCount++
              monthlyUsers.add(msg.userId)
            }
          }
        } catch (e) {
          // Skip invalid messages
        }
      }
    }
    
    console.log('\n📊 CORRECT Analytics counts:')
    console.log('\nDAILY (last 24 hours):')
    console.log(`  Total Messages: ${dailyCount}`)
    console.log(`  Unique Users: ${dailyUsers.size}`)
    
    console.log('\nWEEKLY (last 7 days):')
    console.log(`  Total Messages: ${weeklyCount}`)
    console.log(`  Unique Users: ${weeklyUsers.size}`)
    
    console.log('\nMONTHLY (last 30 days):')
    console.log(`  Total Messages: ${monthlyCount}`)
    console.log(`  Unique Users: ${monthlyUsers.size}`)
    
    console.log('\nALL TIME:')
    console.log(`  Total Messages: ${allTimeCount}`)
    
    if (sampleMessages.length > 0) {
      console.log('\n📝 Sample messages from last 24 hours:')
      sampleMessages.forEach(msg => {
        console.log(`  ${msg.time} - ${msg.user}: ${msg.content}...`)
      })
    }
    
    console.log('\n💡 The analytics API should show these numbers!')
    console.log('If it\'s showing different numbers, the issue is in the date calculation logic.')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

calculateProperAnalytics() 