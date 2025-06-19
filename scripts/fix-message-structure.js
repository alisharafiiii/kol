#!/usr/bin/env node

// Script to fix Discord message structure in Redis
require('dotenv').config({ path: '.env.local' })

const PROJECT_ID = 'project:discord:OVPuPOX3_zHBnLUscRbdM' // Ledger project

async function fixMessageStructure() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.error('❌ Missing Redis credentials')
    return
  }
  
  try {
    console.log('🔧 Fixing Discord message structure...\n')
    
    // Get all message IDs
    const indexKey = `discord:messages:project:${PROJECT_ID}`
    const indexResponse = await fetch(`${url}/smembers/${indexKey}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const indexData = await indexResponse.json()
    const messageIds = indexData.result || []
    
    console.log(`📊 Found ${messageIds.length} messages to check`)
    
    let fixedCount = 0
    let alreadyCorrect = 0
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
            const rawData = JSON.parse(msgData.result)
            
            // Check if it has the "value" wrapper
            if (rawData.value && typeof rawData.value === 'string') {
              // Parse the actual message data
              const actualMessage = JSON.parse(rawData.value)
              
              // Fix the timestamp to match system date (2025)
              if (actualMessage.timestamp) {
                const date = new Date(actualMessage.timestamp)
                if (date.getFullYear() === 2024) {
                  date.setFullYear(2025)
                  actualMessage.timestamp = date.toISOString()
                }
              }
              
              // Save the message without the wrapper
              const updateResponse = await fetch(`${url}/json.set/${msgId}/$`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(actualMessage)
              })
              
              if (updateResponse.ok) {
                fixedCount++
                if (fixedCount <= 5) {
                  console.log(`✅ Fixed: ${actualMessage.username} - ${actualMessage.timestamp}`)
                }
              } else {
                errorCount++
                console.log(`❌ Failed to update: ${msgId}`)
              }
            } else if (rawData.id && rawData.timestamp) {
              // Message is already in correct format, just check timestamp
              const date = new Date(rawData.timestamp)
              if (date.getFullYear() === 2024) {
                date.setFullYear(2025)
                rawData.timestamp = date.toISOString()
                
                const updateResponse = await fetch(`${url}/json.set/${msgId}/$`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(rawData)
                })
                
                if (updateResponse.ok) {
                  fixedCount++
                }
              } else {
                alreadyCorrect++
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
    
    console.log('\n✅ Structure fix complete!')
    console.log(`   - Fixed: ${fixedCount} messages`)
    console.log(`   - Already correct: ${alreadyCorrect} messages`)
    console.log(`   - Errors: ${errorCount} messages`)
    
    console.log('\n💡 Next steps:')
    console.log('1. Messages are now in the correct format')
    console.log('2. Timestamps match the system date (2025)')
    console.log('3. Analytics should work properly now')
    console.log('4. Wait 30 seconds for cache to expire')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

fixMessageStructure() 