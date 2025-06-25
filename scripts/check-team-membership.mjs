#!/usr/bin/env node

import { Redis } from '@upstash/redis'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

async function checkTeamMembership() {
  const handle = process.argv[2]
  if (!handle) {
    console.log('Usage: npm run check:team-membership <twitter-handle>')
    process.exit(1)
  }

  console.log(`\n🔍 Checking Team Membership for @${handle}\n`)

  try {
    // Get user profile
    const profile = await redis.hgetall(`profile:${handle}`)
    if (!profile || Object.keys(profile).length === 0) {
      console.log(`❌ User @${handle} not found`)
      process.exit(1)
    }

    console.log(`User: @${handle}`)
    console.log(`Role: ${profile.role || 'user'}`)
    console.log(`Status: ${profile.status}`)
    console.log('')

    // Check all campaigns for team membership
    const campaignKeys = await redis.keys('campaign:*')
    const memberOf = []
    
    for (const key of campaignKeys) {
      const campaign = await redis.hgetall(key)
      if (campaign.teamMembers) {
        const teamMembers = JSON.parse(campaign.teamMembers)
        if (teamMembers.includes(handle)) {
          memberOf.push({
            id: key,
            name: campaign.name,
            status: campaign.status,
            teamMembers: teamMembers
          })
        }
      }
    }

    if (memberOf.length === 0) {
      console.log('❌ Not a team member of any campaigns')
    } else {
      console.log(`✅ Team member of ${memberOf.length} campaign(s):\n`)
      memberOf.forEach(campaign => {
        console.log(`Campaign: ${campaign.name} (${campaign.status})`)
        console.log(`ID: ${campaign.id}`)
        console.log(`Team: ${campaign.teamMembers.join(', ')}`)
        console.log('')
      })
    }

    // Show access summary
    console.log('📋 Access Summary:')
    if (profile.role === 'admin' || profile.role === 'core') {
      console.log(`✅ Has access to ALL campaigns (${profile.role} role)`)
    } else if (memberOf.length > 0) {
      console.log(`✅ Has access to ${memberOf.length} campaign(s) as team member`)
    } else {
      console.log('❌ No campaign access (not admin/core and not a team member)')
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

checkTeamMembership() 