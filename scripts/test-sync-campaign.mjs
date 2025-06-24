#!/usr/bin/env node

/**
 * Test script for manually syncing a campaign
 * Usage: node scripts/test-sync-campaign.mjs <campaign-id>
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const campaignId = process.argv[2] || 'campaign:Te-1hZJ5AfwCwAEayvwLI'

console.log('='.repeat(80))
console.log('MANUAL CAMPAIGN SYNC TEST')
console.log('='.repeat(80))
console.log('Campaign ID:', campaignId)
console.log('Bearer Token present:', !!process.env.TWITTER_BEARER_TOKEN)

// Make a direct request to the sync API
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function testSync() {
  try {
    console.log('\nMaking request to:', `${baseUrl}/api/campaigns/${campaignId}/sync-tweets`)
    
    const response = await fetch(`${baseUrl}/api/campaigns/${campaignId}/sync-tweets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers if needed
      }
    })
    
    console.log('Response status:', response.status)
    
    const data = await response.json()
    console.log('Response data:', JSON.stringify(data, null, 2))
    
    if (data.result) {
      console.log('\nSync Results:')
      console.log('- Synced:', data.result.synced)
      console.log('- Failed:', data.result.failed)
      console.log('- Rate Limited:', data.result.rateLimited)
    }
  } catch (error) {
    console.error('Error:', error.message)
  }
}

testSync()
  .then(() => {
    console.log('\n' + '='.repeat(80))
    console.log('TEST COMPLETE')
    console.log('='.repeat(80))
    process.exit(0)
  })
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  }) 