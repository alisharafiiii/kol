#!/usr/bin/env node

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') })

// Initialize Redis
async function initRedis() {
  const Redis = (await import('@upstash/redis')).Redis
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

async function testKOLLinks() {
  console.log('='.repeat(80))
  console.log('TEST KOL LINKS UPDATE')
  console.log('='.repeat(80))
  
  const redis = await initRedis()
  const campaignId = 'campaign:sCwMpA6q4eRNwQZz4tmlp'
  
  try {
    // Get campaign
    const campaign = await redis.json.get(campaignId, '$')
    if (!campaign || !campaign[0]) {
      console.error('Campaign not found')
      return
    }
    
    const campaignData = campaign[0]
    console.log('\n1. CURRENT CAMPAIGN DATA:')
    console.log(`   Name: ${campaignData.name}`)
    console.log(`   KOLs: ${campaignData.kols.length}`)
    
    // Find the spurs KOL
    const spursKOL = campaignData.kols.find(k => k.handle === 'spurs')
    if (!spursKOL) {
      console.error('KOL @spurs not found')
      return
    }
    
    console.log('\n2. CURRENT @spurs DATA:')
    console.log(`   ID: ${spursKOL.id}`)
    console.log(`   Name: ${spursKOL.name}`)
    console.log(`   Current links: ${JSON.stringify(spursKOL.links || [])}`)
    
    // Add a test link
    const testLink = 'https://x.com/spurs/status/1937601518993051997'
    const updatedLinks = [...(spursKOL.links || []), testLink]
    
    console.log('\n3. UPDATING LINKS:')
    console.log(`   Adding: ${testLink}`)
    console.log(`   New links array: ${JSON.stringify(updatedLinks)}`)
    
    // Update the KOL
    const kolIndex = campaignData.kols.findIndex(k => k.id === spursKOL.id)
    campaignData.kols[kolIndex] = {
      ...spursKOL,
      links: updatedLinks,
      lastUpdated: new Date()
    }
    
    // Save back to Redis
    await redis.json.set(campaignId, '$', campaignData)
    console.log('\n4. UPDATE COMPLETE!')
    
    // Verify the update
    const updatedCampaign = await redis.json.get(campaignId, '$')
    const updatedSpursKOL = updatedCampaign[0].kols.find(k => k.handle === 'spurs')
    console.log('\n5. VERIFICATION:')
    console.log(`   Updated links: ${JSON.stringify(updatedSpursKOL.links)}`)
    console.log(`   Success: ${updatedSpursKOL.links.includes(testLink) ? 'YES' : 'NO'}`)
    
  } catch (error) {
    console.error('\nERROR:', error)
  }
}

testKOLLinks().catch(console.error) 