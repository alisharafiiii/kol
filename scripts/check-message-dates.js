#!/usr/bin/env node

// Script to check Discord message dates
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
    // Get all message IDs
    const indexKey = `discord:messages:project:${PROJECT_ID}`
    const indexResponse = await fetch(`${url}/smembers/${indexKey}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const indexData = await indexResponse.json()
    const messageIds = indexData.result || []
    
    console.log(`Total messages: ${messageIds.length}\n`)
    
    // Check first 5 messages
    console.log('First 5 messages:')
    for (let i = 0; i < Math.min(5, messageIds.length); i++) {
      const msgResponse = await fetch(`${url}/json.get/${messageIds[i]}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const msgData = await msgResponse.json()
      if (msgData.result) {
        const msg = JSON.parse(msgData.result)
        console.log(`- ${msg.timestamp} | ${msg.username}: ${(msg.content || '').substring(0, 30)}...`)
      }
    }
    
    // Count by year
    let count2024 = 0
    let count2025 = 0
    let todayCount = 0
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    for (const msgId of messageIds) {
      const msgResponse = await fetch(`${url}/json.get/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const msgData = await msgResponse.json()
      if (msgData.result) {
        const msg = JSON.parse(msgData.result)
        const msgDate = new Date(msg.timestamp)
        
        if (msgDate.getFullYear() === 2024) count2024++
        if (msgDate.getFullYear() === 2025) count2025++
        if (msgDate >= today && msgDate < tomorrow) todayCount++
      }
    }
    
    console.log(`\nMessage counts by year:`)
    console.log(`- 2024: ${count2024} messages`)
    console.log(`- 2025: ${count2025} messages`)
    console.log(`\nToday (${today.toDateString()}): ${todayCount} messages`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkDates() 