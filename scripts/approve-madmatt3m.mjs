import { Redis } from '@upstash/redis'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

console.log('🔧 Approving madmatt3m...\n')

async function approveMadmatt3m() {
  try {
    const userId = 'twitter_madmatt3m'
    
    // Get current profile
    const profile = await redis.json.get(userId)
    if (!profile) {
      console.log('❌ Profile not found')
      return
    }
    
    console.log('Current status:', profile.approvalStatus)
    
    // Update approval status
    await redis.json.set(userId, '$.approvalStatus', 'approved')
    
    // Remove from pending set if exists
    await redis.srem('users:pending', userId)
    
    // Add to approved set
    await redis.sadd('users:approved', userId)
    
    // Verify
    const updated = await redis.json.get(userId)
    console.log('✅ Updated status:', updated.approvalStatus)
    
  } catch (error) {
    console.error('Error:', error)
  }
}

approveMadmatt3m() 