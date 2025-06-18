#!/usr/bin/env node

// Script to check users with team roles using Upstash REST API
require('dotenv').config({ path: '.env.local' })

async function checkTeamUsers() {
  console.log('🔍 Checking team users via REST API...\n')
  
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.error('❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN')
    return
  }
  
  try {
    // Get all keys matching profile:*
    const keysResponse = await fetch(`${url}/keys/profile:*`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    
    const keysData = await keysResponse.json()
    const profileKeys = keysData.result || []
    
    console.log(`Found ${profileKeys.length} total profiles in database\n`)
    
    const teamRoles = ['admin', 'core', 'team', 'intern']
    const teamUsers = []
    const sampleProfiles = []
    
    // Get a few sample profiles to check structure
    for (let i = 0; i < Math.min(10, profileKeys.length); i++) {
      const key = profileKeys[i]
      const getResponse = await fetch(`${url}/get/${key}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      const getData = await getResponse.json()
      if (getData.result) {
        try {
          const profile = JSON.parse(getData.result)
          sampleProfiles.push({
            key,
            handle: profile.twitterHandle || profile.handle,
            name: profile.name,
            role: profile.role,
            hasImage: !!profile.profileImageUrl
          })
          
          if (profile.role && teamRoles.includes(profile.role)) {
            teamUsers.push({
              handle: profile.twitterHandle || profile.handle,
              name: profile.name,
              role: profile.role,
              hasImage: !!profile.profileImageUrl
            })
          }
        } catch (e) {
          console.log(`Failed to parse profile ${key}`)
        }
      }
    }
    
    console.log('📋 Sample profiles (first 10):')
    sampleProfiles.forEach(p => {
      console.log(`- ${p.name || 'No name'} (@${p.handle}) - Role: ${p.role || 'NO ROLE'} ${p.hasImage ? '📷' : ''}`)
    })
    
    console.log(`\n📊 Team users found in sample:`)
    teamUsers.forEach(user => {
      console.log(`- ${user.name || 'No name'} (@${user.handle}) - ${user.role} ${user.hasImage ? '📷' : ''}`)
    })
    
    console.log('\n💡 Note: This is just a sample. The full database may contain more users.')
    console.log('If you see only Beth, it might mean:')
    console.log('1. Other users don\'t have the required roles assigned')
    console.log('2. The ProfileService might be filtering differently')
    console.log('3. Users might not be properly indexed')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkTeamUsers() 