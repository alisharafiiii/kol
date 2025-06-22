import dotenv from 'dotenv'
import { Redis } from '@upstash/redis'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

// Initialize Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

console.log("Verifying session authentication for sharafi_eth...\n")

// Check profile data
const profileKey = 'profile:user_sharafi_eth'
const profile = await redis.json.get(profileKey)

if (profile) {
  console.log('✅ Profile found:')
  console.log('- Role:', profile.role)
  console.log('- Approval Status:', profile.approvalStatus)
  console.log('- Twitter Handle:', profile.twitterHandle)
  console.log('- Last Login:', profile.lastLoginAt)
  
  // Check if session invalidation exists
  const invalidationKey = 'auth:invalidate:sharafi_eth'
  const invalidation = await redis.get(invalidationKey)
  
  if (invalidation) {
    console.log('\n⚠️  Session invalidation found:', new Date(Number(invalidation)))
    console.log('User needs to re-authenticate')
  } else {
    console.log('\n✅ No session invalidation - user can authenticate normally')
  }
  
  // Check the twitter_ key as well
  const twitterProfile = await redis.json.get('twitter_sharafi_eth')
  if (twitterProfile) {
    console.log('\n✅ Twitter profile also found (legacy):')
    console.log('- Role:', twitterProfile.role)
    console.log('- Approval Status:', twitterProfile.approvalStatus)
  }
} else {
  console.log('❌ Profile not found')
}

console.log('\n--- Authentication Flow ---')
console.log('1. User signs in with Twitter')
console.log('2. OAuth callback completes')
console.log('3. Session polling waits for cookie to be set')
console.log('4. Middleware can now detect authenticated session')
console.log('5. No secondary login modal appears') 