#!/usr/bin/env node

/**
 * Debug script for testing campaign tweet sync
 * Usage: node scripts/debug-campaign-tweets.mjs <campaign-id>
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Redis } from '@upstash/redis'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const campaignId = process.argv[2]

if (!campaignId) {
  console.error('Usage: node scripts/debug-campaign-tweets.mjs <campaign-id>')
  console.error('Example: node scripts/debug-campaign-tweets.mjs campaign:abc123')
  process.exit(1)
}

console.log('='.repeat(80))
console.log('CAMPAIGN TWEET SYNC DEBUG')
console.log('='.repeat(80))
console.log('Campaign ID:', campaignId)
console.log('Time:', new Date().toISOString())

// Parse Upstash credentials
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.error('❌ Upstash Redis credentials not found')
  console.error('Please ensure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set in .env.local')
  process.exit(1)
}

// Parse REDIS_URL if needed
let url = UPSTASH_REDIS_REST_URL
let token = UPSTASH_REDIS_REST_TOKEN

if (UPSTASH_REDIS_REST_URL.startsWith('redis://')) {
  try {
    const parsedUrl = new URL(UPSTASH_REDIS_REST_URL)
    token = parsedUrl.password
    url = `https://${parsedUrl.hostname}`
  } catch (e) {
    console.error('Failed to parse REDIS_URL:', e.message)
    process.exit(1)
  }
}

// Connect to Redis
const redis = new Redis({
  url: url,
  token: token,
})

try {
  // Get campaign data
  console.log('\n1. FETCHING CAMPAIGN DATA:')
  const campaignData = await redis.json.get(campaignId, '$')
  
  if (!campaignData || !campaignData[0]) {
    console.error('   ❌ Campaign not found')
    process.exit(1)
  }
  
  const campaign = campaignData[0]
  console.log('   Campaign name:', campaign.name)
  console.log('   Status:', campaign.status)
  console.log('   KOLs count:', campaign.kols?.length || 0)
  
  // Extract tweet links
  console.log('\n2. EXTRACTING TWEET LINKS:')
  const tweetLinks = []
  
  if (campaign.kols && campaign.kols.length > 0) {
    for (const kol of campaign.kols) {
      console.log(`\n   KOL: @${kol.handle} (${kol.name})`)
      console.log(`   Links: ${kol.links?.length || 0}`)
      
      if (kol.links && kol.links.length > 0) {
        for (const link of kol.links) {
          console.log(`     - ${link}`)
          
          // Extract tweet ID
          const match = link.match(/status\/(\d+)/)
          if (match) {
            const tweetId = match[1]
            tweetLinks.push({ kol: kol.handle, link, tweetId })
            console.log(`       ✅ Tweet ID: ${tweetId}`)
          } else {
            console.log(`       ❌ Could not extract tweet ID`)
          }
        }
      }
    }
  }
  
  console.log(`\n   Total tweet links found: ${tweetLinks.length}`)
  
  // Test fetching tweet metrics
  if (tweetLinks.length > 0 && process.env.TWITTER_BEARER_TOKEN) {
    console.log('\n3. TESTING TWEET METRICS FETCH:')
    
    // Test first tweet
    const testTweet = tweetLinks[0]
    console.log(`\n   Testing tweet from @${testTweet.kol}`)
    console.log(`   Tweet ID: ${testTweet.tweetId}`)
    console.log(`   URL: ${testTweet.link}`)
    
    try {
      const response = await fetch(
        `https://api.twitter.com/2/tweets/${testTweet.tweetId}?tweet.fields=public_metrics`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
          },
        }
      )
      
      console.log(`\n   Response status: ${response.status}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('   ✅ Tweet data retrieved successfully!')
        console.log('   Metrics:', JSON.stringify(data.data?.public_metrics, null, 2))
      } else {
        const error = await response.text()
        console.error('   ❌ Failed to fetch tweet:', error)
      }
    } catch (error) {
      console.error('   ❌ Error fetching tweet:', error.message)
    }
  } else if (!process.env.TWITTER_BEARER_TOKEN) {
    console.log('\n3. SKIPPING TWEET FETCH TEST (No Bearer Token)')
  }
  
  // Check for campaign KOL entries (new format)
  console.log('\n4. CHECKING CAMPAIGN-KOL ENTRIES:')
  const kolKeys = await redis.keys(`campaign-kol:${campaignId}:*`)
  console.log(`   Found ${kolKeys.length} campaign-kol entries`)
  
  if (kolKeys.length > 0) {
    // Show first entry as example
    const firstKol = await redis.json.get(kolKeys[0], '$')
    if (firstKol && firstKol[0]) {
      console.log('\n   Sample KOL entry:', {
        handle: firstKol[0].kolHandle,
        links: firstKol[0].links,
        totalViews: firstKol[0].totalViews,
        totalEngagement: firstKol[0].totalEngagement
      })
    }
  }
  
} catch (error) {
  console.error('\nError:', error.message)
}

console.log('\n' + '='.repeat(80))
console.log('DEBUG COMPLETE')
console.log('='.repeat(80)) 