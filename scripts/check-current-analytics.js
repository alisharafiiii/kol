#!/usr/bin/env node

// Script to check current Discord analytics
require('dotenv').config({ path: '.env.local' })

const PROJECT_ID = 'project:discord:OVPuPOX3_zHBnLUscRbdM' // Ledger project

async function checkAnalytics() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.error('❌ Missing Redis credentials')
    return
  }
  
  try {
    console.log('📊 Current Discord Analytics for Ledger Project\n')
    
    // Get all message IDs
    const indexKey = `discord:messages:project:${PROJECT_ID}`
    const indexResponse = await fetch(`${url}/smembers/${indexKey}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const indexData = await indexResponse.json()
    const messageIds = indexData.result || []
    
    console.log(`Total messages in database: ${messageIds.length}`)
    
    // Check messages from today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    let todayCount = 0
    let uniqueUsersToday = new Set()
    let lastHourCount = 0
    const lastHour = new Date()
    lastHour.setHours(lastHour.getHours() - 1)
    
    // Check all messages for today's count
    for (const msgId of messageIds) {
      const msgResponse = await fetch(`${url}/json.get/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const msgData = await msgResponse.json()
      if (msgData.result) {
        const msg = JSON.parse(msgData.result)
        const msgDate = new Date(msg.timestamp)
        
        if (msgDate >= today && msgDate < tomorrow) {
          todayCount++
          uniqueUsersToday.add(msg.userId)
        }
        if (msgDate >= lastHour) {
          lastHourCount++
        }
      }
    }
    
    console.log(`\n📅 Today's Analytics (${today.toDateString()}):`);
    console.log(`  - Messages today: ${todayCount}`)
    console.log(`  - Unique users today: ${uniqueUsersToday.size}`)
    console.log(`  - Messages in last hour: ${lastHourCount}`)
    
    // Show some recent messages
    console.log('\n📝 Last 5 messages:')
    const recentIds = messageIds.slice(-5)
    for (const msgId of recentIds) {
      const msgResponse = await fetch(`${url}/json.get/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const msgData = await msgResponse.json()
      if (msgData.result) {
        const msg = JSON.parse(msgData.result)
        const msgDate = new Date(msg.timestamp)
        console.log(`  - ${msgDate.toLocaleString()}: ${msg.username}: ${msg.content.substring(0, 40)}...`)
      }
    }
    
    console.log('\n✅ Analytics check complete!')
    console.log('Note: The API has a 30-second cache, so changes may take time to reflect in the UI.')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkAnalytics() 