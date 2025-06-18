#!/usr/bin/env node

// Script to check users with team roles in the database
require('dotenv').config({ path: '.env.local' })
const Redis = require('ioredis')

async function checkTeamUsers() {
  console.log('🔍 Checking team users in database...\n')
  
  const redis = new Redis(process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL)
  
  try {
    // Get all profile keys
    const profileKeys = await redis.keys('profile:*')
    console.log(`Found ${profileKeys.length} total profiles in database\n`)
    
    const teamRoles = ['admin', 'core', 'team', 'intern']
    const teamUsers = []
    
    // Check each profile
    for (const key of profileKeys) {
      const profile = await redis.get(key)
      if (profile) {
        try {
          const data = JSON.parse(profile)
          if (data.role && teamRoles.includes(data.role)) {
            teamUsers.push({
              handle: data.twitterHandle || data.handle,
              name: data.name,
              role: data.role,
              hasImage: !!data.profileImageUrl
            })
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
    
    console.log(`📊 Found ${teamUsers.length} team users:\n`)
    
    // Group by role
    const byRole = {
      admin: teamUsers.filter(u => u.role === 'admin'),
      core: teamUsers.filter(u => u.role === 'core'),
      team: teamUsers.filter(u => u.role === 'team'),
      intern: teamUsers.filter(u => u.role === 'intern')
    }
    
    console.log('By Role:')
    console.log(`- Admin: ${byRole.admin.length} users`)
    console.log(`- Core: ${byRole.core.length} users`)
    console.log(`- Team: ${byRole.team.length} users`)
    console.log(`- Intern: ${byRole.intern.length} users`)
    
    console.log('\nDetailed List:')
    teamUsers.forEach(user => {
      console.log(`- ${user.name || 'No name'} (@${user.handle}) - ${user.role} ${user.hasImage ? '📷' : ''}`)
    })
    
    // Also check if there are any users without roles
    let noRoleCount = 0
    for (const key of profileKeys) {
      const profile = await redis.get(key)
      if (profile) {
        try {
          const data = JSON.parse(profile)
          if (!data.role) {
            noRoleCount++
          }
        } catch (e) {
          // Skip
        }
      }
    }
    
    console.log(`\n⚠️  ${noRoleCount} profiles have no role assigned`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    redis.disconnect()
  }
}

checkTeamUsers() 