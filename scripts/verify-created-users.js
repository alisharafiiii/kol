#!/usr/bin/env node

// Script to verify created test users
require('dotenv').config({ path: '.env.local' })

async function verifyUsers() {
  console.log('🔍 Verifying created test users...\n')
  
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  const testHandles = ['admin_alice', 'core_charlie', 'team_tina', 'intern_ivan', 'core_cathy']
  
  try {
    for (const handle of testHandles) {
      const key = `profile:${handle}`
      
      const getResponse = await fetch(`${url}/get/${key}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      const getData = await getResponse.json()
      if (getData.result) {
        try {
          const user = JSON.parse(getData.result)
          console.log(`✅ ${user.name} (@${user.twitterHandle})`)
          console.log(`   Role: ${user.role}`)
          console.log(`   Has Image: ${!!user.profileImageUrl}`)
          console.log(`   Tier: ${user.tier}`)
          console.log('')
        } catch (e) {
          console.log(`❌ Failed to parse ${handle}`)
        }
      } else {
        console.log(`❌ Not found: ${handle}`)
      }
    }
    
    // Also check total profile count
    const keysResponse = await fetch(`${url}/keys/profile:*`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    
    const keysData = await keysResponse.json()
    const profileKeys = keysData.result || []
    
    console.log(`\n📊 Total profiles in database: ${profileKeys.length}`)
    console.log('\n✅ The moderator dropdown should now show all these users!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

verifyUsers() 