const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')

// Load environment
config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function analyzeDuplicateProfiles() {
  console.log('🔍 Analyzing Duplicate Profiles (DRY RUN - No deletions)\n')
  
  try {
    // 1. Get all user keys
    console.log('1️⃣ Fetching all user profiles...')
    const userKeys = await redis.keys('user:*')
    console.log(`   Found ${userKeys.length} total user keys\n`)
    
    // 2. Build a map of twitter handles to profiles
    console.log('2️⃣ Analyzing profiles for duplicates...')
    const profilesByHandle = new Map()
    let errorCount = 0
    let noHandleCount = 0
    
    for (const key of userKeys) {
      try {
        const profile = await redis.json.get(key)
        if (profile) {
          if (profile.twitterHandle) {
            const handle = profile.twitterHandle.toLowerCase().replace('@', '').trim()
            
            if (!profilesByHandle.has(handle)) {
              profilesByHandle.set(handle, [])
            }
            
            profilesByHandle.get(handle).push({
              key,
              profile,
              score: calculateProfileScore(profile)
            })
          } else {
            noHandleCount++
            console.log(`   ⚠️ No Twitter handle: ${key}`)
          }
        }
      } catch (err) {
        errorCount++
        // Don't log each error to avoid spam
      }
    }
    
    console.log(`   ✅ Analyzed ${profilesByHandle.size} unique Twitter handles`)
    console.log(`   ⚠️ ${noHandleCount} profiles without Twitter handles`)
    console.log(`   ⚠️ ${errorCount} profiles had errors\n`)
    
    // 3. Find duplicates
    console.log('3️⃣ Duplicate Analysis:')
    let duplicateCount = 0
    let totalDuplicateProfiles = 0
    const duplicatesByStatus = {
      approved: 0,
      pending: 0,
      rejected: 0,
      unknown: 0
    }
    
    for (const [handle, profiles] of profilesByHandle) {
      if (profiles.length > 1) {
        duplicateCount++
        totalDuplicateProfiles += (profiles.length - 1) // Count extras
        
        // Sort by score (highest first)
        profiles.sort((a, b) => b.score - a.score)
        
        // Count by status
        profiles.forEach(p => {
          const status = p.profile.approvalStatus || 'unknown'
          duplicatesByStatus[status] = (duplicatesByStatus[status] || 0) + 1
        })
        
        // Only show first 10 duplicates in detail
        if (duplicateCount <= 10) {
          console.log(`\n   📊 Handle: @${handle} has ${profiles.length} profiles:`)
          profiles.forEach((p, idx) => {
            const status = p.profile.approvalStatus || 'unknown'
            const role = p.profile.role || 'user'
            const name = p.profile.name || 'No name'
            console.log(`      ${idx + 1}. ${p.key}`)
            console.log(`         Name: ${name}`)
            console.log(`         Status: ${status}, Role: ${role}, Score: ${p.score}`)
          })
          console.log(`      → Would keep: ${profiles[0].key} (highest score: ${profiles[0].score})`)
        }
      }
    }
    
    if (duplicateCount > 10) {
      console.log(`\n   ... and ${duplicateCount - 10} more handles with duplicates`)
    }
    
    // 4. Summary
    console.log('\n4️⃣ Summary:')
    console.log(`   📊 Total profiles: ${userKeys.length}`)
    console.log(`   👥 Unique Twitter handles: ${profilesByHandle.size}`)
    console.log(`   🔄 Handles with duplicates: ${duplicateCount}`)
    console.log(`   📝 Total duplicate profiles that would be deleted: ${totalDuplicateProfiles}`)
    console.log(`\n   Status breakdown of ALL profiles:`)
    console.log(`   ✅ Approved: ${duplicatesByStatus.approved || 0}`)
    console.log(`   ⏳ Pending: ${duplicatesByStatus.pending || 0}`)
    console.log(`   ❌ Rejected: ${duplicatesByStatus.rejected || 0}`)
    console.log(`   ❓ Unknown: ${duplicatesByStatus.unknown || 0}`)
    
    console.log('\n💡 To actually clean duplicates, run: node scripts/clean-duplicate-profiles.js')
    
  } catch (error) {
    console.error('❌ Error during analysis:', error)
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

// Run the analysis
analyzeDuplicateProfiles() 