#!/usr/bin/env node

// Script to debug campaign tweet data
require('dotenv').config({ path: '.env.local' })

async function debugCampaignTweets() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.error('❌ Missing Redis credentials')
    return
  }
  
  try {
    console.log('🔍 Debugging Campaign Tweet Data\n')
    
    // Get all campaign IDs
    const campaignsResponse = await fetch(`${url}/smembers/campaigns:all`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const campaignsData = await campaignsResponse.json()
    const campaignIds = campaignsData.result || []
    
    console.log(`Found ${campaignIds.length} campaigns\n`)
    
    // Check each campaign
    for (const campaignId of campaignIds.slice(0, 5)) { // Check first 5 campaigns
      // Properly encode the campaign ID for the URL
      const encodedId = encodeURIComponent(campaignId)
      const campaignResponse = await fetch(`${url}/json.get/${encodedId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const campaignData = await campaignResponse.json()
      
      // Parse the result - it might be a string that needs parsing
      let campaign = campaignData.result
      if (typeof campaign === 'string') {
        campaign = JSON.parse(campaign)
      }
      // Handle array wrapper
      if (Array.isArray(campaign)) {
        campaign = campaign[0]
      }
      
      if (!campaign) {
        console.log(`\n❌ Could not load campaign ${campaignId}`)
        continue
      }
      
      console.log(`\n📋 Campaign: ${campaign.name} (${campaignId})`)
      console.log(`   Status: ${campaign.status}`)
      console.log(`   Created by: @${campaign.createdBy}`)
      console.log(`   KOLs: ${campaign.kols?.length || 0}`)
      
      if (campaign.kols && campaign.kols.length > 0) {
        // Check first few KOLs
        for (const kol of campaign.kols.slice(0, 3)) {
          console.log(`\n   👤 KOL: @${kol.handle} (${kol.name})`)
          console.log(`      Stage: ${kol.stage || 'not set'}`)
          console.log(`      Links: ${kol.links ? kol.links.length : 0} tweet(s)`)
          
          if (kol.links && kol.links.length > 0) {
            for (const link of kol.links) {
              console.log(`         - ${link}`)
              
              // Extract tweet ID
              const match = link.match(/status\/(\d+)/)
              if (match) {
                console.log(`           Tweet ID: ${match[1]}`)
              }
            }
          } else {
            console.log(`         ⚠️  No tweet links found`)
          }
          
          // Check metrics
          if (kol.views || kol.likes || kol.retweets) {
            console.log(`      Metrics: ${kol.views || 0} views, ${kol.likes || 0} likes, ${kol.retweets || 0} retweets`)
          }
          
          // Check if there are any other fields that might contain links
          const possibleLinkFields = ['link', 'url', 'tweetUrl', 'tweet', 'post', 'postUrl']
          for (const field of possibleLinkFields) {
            if (kol[field]) {
              console.log(`         📌 Found ${field}: ${kol[field]}`)
            }
          }
        }
      }
    }
    
    // Also check for campaigns with the most KOLs
    console.log('\n\n📊 Campaigns with most KOLs:')
    const campaignsWithKols = []
    
    for (const campaignId of campaignIds) {
      const encodedId = encodeURIComponent(campaignId)
      const campaignResponse = await fetch(`${url}/json.get/${encodedId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const campaignData = await campaignResponse.json()
      
      let campaign = campaignData.result
      if (typeof campaign === 'string') {
        campaign = JSON.parse(campaign)
      }
      if (Array.isArray(campaign)) {
        campaign = campaign[0]
      }
      
      if (campaign && campaign.kols && campaign.kols.length > 0) {
        // Count KOLs with links
        const kolsWithLinks = campaign.kols.filter(k => k.links && k.links.length > 0).length
        campaignsWithKols.push({
          id: campaignId,
          name: campaign.name,
          totalKols: campaign.kols.length,
          kolsWithLinks
        })
      }
    }
    
    // Sort by KOLs with links
    campaignsWithKols.sort((a, b) => b.kolsWithLinks - a.kolsWithLinks)
    
    console.log('\nCampaigns sorted by KOLs with tweet links:')
    for (const camp of campaignsWithKols) {
      console.log(`   ${camp.name}: ${camp.kolsWithLinks}/${camp.totalKols} KOLs have tweet links`)
      if (camp.kolsWithLinks === 0 && camp.totalKols > 0) {
        console.log(`      ⚠️  Campaign has KOLs but no tweet links!`)
      }
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

debugCampaignTweets() 