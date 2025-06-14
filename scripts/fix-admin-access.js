const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')

config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function fixAdminAccess() {
  console.log('🔧 Fixing Admin Access...\n')
  
  try {
    // 1. Fix sharafi_eth
    console.log('1️⃣ Fixing sharafi_eth profiles...')
    
    // Get the good admin profile
    const adminProfile = await redis.json.get('user:user_sharafi_eth')
    if (adminProfile) {
      // Fix twitter_sharafi_eth to have admin role
      const twitterProfile = await redis.json.get('user:twitter_sharafi_eth')
      if (twitterProfile) {
        twitterProfile.role = 'admin'
        twitterProfile.approvalStatus = 'approved'
        await redis.json.set('user:twitter_sharafi_eth', '$', twitterProfile)
        console.log('   ✅ Fixed user:twitter_sharafi_eth role to admin')
      }
      
      // Ensure sharafi_eth key exists (some auth checks use this)
      await redis.json.set('user:sharafi_eth', '$', adminProfile)
      console.log('   ✅ Created user:sharafi_eth with admin role')
      
      // Update username index
      await redis.sadd('idx:username:sharafi_eth', 'sharafi_eth', 'user_sharafi_eth', 'twitter_sharafi_eth')
      console.log('   ✅ Updated username index')
    }
    
    // 2. Fix nabulines
    console.log('\n2️⃣ Fixing nabulines profiles...')
    
    const nabulinesProfile = await redis.json.get('user:twitter_nabulines')
    if (nabulinesProfile && nabulinesProfile.role === 'admin') {
      // Create missing keys
      await redis.json.set('user:nabulines', '$', nabulinesProfile)
      await redis.json.set('user:user_nabulines', '$', nabulinesProfile)
      console.log('   ✅ Created missing nabulines keys with admin role')
      
      // Update username index
      await redis.sadd('idx:username:nabulines', 'nabulines', 'user_nabulines', 'twitter_nabulines')
      console.log('   ✅ Updated username index')
    }
    
    // 3. Verify the fixes
    console.log('\n3️⃣ Verifying admin access...')
    
    const adminKeys = [
      'user:sharafi_eth',
      'user:user_sharafi_eth',
      'user:twitter_sharafi_eth',
      'user:nabulines',
      'user:user_nabulines',
      'user:twitter_nabulines'
    ]
    
    for (const key of adminKeys) {
      const profile = await redis.json.get(key)
      if (profile) {
        console.log(`   ✅ ${key}: role=${profile.role}, status=${profile.approvalStatus}`)
      } else {
        console.log(`   ❌ ${key}: MISSING`)
      }
    }
    
    console.log('\n✅ Admin access restored!')
    console.log('   Both sharafi_eth and nabulines should now have admin access')
    
  } catch (error) {
    console.error('❌ Error fixing admin access:', error)
  }
}

fixAdminAccess() 