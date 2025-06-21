require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function fixUndefinedApprovalStatus() {
  try {
    console.log('🔍 Scanning for users with undefined approval status...')
    
    // Get all user keys
    const userKeys = await redis.keys('user:*')
    console.log(`Found ${userKeys.length} users to check`)
    
    let fixedCount = 0
    let undefinedCount = 0
    
    for (const key of userKeys) {
      const user = await redis.json.get(key)
      
      if (!user) continue
      
      // Check if approvalStatus is undefined or null
      if (user.approvalStatus === undefined || user.approvalStatus === null) {
        undefinedCount++
        console.log(`\n❌ Found user with undefined approval status:`)
        console.log(`   ID: ${user.id}`)
        console.log(`   Handle: ${user.twitterHandle}`)
        console.log(`   Name: ${user.name}`)
        console.log(`   Role: ${user.role}`)
        
        // Fix based on role
        let newStatus = 'pending'
        if (user.role === 'admin' || user.role === 'core' || user.role === 'team') {
          newStatus = 'approved'
          console.log(`   ✅ Setting to 'approved' (${user.role} role)`)
        } else {
          console.log(`   ⏳ Setting to 'pending' (${user.role || 'user'} role)`)
        }
        
        // Update the user
        user.approvalStatus = newStatus
        user.updatedAt = new Date().toISOString()
        
        await redis.json.set(key, '$', user)
        fixedCount++
      }
    }
    
    console.log(`\n📊 Summary:`)
    console.log(`   Total users checked: ${userKeys.length}`)
    console.log(`   Users with undefined status: ${undefinedCount}`)
    console.log(`   Users fixed: ${fixedCount}`)
    
    // Also check ProfileService profiles
    console.log('\n🔍 Checking ProfileService profiles...')
    const profileKeys = await redis.keys('profile:*')
    console.log(`Found ${profileKeys.length} profiles to check`)
    
    let profileFixedCount = 0
    
    for (const key of profileKeys) {
      const profile = await redis.json.get(key)
      
      if (!profile) continue
      
      if (profile.approvalStatus === undefined || profile.approvalStatus === null) {
        console.log(`\n❌ Found profile with undefined approval status:`)
        console.log(`   ID: ${profile.id}`)
        console.log(`   Handle: ${profile.twitterHandle}`)
        console.log(`   Name: ${profile.name}`)
        
        // Set to pending for profiles
        profile.approvalStatus = 'pending'
        profile.updatedAt = new Date().toISOString()
        
        await redis.json.set(key, '$', profile)
        profileFixedCount++
        console.log(`   ✅ Fixed - set to 'pending'`)
      }
    }
    
    console.log(`\n📊 ProfileService Summary:`)
    console.log(`   Profiles fixed: ${profileFixedCount}`)
    
  } catch (error) {
    console.error('Error:', error)
  }
}

fixUndefinedApprovalStatus() 