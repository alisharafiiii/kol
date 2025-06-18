#!/usr/bin/env node

// Script to create test team users
require('dotenv').config({ path: '.env.local' })

async function createTestTeamUsers() {
  console.log('🔧 Creating test team users...\n')
  
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
      
      // Set the profile
      const setResponse = await fetch(`${url}/set/${key}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([JSON.stringify(user)])
      })
      
      if (setResponse.ok) {
        console.log(`✅ Created ${user.role} user: ${user.name} (@${user.twitterHandle})`)
      } else {
        console.log(`❌ Failed to create ${user.name}`)
      }
      
      // Also add to search index
      const indexKey = `idx:profiles:${user.role}:${user.twitterHandle}`
      await fetch(`${url}/set/${indexKey}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([user.twitterHandle])
      })
    }
    
    console.log('\n✅ Test users created successfully!')
    console.log('\n📋 You should now see these users in the moderator dropdown:')
    testUsers.forEach(u => {
      console.log(`   - ${u.name} (@${u.twitterHandle}) - ${u.role}`)
    })
    
    console.log('\n💡 Note: You may need to refresh the page to see the new users')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

createTestTeamUsers() 