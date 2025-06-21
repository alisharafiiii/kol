#!/usr/bin/env node

// Simple test for Discord link functionality
require('dotenv').config({ path: '.env.local' })
const Redis = require('ioredis')

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

async function testDiscordLink() {
  console.log('🧪 Testing Discord Link Process\n')
  
  // 1. Check Redis connection
  console.log('1. Testing Redis connection...')
  try {
    await redis.ping()
    console.log('✅ Redis connected\n')
  } catch (error) {
    console.error('❌ Redis error:', error.message)
    return
  }
  
  // 2. Create a test verification session
  const testSessionId = `verify-testuser-${Date.now()}`
  const sessionData = {
    discordId: '123456789',
    discordUsername: 'testuser',
    discordTag: 'testuser#1234',
    createdAt: new Date().toISOString()
  }
  
  console.log('2. Creating test verification session...')
  console.log('   Session ID:', testSessionId)
  console.log('   Data:', JSON.stringify(sessionData, null, 2))
  
  try {
    await redis.set(
      `discord:verify:${testSessionId}`, 
      JSON.stringify(sessionData),
      'EX', 300 // 5 minutes
    )
    console.log('✅ Session created\n')
  } catch (error) {
    console.error('❌ Error creating session:', error)
    return
  }
  
  // 3. Verify session can be retrieved
  console.log('3. Retrieving session...')
  try {
    const retrieved = await redis.get(`discord:verify:${testSessionId}`)
    if (retrieved) {
      const parsed = JSON.parse(retrieved)
      console.log('✅ Session retrieved:', JSON.stringify(parsed, null, 2))
    } else {
      console.log('❌ Session not found')
    }
  } catch (error) {
    console.error('❌ Error retrieving session:', error)
  }
  
  // 4. Check if test user exists
  console.log('\n4. Checking for existing test users...')
  try {
    const userIds = await redis.smembers('idx:username:testuser')
    console.log('   Found user IDs:', userIds)
    
    if (userIds.length > 0) {
      for (const userId of userIds) {
        const profile = await redis.json.get(userId)
        console.log(`   Profile ${userId}:`, JSON.stringify(profile, null, 2))
      }
    }
  } catch (error) {
    console.error('❌ Error checking users:', error)
  }
  
  // 5. Clean up
  console.log('\n5. Cleaning up test session...')
  await redis.del(`discord:verify:${testSessionId}`)
  console.log('✅ Done\n')
  
  console.log('📝 To test the full flow:')
  console.log('   1. Make sure you\'re signed in with Twitter')
  console.log('   2. Use /connect command in Discord')
  console.log('   3. Click the verification link')
  console.log('   4. Check the browser console for errors')
  
  process.exit(0)
}

testDiscordLink().catch(console.error) 