#!/usr/bin/env node

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') })

// Initialize Redis
async function initRedis() {
  const Redis = (await import('@upstash/redis')).Redis
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

async function testCampaignAccess() {
  console.log('='.repeat(80))
  console.log('CAMPAIGN ACCESS TEST')
  console.log('='.repeat(80))
  
  const redis = await initRedis()
  
  try {
    // Test campaign ID
    const campaignId = process.argv[2] || 'campaign:sCwMpA6q4eRNwQZz4tmlp'
    console.log(`\n1. Testing campaign: ${campaignId}`)
    
    // Get campaign
    const campaign = await redis.json.get(campaignId, '$')
    if (!campaign || !campaign[0]) {
      console.error('Campaign not found')
      return
    }
    
    const campaignData = campaign[0]
    console.log(`   Name: ${campaignData.name}`)
    console.log(`   Created by: @${campaignData.createdBy}`)
    console.log(`   Team members: ${campaignData.teamMembers?.join(', @') || 'None'}`)
    
    // Test scenarios
    console.log('\n2. ACCESS SCENARIOS:')
    console.log('   ✅ Admin users: Always have access')
    console.log('   ✅ Team members: ' + (campaignData.teamMembers?.length > 0 ? `@${campaignData.teamMembers.join(', @')}` : 'None'))
    console.log('   ❌ Other users: Will be denied access')
    
    // Get some user profiles to test
    console.log('\n3. CHECKING USER PROFILES:')
    
    // Check admin user
    const adminProfile = await redis.json.get('profile:sharafi_eth', '$')
    if (adminProfile && adminProfile[0]) {
      console.log(`   @sharafi_eth - Role: ${adminProfile[0].role} - Access: ✅ (Admin)`)
    }
    
    // Check team members
    if (campaignData.teamMembers && campaignData.teamMembers.length > 0) {
      for (const member of campaignData.teamMembers) {
        const profileKey = `profile:${member.toLowerCase()}`
        const profile = await redis.json.get(profileKey, '$')
        if (profile && profile[0]) {
          console.log(`   @${member} - Role: ${profile[0].role} - Access: ✅ (Team member)`)
        } else {
          console.log(`   @${member} - No profile found - Access: ✅ (Team member)`)
        }
      }
    }
    
    // Test access rules
    console.log('\n4. ACCESS RULES SUMMARY:')
    console.log('   - Not logged in → Show login modal')
    console.log('   - Logged in + Admin → Access granted')
    console.log('   - Logged in + Team member → Access granted')
    console.log('   - Logged in + Neither → Redirect to /access-denied')
    
  } catch (error) {
    console.error('\nERROR:', error)
  }
}

testCampaignAccess().catch(console.error) 