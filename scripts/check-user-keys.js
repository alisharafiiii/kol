#!/usr/bin/env node

// Script to check user:* keys
require('dotenv').config({ path: '.env.local' })

async function checkUserKeys() {
  console.log('🔍 Checking user:* keys...\n')
  
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.error('❌ Missing Redis credentials')
    return
  }
  
  try {
    // Get all user:* keys
    const keysResponse = await fetch(`${url}/keys/user:*`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    
    const keysData = await keysResponse.json()
    const userKeys = keysData.result || []
    
    console.log(`Found ${userKeys.length} user:* keys\n`)
    
    const teamRoles = ['admin', 'core', 'team', 'intern']
    const teamUsers = []
    const allUsers = []
    
    // Check first 20 users
    for (let i = 0; i < Math.min(20, userKeys.length); i++) {
      const key = userKeys[i]
      const getResponse = await fetch(`${url}/get/${key}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      const getData = await getResponse.json()
      if (getData.result) {
        try {
          const user = JSON.parse(getData.result)
          const userInfo = {
            key,
            handle: user.twitterHandle || user.handle || user.username,
            name: user.name,
            role: user.role,
            email: user.email,
            hasImage: !!user.profileImageUrl || !!user.image
          }
          
          allUsers.push(userInfo)
          
          if (user.role && teamRoles.includes(user.role)) {
            teamUsers.push(userInfo)
          }
        } catch (e) {
          // Not JSON, might be a simple value
        }
      }
    }
    
    console.log('📋 Sample users (first 20):')
    allUsers.forEach(u => {
      console.log(`- ${u.name || 'No name'} (@${u.handle || 'No handle'}) - Role: ${u.role || 'NO ROLE'} ${u.hasImage ? '📷' : ''}`)
    })
    
    console.log(`\n📊 Team users found:`)
    if (teamUsers.length === 0) {
      console.log('❌ No team users found in sample!')
    } else {
      teamUsers.forEach(user => {
        console.log(`- ${user.name || 'No name'} (@${user.handle}) - ${user.role} ${user.hasImage ? '📷' : ''}`)
      })
    }
    
    // Check a specific user structure
    if (allUsers.length > 0) {
      console.log('\n🔍 Sample user structure:')
      const sampleKey = allUsers[0].key
      const getResponse = await fetch(`${url}/get/${sampleKey}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      const getData = await getResponse.json()
      if (getData.result) {
        try {
          const user = JSON.parse(getData.result)
          console.log('Fields:', Object.keys(user).join(', '))
        } catch (e) {
          console.log('Failed to parse user')
        }
      }
    }
    
    console.log('\n💡 Insights:')
    console.log('- Most users might not have roles assigned')
    console.log('- The ProfileService might be looking at profile:* keys, not user:* keys')
    console.log('- You may need to run a migration to assign roles to users')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkUserKeys() 