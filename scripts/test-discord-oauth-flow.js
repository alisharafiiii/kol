require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function testOAuthFlow() {
  console.log('🔍 Testing Discord OAuth Flow...\n')
  
  // Test session ID
  const testSessionId = 'verify-123456789-1234567890'
  const sessionKey = `discord:verify:${testSessionId}`
  
  // Create a test session
  const testSession = {
    discordId: '123456789',
    discordUsername: 'testuser',
    discordTag: 'testuser#1234',
    timestamp: Date.now()
  }
  
  console.log('1️⃣ Creating test verification session...')
  await redis.set(sessionKey, JSON.stringify(testSession), { ex: 600 })
  console.log('✅ Session created:', sessionKey)
  
  // Verify session exists
  const savedSession = await redis.get(sessionKey)
  console.log('✅ Session retrieved:', typeof savedSession === 'string' ? JSON.parse(savedSession) : savedSession)
  
  // Generate OAuth URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const verificationUrl = `${baseUrl}/auth/discord-link?session=${testSessionId}`
  console.log('\n2️⃣ OAuth URL generated:')
  console.log('🔗', verificationUrl)
  
  console.log('\n3️⃣ Flow Summary:')
  console.log('- User clicks /connect in Discord')
  console.log('- Bot generates unique session and stores in Redis')
  console.log('- Bot sends OAuth link to user')
  console.log('- User clicks link → redirected to Twitter OAuth')
  console.log('- After Twitter auth → Discord ID added to profile')
  console.log('- New users get profile created with both accounts linked')
  
  // Clean up
  await redis.del(sessionKey)
  console.log('\n✅ Test complete!')
  
  process.exit(0)
}

testOAuthFlow().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
}) 