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
    console.log(`✓ Can View Campaign Details: ${['admin', 'core'].includes(role) ? 'YES (all campaigns)' : 'Only as team member'}`)
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
    console.log(`3. Verify:`)
    console.log(`   - Page loads without "access denied"`)
    console.log(`   - You can see Add KOL button`)
    console.log(`   - You can see Sync button (🔄)`)
    console.log(`   - You can see Analytics button (📊) for non-draft campaigns`)
    console.log(`4. Check browser console for access check:`)
    console.log(`   - "isCore: true"`)
    console.log(`   - "Grant access if admin, core, OR team member"`)

  } catch (error) {
    console.error('Error:', error)
  }
}

testCoreRoleAccess() 