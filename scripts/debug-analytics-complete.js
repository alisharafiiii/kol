#!/usr/bin/env node

// Comprehensive Discord analytics debug script
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
    console.log('🔍 Comprehensive Discord Analytics Debug\n')
    console.log(`System Date: ${new Date().toString()}\n`)
    
    // 1. Check the message index
    const indexKey = `discord:messages:project:${PROJECT_ID}`
    console.log(`📋 Checking index: ${indexKey}`)
    
    const indexResponse = await fetch(`${url}/smembers/${indexKey}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const indexData = await indexResponse.json()
    const messageIds = indexData.result || []
    
    console.log(`✅ Found ${messageIds.length} message IDs in index\n`)
    
    if (messageIds.length === 0) {
      console.log('⚠️ No messages found in index!')
      return
    }
    
    // 2. Check a sample message structure
    console.log('📝 Sample message structure:')
    const sampleId = messageIds[0]
    console.log(`   Message ID: ${sampleId}`)
    
    const sampleResponse = await fetch(`${url}/json.get/${sampleId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const sampleData = await sampleResponse.json()
    
    if (sampleData.result) {
      const msg = JSON.parse(sampleData.result)
      console.log('   Message data:', JSON.stringify(msg, null, 2))
    } else {
      console.log('   ❌ Could not retrieve message data')
      console.log('   Response:', sampleData)
    }
    
    // 3. Check date distribution
    console.log('\n📅 Checking date distribution:')
    const dateCounts = {}
    let validMessages = 0
    let invalidMessages = 0
    
    // Sample first 20 messages
    for (let i = 0; i < Math.min(20, messageIds.length); i++) {
      const msgResponse = await fetch(`${url}/json.get/${messageIds[i]}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const msgData = await msgResponse.json()
      
      if (msgData.result) {
        try {
          const msg = JSON.parse(msgData.result)
          if (msg.timestamp) {
            const date = new Date(msg.timestamp)
            const dateKey = date.toISOString().split('T')[0]
            dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1
            validMessages++
          } else {
            invalidMessages++
          }
        } catch (e) {
          invalidMessages++
        }
      } else {
        invalidMessages++
      }
    }
    
    console.log(`   Valid messages: ${validMessages}`)
    console.log(`   Invalid messages: ${invalidMessages}`)
    console.log('   Date distribution:', dateCounts)
    
    // 4. Check today's messages specifically
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    console.log(`\n📊 Checking today's messages (${today.toDateString()}):`)
    let todayCount = 0
    let recentMessages = []
    
    // Check all messages for today
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
            if (msgDate >= today && msgDate < tomorrow) {
              todayCount++
              if (recentMessages.length < 5) {
                recentMessages.push({
                  time: msgDate.toLocaleTimeString(),
                  user: msg.username,
                  content: (msg.content || '').substring(0, 50)
                })
              }
            }
          }
        } catch (e) {
          // Skip invalid messages
        }
      }
    }
    
    console.log(`   Messages today: ${todayCount}`)
    console.log('   Recent messages:')
    recentMessages.forEach(m => {
      console.log(`     ${m.time} - ${m.user}: ${m.content}...`)
    })
    
    // 5. Check if analytics bot is saving messages correctly
    console.log('\n🤖 Checking latest saved messages:')
    const lastFive = messageIds.slice(-5)
    for (const msgId of lastFive) {
      const msgResponse = await fetch(`${url}/json.get/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const msgData = await msgResponse.json()
      
      if (msgData.result) {
        try {
          const msg = JSON.parse(msgData.result)
          const date = new Date(msg.timestamp)
          console.log(`   ${date.toLocaleString()} - ${msg.username}: ${(msg.content || '').substring(0, 40)}...`)
        } catch (e) {
          console.log(`   ❌ Invalid message: ${msgId}`)
        }
      }
    }
    
    console.log('\n✅ Debug complete!')
    console.log('\n💡 Summary:')
    console.log(`- Total messages in index: ${messageIds.length}`)
    console.log(`- Messages from today: ${todayCount}`)
    console.log(`- System date: ${new Date().toDateString()}`)
    console.log(`- Analytics should show ${todayCount} messages for "daily" timeframe`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

debugAnalytics() 