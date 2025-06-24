#!/usr/bin/env node

/**
 * Debug script for Twitter sync functionality
 * Usage: npm run debug:twitter-sync
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.local') })

console.log('='.repeat(80))
console.log('TWITTER SYNC DEBUG TOOL')
console.log('='.repeat(80))

// Check environment variables
console.log('\n1. ENVIRONMENT CHECK:')
console.log('   TWITTER_BEARER_TOKEN present:', !!process.env.TWITTER_BEARER_TOKEN)
console.log('   TWITTER_BEARER_TOKEN length:', process.env.TWITTER_BEARER_TOKEN?.length || 0)
console.log('   TWITTER_BEARER_TOKEN starts with:', process.env.TWITTER_BEARER_TOKEN?.substring(0, 10) + '...')

// Test Twitter API connection
console.log('\n2. TESTING TWITTER API CONNECTION:')
if (process.env.TWITTER_BEARER_TOKEN) {
  try {
    // Using multiple test tweet IDs to ensure we find a valid one
    const testTweetIds = [
      '1926330600631189734', // Known valid tweet from the campaign
      '1580887812914466566', // Elon Musk tweet
      '20'                    // Jack's first tweet (very old but should exist)
    ]
    
    let successfulTest = false
    for (const testTweetId of testTweetIds) {
      console.log(`\n   Testing with tweet ID: ${testTweetId}`)
      
      try {
        const response = await fetch(
          `https://api.twitter.com/2/tweets/${testTweetId}?tweet.fields=public_metrics`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
            },
          }
        )
        
        console.log(`   Response status: ${response.status}`)
        
        if (response.ok) {
          const data = await response.json()
          console.log('\n   ✅ Twitter API connection successful!')
          console.log('   Tweet data:', JSON.stringify(data, null, 2))
          
          // Show rate limit info
          console.log('\n   Rate limit info:')
          console.log(`     - Limit: ${response.headers.get('x-rate-limit-limit')}`)
          console.log(`     - Remaining: ${response.headers.get('x-rate-limit-remaining')}`)
          console.log(`     - Reset: ${new Date(parseInt(response.headers.get('x-rate-limit-reset') || '0') * 1000).toISOString()}`)
          
          successfulTest = true
          break // Stop testing once we have a successful response
        } else {
          const error = await response.text()
          console.error(`   ❌ Failed for tweet ${testTweetId}: ${response.status} - ${error}`)
        }
      } catch (fetchError) {
        console.error(`   ❌ Network error for tweet ${testTweetId}:`, fetchError.message)
      }
    }
    
    if (!successfulTest) {
      console.error('\n   ❌ All test tweets failed. Possible issues:')
      console.error('   - Invalid Bearer Token')
      console.error('   - Network connectivity issues')
      console.error('   - Twitter API is down')
    }
  } catch (error) {
    console.error('\n   ❌ Failed to test Twitter API:', error.message)
  }
} else {
  console.error('\n   ❌ TWITTER_BEARER_TOKEN not found in environment')
  console.error('   Please add TWITTER_BEARER_TOKEN to your .env.local file')
  console.error('   You can get a Bearer Token from: https://developer.twitter.com')
}

// Check Redis connection for caching
console.log('\n3. CHECKING REDIS CONNECTION (Upstash):')
try {
  // Use Upstash Redis REST API
  const { Redis } = await import('@upstash/redis')
  
  // Check for Upstash credentials
  const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL
  const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
  
  console.log('   UPSTASH_REDIS_REST_URL present:', !!UPSTASH_REDIS_REST_URL)
  console.log('   UPSTASH_REDIS_REST_TOKEN present:', !!UPSTASH_REDIS_REST_TOKEN)
  
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    console.error('   ❌ Upstash Redis credentials not found')
    console.error('   Please ensure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set in .env.local')
  } else {
    // Parse REDIS_URL if that's what we have
    let url = UPSTASH_REDIS_REST_URL
    let token = UPSTASH_REDIS_REST_TOKEN
    
    if (UPSTASH_REDIS_REST_URL.startsWith('redis://')) {
      try {
        const parsedUrl = new URL(UPSTASH_REDIS_REST_URL)
        token = parsedUrl.password
        url = `https://${parsedUrl.hostname}`
        console.log('   Parsed REDIS_URL to Upstash format')
      } catch (e) {
        console.error('   Failed to parse REDIS_URL:', e.message)
      }
    }
    
    const redis = new Redis({
      url: url,
      token: token,
    })
    
    // Test connection with a simple command
    const pong = await redis.ping()
    console.log('   ✅ Redis connection successful:', pong)
    
    // Check if there are any queued campaigns
    const queuedCampaigns = await redis.smembers('twitter:sync:queue')
    console.log(`   Queued campaigns: ${queuedCampaigns.length}`)
    if (queuedCampaigns.length > 0) {
      console.log('   Queued campaign IDs:', queuedCampaigns)
    }
    
    // Check rate limit cache
    const rateLimitCache = await redis.get('twitter:ratelimit')
    if (rateLimitCache) {
      const rateLimit = typeof rateLimitCache === 'string' ? JSON.parse(rateLimitCache) : rateLimitCache
      console.log('   Cached rate limit:', rateLimit)
    } else {
      console.log('   No cached rate limit found')
    }
  }
} catch (error) {
  console.error('   ❌ Redis connection failed:', error.message)
  console.error('   Make sure Upstash credentials are set correctly in .env.local')
}

console.log('\n' + '='.repeat(80))
console.log('DEBUG COMPLETE')
console.log('='.repeat(80))

process.exit(0) 