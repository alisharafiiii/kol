#!/usr/bin/env node

// Check analytics date calculations
require('dotenv').config({ path: '.env.local' })

const PROJECT_ID = 'project:discord:OVPuPOX3_zHBnLUscRbdM' // Ledger project

async function checkDates() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.error('❌ Missing Redis credentials')
    return
  }
  
  try {
    console.log('🕐 Checking date calculations and messages\n')
    
    // Show current date info
    const now = new Date()
    console.log(`System date: ${now.toString()}`)
    console.log(`ISO format: ${now.toISOString()}\n`)
    
    // Get all message IDs
    const indexKey = `discord:messages:project:${PROJECT_ID}`
    const indexResponse = await fetch(`${url}/smembers/${indexKey}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const indexData = await indexResponse.json()
    const messageIds = indexData.result || []
    
    console.log(`Total messages in database: ${messageIds.length}\n`)
    
    // Group messages by date
    const messagesByDate = {}
    const messagesByHour = {}
    
    for (const msgId of messageIds) {
      const msgResponse = await fetch(`${url}/json.get/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const msgData = await msgResponse.json()
      
      if (msgData.result) {
        try {
          const msg = JSON.parse(msgData.result)
          if (msg.timestamp) {
            const date = new Date(msg.timestamp)
            const dateKey = date.toISOString().split('T')[0]
            const hourKey = `${dateKey} ${date.getHours()}:00`
            
            messagesByDate[dateKey] = (messagesByDate[dateKey] || 0) + 1
            messagesByHour[hourKey] = (messagesByHour[hourKey] || 0) + 1
          }
        } catch (e) {
          // Skip invalid messages
        }
      }
    }
    
    // Show messages by date
    console.log('📅 Messages by date:')
    const sortedDates = Object.keys(messagesByDate).sort()
    sortedDates.forEach(date => {
      console.log(`   ${date}: ${messagesByDate[date]} messages`)
    })
    
    // Show last 24 hours
    console.log('\n⏰ Last 24 hours breakdown:')
    const last24Hours = new Date(now)
    last24Hours.setHours(last24Hours.getHours() - 24)
    
    let messagesLast24h = 0
    Object.entries(messagesByHour).forEach(([hour, count]) => {
      const hourDate = new Date(hour)
      if (hourDate >= last24Hours) {
        console.log(`   ${hour}: ${count} messages`)
        messagesLast24h += count
      }
    })
    console.log(`   Total in last 24h: ${messagesLast24h}`)
    
    // Calculate what "daily" should show
    console.log('\n📊 Analytics calculations:')
    
    // For "daily" timeframe - last 24 hours
    const dailyEnd = new Date(now)
    dailyEnd.setHours(23, 59, 59, 999)
    const dailyStart = new Date(dailyEnd)
    dailyStart.setTime(dailyStart.getTime() - (24 * 60 * 60 * 1000))
    
    console.log(`   Daily timeframe: ${dailyStart.toISOString()} to ${dailyEnd.toISOString()}`)
    
    // Count messages in daily range
    let dailyCount = 0
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
            if (msgDate >= dailyStart && msgDate <= dailyEnd) {
              dailyCount++
            }
          }
        } catch (e) {
          // Skip
        }
      }
    }
    
    console.log(`   Messages in daily range: ${dailyCount}`)
    
    // If the year is really 2025, let's see what messages we have from 2024
    console.log('\n🔍 Checking for 2024 vs 2025 messages:')
    let count2024 = 0
    let count2025 = 0
    let countOther = 0
    
    for (const msgId of messageIds) {
      const msgResponse = await fetch(`${url}/json.get/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const msgData = await msgResponse.json()
      
      if (msgData.result) {
        try {
          const msg = JSON.parse(msgData.result)
          if (msg.timestamp) {
            const year = new Date(msg.timestamp).getFullYear()
            if (year === 2024) count2024++
            else if (year === 2025) count2025++
            else countOther++
          }
        } catch (e) {
          // Skip
        }
      }
    }
    
    console.log(`   2024 messages: ${count2024}`)
    console.log(`   2025 messages: ${count2025}`)
    console.log(`   Other years: ${countOther}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkDates() 