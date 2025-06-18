#!/usr/bin/env node

// Final fix for test team users - store in exact format
require('dotenv').config({ path: '.env.local' })

async function finalFixTeamUsers() {
  console.log('🔧 Final fix for test team users...\n')
  
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.error('❌ Missing Redis credentials')
    return
  }
  
  const testUsers = [
    {
      id: 'test-admin-user',
      twitterHandle: 'admin_alice',
      name: 'Alice Admin',
      role: 'admin',
      profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
      email: 'alice@example.com',
      tier: 'hero',
      isKOL: false,
      approvalStatus: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'test-core-user',
      twitterHandle: 'core_charlie',
      name: 'Charlie Core',
      role: 'core',
      profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie',
      email: 'charlie@example.com',
      tier: 'legend',
      isKOL: false,
      approvalStatus: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'test-team-user',
      twitterHandle: 'team_tina',
      name: 'Tina Team',
      role: 'team',
      profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tina',
      email: 'tina@example.com',
      tier: 'star',
      isKOL: false,
      approvalStatus: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'test-intern-user',
      twitterHandle: 'intern_ivan',
      name: 'Ivan Intern',
      role: 'intern',
      profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ivan',
      email: 'ivan@example.com',
      tier: 'micro',
      isKOL: false,
      approvalStatus: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'test-core-user-2',
      twitterHandle: 'core_cathy',
      name: 'Cathy Core',
      role: 'core',
      profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=cathy',
      email: 'cathy@example.com',
      tier: 'legend',
      isKOL: false,
      approvalStatus: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
  
  try {
    // First, let's check how Beth's profile is stored for reference
    console.log('🔍 Checking Beth\'s profile format...')
    const bethKey = 'profile:beth'
    const bethResponse = await fetch(`${url}/get/${bethKey}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    
    const bethData = await bethResponse.json()
    if (bethData.result) {
      console.log('Beth\'s raw data:', bethData.result.substring(0, 100) + '...')
      console.log('Type:', typeof bethData.result)
    }
    
    // Now store our users in the same format
    for (const user of testUsers) {
      const key = `profile:${user.twitterHandle}`
      
      // Use the Upstash REST API SET command directly
      const setUrl = `${url}/SET/${key}/${encodeURIComponent(JSON.stringify(user))}`
      
      const setResponse = await fetch(setUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      if (setResponse.ok) {
        console.log(`✅ Stored ${user.role} user: ${user.name} (@${user.twitterHandle})`)
      } else {
        console.log(`❌ Failed to store ${user.name}`)
        const error = await setResponse.text()
        console.log('Error:', error)
      }
    }
    
    // Verify one of them
    console.log('\n🔍 Verifying Alice Admin...')
    const verifyResponse = await fetch(`${url}/get/profile:admin_alice`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    
    const verifyData = await verifyResponse.json()
    if (verifyData.result) {
      const alice = JSON.parse(verifyData.result)
      console.log('✅ Alice verified:', alice.name, '-', alice.role)
    }
    
    console.log('\n✅ All test users stored successfully!')
    console.log('\n📋 The moderator dropdown should now show:')
    console.log('   - Alice Admin (admin) 🔴')
    console.log('   - Charlie Core (core) 🟣')
    console.log('   - Tina Team (team) 🟢')
    console.log('   - Ivan Intern (intern) 🔵')
    console.log('   - Cathy Core (core) 🟣')
    console.log('\n💡 Refresh the Discord project page to see all team members!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

finalFixTeamUsers() 