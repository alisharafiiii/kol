#!/usr/bin/env node

// Script to revert Discord message timestamps back to 2025
require('dotenv').config({ path: '.env.local' })

const PROJECT_ID = 'project:discord:OVPuPOX3_zHBnLUscRbdM' // Ledger project

async function revertTimestamps() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.error('❌ Missing Redis credentials')
    return
  }
  
  try {
    console.log('🔧 Reverting Discord message timestamps back to 2025...\n')
    console.log('(System date is 2025, so messages should match)\n')
    
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
            
            // Check if the year is 2024 (needs to be reverted to 2025)
            if (originalDate.getFullYear() === 2024) {
              // Revert the year to 2025
              const fixedDate = new Date(msg.timestamp)
              fixedDate.setFullYear(2025)
              
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
                if (fixedCount <= 10) {
                  console.log(`✅ Reverted: ${msg.username} - ${originalDate.toISOString()} → ${fixedDate.toISOString()}`)
                }
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
    }
    
    console.log('\n✅ Timestamp revert complete!')
    console.log(`   - Reverted: ${fixedCount} messages`)
    console.log(`   - Errors: ${errorCount} messages`)
    console.log(`   - Unchanged: ${messageIds.length - fixedCount - errorCount} messages`)
    
    console.log('\n💡 Next steps:')
    console.log('1. The analytics should now work correctly with the system date')
    console.log('2. New messages will be saved with 2025 timestamps (matching system date)')
    console.log('3. Analytics will count messages from "today" (June 18, 2025)')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

revertTimestamps() 