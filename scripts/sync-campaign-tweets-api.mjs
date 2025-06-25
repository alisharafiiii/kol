#!/usr/bin/env node

import fetch from 'node-fetch'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') })

async function syncCampaignTweets(campaignId) {
  console.log('='.repeat(80))
  console.log('SYNCING CAMPAIGN TWEETS VIA API')
  console.log('='.repeat(80))
  console.log(`Campaign ID: ${campaignId}`)
  console.log(`Time: ${new Date().toISOString()}\n`)
  
  try {
    const url = `http://localhost:3002/api/campaigns/${campaignId}/sync-tweets`
    console.log(`Calling: ${url}`)
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    console.log(`Response status: ${response.status}`)
    
    const data = await response.json()
    console.log('\nResponse:', JSON.stringify(data, null, 2))
    
    if (data.result) {
      console.log('\nSummary:')
      console.log(`- Synced: ${data.result.synced}`)
      console.log(`- Failed: ${data.result.failed}`)
      console.log(`- Rate Limited: ${data.result.rateLimited}`)
    }
    
  } catch (error) {
    console.error('\nERROR:', error)
  }
}

// Get campaign ID from command line
const campaignId = process.argv[2]
if (!campaignId) {
  console.error('Usage: node sync-campaign-tweets-api.mjs <campaign-id>')
  process.exit(1)
}

syncCampaignTweets(campaignId).catch(console.error) 