#!/usr/bin/env node

// Script to fix Discord message timestamps
require('dotenv').config({ path: '.env.local' })

const PROJECT_ID = 'project:discord:OVPuPOX3_zHBnLUscRbdM' // Ledger project

async function fixTimestamps() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.error('❌ Missing Redis credentials')
    return
  }
  
  try {
    console.log('🔧 Fixing Discord message timestamps...\n')
    
    // Get all message IDs
    const indexKey = `discord:messages:project:${PROJECT_ID}`
    const indexResponse = await fetch(`${url}/smembers/${indexKey}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const indexData = await indexResponse.json()
    const messageIds = indexData.result || []
    
    console.log(`📊 Found ${messageIds.length} messages to check`)
    
    let fixedCount = 0
    let errorCount = 0
    
    // Process messages in batches
    const batchSize = 10
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize)
      
      for (const msgId of batch) {
        try {
          // Get the message
          const msgResponse = await fetch(`${url}/json.get/${msgId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          const msgData = await msgResponse.json()
          
          if (msgData.result) {
            const msg = JSON.parse(msgData.result)
            const originalDate = new Date(msg.timestamp)
            
            // Check if the year is 2025 (incorrect)
            if (originalDate.getFullYear() === 2025) {
              // Fix the year to 2024
              const fixedDate = new Date(msg.timestamp)
              fixedDate.setFullYear(2024)
              
              msg.timestamp = fixedDate.toISOString()
              
              // Update the message
              const updateResponse = await fetch(`${url}/json.set/${msgId}/$`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ value: JSON.stringify(msg) })
              })
              
              if (updateResponse.ok) {
                fixedCount++
                console.log(`✅ Fixed: ${msg.username} - ${originalDate.toISOString()} → ${fixedDate.toISOString()}`)
              } else {
                errorCount++
                console.log(`❌ Failed to update: ${msgId}`)
              }
            }
          }
        } catch (error) {
          errorCount++
          console.error(`❌ Error processing ${msgId}:`, error.message)
        }
      }
      
      // Progress update
      if ((i + batchSize) % 50 === 0) {
        console.log(`📊 Progress: ${Math.min(i + batchSize, messageIds.length)}/${messageIds.length} messages processed`)
      }
    }
    
    console.log('\n✅ Timestamp fix complete!')
    console.log(`   - Fixed: ${fixedCount} messages`)
    console.log(`   - Errors: ${errorCount} messages`)
    console.log(`   - Unchanged: ${messageIds.length - fixedCount - errorCount} messages`)
    
    console.log('\n💡 Next steps:')
    console.log('1. The analytics cache will expire in 30 seconds')
    console.log('2. After that, the analytics should show correct numbers')
    console.log('3. New messages will be saved with correct timestamps')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

fixTimestamps() 