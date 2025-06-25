#!/usr/bin/env node

import { Redis } from '@upstash/redis'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

async function testCoreRoleAccess() {
  console.log('\n🔍 Testing Core Role Access to Campaign Features\n')
  
  const testHandle = process.argv[2]
  if (!testHandle) {
    console.log('Usage: npm run test:core-access <twitter-handle>')
    process.exit(1)
  }

  try {
    // Check user profile
    const profile = await redis.hgetall(`profile:${testHandle}`)
    if (!profile || Object.keys(profile).length === 0) {
      console.log(`❌ User @${testHandle} not found`)
      process.exit(1)
    }

    console.log(`User: @${testHandle}`)
    console.log(`Role: ${profile.role || 'user'}`)
    console.log(`Status: ${profile.status}`)
    console.log('')

    // Check role permissions
    const role = profile.role || 'user'
    const canEditByRole = ['admin', 'core', 'team'].includes(role)
    
    console.log('📋 Campaign Permissions:')
    console.log(`✓ Can Edit Campaigns: ${canEditByRole ? 'YES' : 'NO'}`)
    
    if (canEditByRole) {
      console.log('  - Can Add KOLs: YES')
      console.log('  - Can Sync Tweets: YES')
      console.log('  - Can View Analytics: YES (for non-draft campaigns)')
      console.log('  - Can Edit Brief: YES')
      
      if (['admin', 'core'].includes(role)) {
        console.log('  - Can Access Settings: YES')
      } else {
        console.log('  - Can Access Settings: NO (admin/core only)')
      }
    }

    // List some campaigns to test with
    console.log('\n📊 Sample Campaigns to Test:')
    const campaignKeys = await redis.keys('campaign:*')
    let count = 0
    for (const key of campaignKeys.slice(0, 3)) {
      const campaign = await redis.hgetall(key)
      if (campaign.name) {
        console.log(`- ${campaign.name} (${campaign.status}) - ID: ${key}`)
        count++
      }
    }
    
    if (count === 0) {
      console.log('No campaigns found')
    }

    console.log(`\n✅ Test Instructions:`)
    console.log(`1. Login as @${testHandle}`)
    console.log(`2. Visit any campaign detail page`)
    console.log(`3. Verify you can see:`)
    console.log(`   - Add KOL button`)
    console.log(`   - Sync button (🔄)`)
    console.log(`   - Analytics button (📊) for active/completed campaigns`)
    console.log(`4. Click Sync and check console for: "Can edit: true (... role: true)"`)

  } catch (error) {
    console.error('Error:', error)
  }
}

testCoreRoleAccess() 