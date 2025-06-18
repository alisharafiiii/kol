#!/usr/bin/env node

// Script to fix test team users storage
require('dotenv').config({ path: '.env.local' })

async function fixTestTeamUsers() {
  console.log('🔧 Fixing test team users storage...\n')
  
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
  
  try {
    for (const user of testUsers) {
      const key = `profile:${user.twitterHandle}`
      
      // Set the profile correctly (just stringify once)
      const setResponse = await fetch(`${url}/set/${key}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          value: JSON.stringify(user)
        })
      })
      
      if (setResponse.ok) {
        console.log(`✅ Fixed ${user.role} user: ${user.name} (@${user.twitterHandle})`)
      } else {
        console.log(`❌ Failed to fix ${user.name}`)
        const error = await setResponse.text()
        console.log('Error:', error)
      }
    }
    
    console.log('\n✅ Test users fixed successfully!')
    console.log('\n📋 The moderator dropdown should now show:')
    testUsers.forEach(u => {
      console.log(`   - ${u.name} (@${u.twitterHandle}) - ${u.role.toUpperCase()}`)
    })
    
    console.log('\n💡 Refresh the Discord project page to see all team members!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

fixTestTeamUsers() 