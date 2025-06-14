const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')

// Load environment
config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function cleanDuplicateProfiles() {
  console.log('🧹 Cleaning Duplicate Profiles\n')
  
  try {
    // 1. Get all user keys
    console.log('1️⃣ Fetching all user profiles...')
    const userKeys = await redis.keys('user:*')
    console.log(`   Found ${userKeys.length} total user keys\n`)
    
    // 2. Build a map of twitter handles to profiles
    console.log('2️⃣ Analyzing profiles for duplicates...')
    const profilesByHandle = new Map()
    let errorCount = 0
    
    for (const key of userKeys) {
      try {
        const profile = await redis.json.get(key)
        if (profile && profile.twitterHandle) {
          const handle = profile.twitterHandle.toLowerCase().replace('@', '').trim()
          
          if (!profilesByHandle.has(handle)) {
            profilesByHandle.set(handle, [])
          }
          
          profilesByHandle.get(handle).push({
            key,
            profile,
            score: calculateProfileScore(profile)
          })
        }
      } catch (err) {
        errorCount++
        console.error(`   ⚠️ Error reading ${key}:`, err.message)
      }
    }
    
    console.log(`   ✅ Analyzed ${profilesByHandle.size} unique Twitter handles`)
    console.log(`   ⚠️ ${errorCount} profiles had errors\n`)
    
    // 3. Find and process duplicates
    console.log('3️⃣ Processing duplicates...')
    let duplicateCount = 0
    let deletedCount = 0
    const deletionLog = []
    
    for (const [handle, profiles] of profilesByHandle) {
      if (profiles.length > 1) {
        duplicateCount++
        console.log(`\n   📊 Handle: @${handle} has ${profiles.length} profiles:`)
        
        // Sort by score (highest first)
        profiles.sort((a, b) => b.score - a.score)
        
        // Log each profile
        profiles.forEach((p, idx) => {
          const status = p.profile.approvalStatus || 'unknown'
          const role = p.profile.role || 'user'
          const name = p.profile.name || 'No name'
          console.log(`      ${idx + 1}. ${p.key}`)
          console.log(`         Name: ${name}`)
          console.log(`         Status: ${status}, Role: ${role}, Score: ${p.score}`)
        })
        
        // Keep the best one (first after sorting)
        const keeper = profiles[0]
        console.log(`      ✅ Keeping: ${keeper.key} (highest score: ${keeper.score})`)
        
        // Delete the rest
        for (let i = 1; i < profiles.length; i++) {
          const toDelete = profiles[i]
          console.log(`      ❌ Deleting: ${toDelete.key}`)
          
          try {
            await redis.del(toDelete.key)
            deletedCount++
            deletionLog.push({
              handle,
              deletedKey: toDelete.key,
              keptKey: keeper.key,
              reason: `Lower score (${toDelete.score} vs ${keeper.score})`
            })
          } catch (err) {
            console.error(`      ⚠️ Failed to delete ${toDelete.key}:`, err.message)
          }
        }
      }
    }
    
    // 4. Clean up orphaned keys (user:undefined, etc)
    console.log('\n4️⃣ Cleaning orphaned/invalid keys...')
    const invalidPatterns = [
      'user:undefined',
      'user:twitter_undefined',
      'user:user_undefined',
      'user:null',
      'user:twitter_null'
    ]
    
    for (const pattern of invalidPatterns) {
      try {
        const exists = await redis.exists(pattern)
        if (exists) {
          await redis.del(pattern)
          console.log(`   ❌ Deleted orphaned key: ${pattern}`)
          deletedCount++
        }
      } catch (err) {
        console.error(`   ⚠️ Error checking ${pattern}:`, err.message)
      }
    }
    
    // 5. Summary
    console.log('\n5️⃣ Summary:')
    console.log(`   📊 Total profiles analyzed: ${userKeys.length}`)
    console.log(`   👥 Unique Twitter handles: ${profilesByHandle.size}`)
    console.log(`   🔄 Handles with duplicates: ${duplicateCount}`)
    console.log(`   ❌ Profiles deleted: ${deletedCount}`)
    console.log(`   ⚠️ Errors encountered: ${errorCount}`)
    
    // 6. Save deletion log
    if (deletionLog.length > 0) {
      const logKey = `cleanup:log:${new Date().toISOString()}`
      await redis.json.set(logKey, '$', {
        timestamp: new Date().toISOString(),
        deletedCount,
        deletions: deletionLog
      })
      console.log(`\n   📝 Deletion log saved to: ${logKey}`)
    }
    
    console.log('\n✅ Cleanup complete!')
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  }
}

// Calculate a score for each profile to determine which to keep
function calculateProfileScore(profile) {
  let score = 0
  
  // Approval status (most important)
  if (profile.approvalStatus === 'approved') score += 1000
  else if (profile.approvalStatus === 'pending') score += 100
  else if (profile.approvalStatus === 'rejected') score += 10
  
  // Role importance
  if (profile.role === 'admin') score += 500
  else if (profile.role === 'core') score += 400
  else if (profile.role === 'team') score += 300
  else if (profile.role === 'kol') score += 200
  else if (profile.role === 'user') score += 100
  
  // Profile completeness
  if (profile.name) score += 10
  if (profile.email) score += 10
  if (profile.bio) score += 5
  if (profile.profileImageUrl) score += 5
  if (profile.followerCount) score += 5
  if (profile.tier) score += 20
  if (profile.shippingInfo) score += 15
  if (profile.socialAccounts) score += 10
  if (profile.campaigns && profile.campaigns.length > 0) score += 50
  
  // Recency (if available)
  if (profile.updatedAt) {
    const daysSinceUpdate = (Date.now() - new Date(profile.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    score += Math.max(0, 100 - daysSinceUpdate) // More recent = higher score
  }
  
  return score
}

// Run the cleanup
cleanDuplicateProfiles() 