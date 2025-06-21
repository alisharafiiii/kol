require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function cleanAllDuplicates() {
  try {
    console.log('🔍 Scanning for duplicate profiles...\n')
    
    // Track all handles and their associated records
    const handleMap = new Map() // handle -> array of record keys
    const stats = {
      totalRecords: 0,
      uniqueHandles: 0,
      duplicatesFound: 0,
      recordsDeleted: 0,
      errors: []
    }
    
    // Get all user keys (old system)
    const userKeys = await redis.keys('user:*')
    console.log(`Found ${userKeys.length} user records`)
    
    // Get all profile keys (new system)
    const profileKeys = await redis.keys('profile:*')
    console.log(`Found ${profileKeys.length} profile records`)
    
    // Combine all keys
    const allKeys = [...userKeys, ...profileKeys]
    stats.totalRecords = allKeys.length
    
    // Group by Twitter handle
    for (const key of allKeys) {
      try {
        const data = await redis.json.get(key)
        if (!data) continue
        
        // Extract Twitter handle (normalize it)
        let handle = data.twitterHandle || data.handle || ''
        handle = handle.toLowerCase().replace('@', '').trim()
        
        if (!handle) {
          console.log(`⚠️  No handle found for ${key}`)
          continue
        }
        
        // Add to map
        if (!handleMap.has(handle)) {
          handleMap.set(handle, [])
        }
        handleMap.get(handle).push({
          key,
          data,
          type: key.startsWith('profile:') ? 'profile' : 'user'
        })
      } catch (error) {
        stats.errors.push(`Error processing ${key}: ${error.message}`)
      }
    }
    
    stats.uniqueHandles = handleMap.size
    console.log(`\n📊 Found ${stats.uniqueHandles} unique Twitter handles`)
    
    // Process duplicates
    for (const [handle, records] of handleMap.entries()) {
      if (records.length <= 1) continue
      
      stats.duplicatesFound++
      console.log(`\n🔄 Processing duplicates for @${handle} (${records.length} records)`)
      
      // Score each record to determine which to keep
      const scoredRecords = records.map(record => ({
        ...record,
        score: calculateRecordScore(record.data, record.type)
      }))
      
      // Sort by score (highest first)
      scoredRecords.sort((a, b) => b.score - a.score)
      
      // Keep the best record
      const keeper = scoredRecords[0]
      console.log(`  ✅ Keeping: ${keeper.key} (score: ${keeper.score})`)
      console.log(`     Type: ${keeper.type}`)
      console.log(`     Approval: ${keeper.data.approvalStatus}`)
      console.log(`     Role: ${keeper.data.role}`)
      console.log(`     Has Discord: ${!!(keeper.data.discordId || keeper.data.socialAccounts?.discord)}`)
      
      // Delete the rest
      for (let i = 1; i < scoredRecords.length; i++) {
        const duplicate = scoredRecords[i]
        console.log(`  🗑️  Deleting: ${duplicate.key} (score: ${duplicate.score})`)
        
        try {
          await redis.del(duplicate.key)
          stats.recordsDeleted++
          
          // Also remove from indexes
          await redis.srem(`idx:username:${handle}`, duplicate.key.replace('user:', ''))
          await redis.srem(`idx:profile:handle:${handle}`, duplicate.key.replace('profile:', ''))
        } catch (error) {
          stats.errors.push(`Error deleting ${duplicate.key}: ${error.message}`)
        }
      }
    }
    
    // Clean up indexes
    console.log('\n🧹 Cleaning up indexes...')
    
    // Clean username index
    const usernameIndexes = await redis.keys('idx:username:*')
    for (const idx of usernameIndexes) {
      const members = await redis.smembers(idx)
      for (const member of members) {
        // Check if the user still exists
        const userExists = await redis.exists(`user:${member}`)
        if (!userExists) {
          await redis.srem(idx, member)
          console.log(`  Removed ${member} from ${idx}`)
        }
      }
    }
    
    // Clean profile handle index
    const profileIndexes = await redis.keys('idx:profile:handle:*')
    for (const idx of profileIndexes) {
      const members = await redis.smembers(idx)
      for (const member of members) {
        // Check if the profile still exists
        const profileExists = await redis.exists(`profile:${member}`)
        if (!profileExists) {
          await redis.srem(idx, member)
          console.log(`  Removed ${member} from ${idx}`)
        }
      }
    }
    
    // Summary
    console.log('\n📊 Cleanup Summary:')
    console.log(`  Total records scanned: ${stats.totalRecords}`)
    console.log(`  Unique handles found: ${stats.uniqueHandles}`)
    console.log(`  Handles with duplicates: ${stats.duplicatesFound}`)
    console.log(`  Records deleted: ${stats.recordsDeleted}`)
    console.log(`  Errors: ${stats.errors.length}`)
    
    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:')
      stats.errors.forEach(err => console.log(`  - ${err}`))
    }
    
  } catch (error) {
    console.error('Fatal error:', error)
  }
}

// Calculate a score for each record to determine which to keep
function calculateRecordScore(data, type) {
  let score = 0
  
  // Prefer new profile system
  if (type === 'profile') score += 1000
  
  // Approval status (most important)
  if (data.approvalStatus === 'approved') score += 500
  else if (data.approvalStatus === 'pending') score += 100
  else if (data.approvalStatus === 'rejected') score += 10
  
  // Role importance
  if (data.role === 'admin') score += 400
  else if (data.role === 'core') score += 300
  else if (data.role === 'team') score += 200
  else if (data.role === 'kol') score += 150
  else if (data.role === 'scout') score += 100
  else if (data.role === 'user') score += 50
  
  // Has Discord connection
  if (data.discordId || data.socialAccounts?.discord) score += 200
  
  // Profile completeness
  if (data.name) score += 20
  if (data.email) score += 20
  if (data.bio) score += 10
  if (data.profileImageUrl) score += 10
  if (data.socialAccounts) score += 30
  if (data.socialLinks) score += 20
  if (data.shippingAddress) score += 30
  if (data.contacts) score += 20
  
  // Has campaign data
  if (data.campaigns && data.campaigns.length > 0) score += 100
  
  // Recency (if available)
  if (data.updatedAt) {
    const daysSinceUpdate = (Date.now() - new Date(data.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    score += Math.max(0, 100 - daysSinceUpdate) // More recent = higher score
  }
  
  return score
}

// Add confirmation prompt
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
})

console.log('⚠️  WARNING: This will delete duplicate records from the database!')
console.log('It will keep the best version of each profile based on:')
console.log('  - Profile system (new > old)')
console.log('  - Approval status (approved > pending > rejected)')
console.log('  - Role importance (admin > core > team > kol > user)')
console.log('  - Discord connection')
console.log('  - Profile completeness')
console.log('  - Recency of updates\n')

readline.question('Do you want to continue? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    cleanAllDuplicates().then(() => {
      readline.close()
    })
  } else {
    console.log('Cancelled.')
    readline.close()
  }
}) 