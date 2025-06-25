#!/usr/bin/env node

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') })

// Initialize services
async function initServices() {
  const Redis = (await import('@upstash/redis')).Redis
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  
  const { TwitterSyncService } = await import('../lib/services/twitter-sync-service.ts')
  
  return { redis, TwitterSyncService }
}

async function syncCampaignTweets(campaignId) {
  console.log('='.repeat(80))
  console.log('SYNCING CAMPAIGN TWEETS')
  console.log('='.repeat(80))
  console.log(`Campaign ID: ${campaignId}`)
  console.log(`Time: ${new Date().toISOString()}\n`)
  
  const { redis, TwitterSyncService } = await initServices()
  
  try {
    // Get campaign
    const campaign = await redis.json.get(campaignId, '$')
    if (!campaign || !campaign[0]) {
      console.error('Campaign not found')
      return
    }
    
    const campaignData = campaign[0]
    console.log('1. CAMPAIGN INFO:')
    console.log(`   Name: ${campaignData.name}`)
    console.log(`   Status: ${campaignData.status}`)
    console.log(`   KOLs: ${campaignData.kols.length}`)
    
    // Call sync service
    console.log('\n2. CALLING SYNC SERVICE...')
    const result = await TwitterSyncService.syncCampaignTweets(campaignData)
    
    console.log('\n3. SYNC RESULTS:')
    console.log(`   Synced: ${result.synced}`)
    console.log(`   Failed: ${result.failed}`)
    console.log(`   Rate Limited: ${result.rateLimited}`)
    if (result.details && result.details.length > 0) {
      console.log('\n   Details:')
      result.details.forEach(d => {
        if (d.success) {
          console.log(`   ✅ @${d.handle}: Views=${d.metrics.impression_count}, Likes=${d.metrics.like_count}`)
        } else {
          console.log(`   ❌ @${d.handle}: ${d.error}`)
        }
      })
    }
    
    // Verify update
    console.log('\n4. VERIFYING UPDATE...')
    const updatedCampaign = await redis.json.get(campaignId, '$')
    const updatedData = updatedCampaign[0]
    
    console.log('   Updated KOL metrics:')
    updatedData.kols.forEach(kol => {
      if (kol.views > 0 || kol.likes > 0) {
        console.log(`   - @${kol.handle}: Views=${kol.views}, Likes=${kol.likes}, Retweets=${kol.retweets}`)
      }
    })
    
  } catch (error) {
    console.error('\nERROR:', error)
  }
}

// Get campaign ID from command line
const campaignId = process.argv[2]
if (!campaignId) {
  console.error('Usage: node sync-campaign-tweets.mjs <campaign-id>')
  process.exit(1)
}

syncCampaignTweets(campaignId).catch(console.error) 