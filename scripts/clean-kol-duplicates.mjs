#!/usr/bin/env node

// 🔒 LOCKED SCRIPT - DO NOT MODIFY WITHOUT CODE REVIEW
// This script cleans up duplicate KOL entries in campaigns
// It keeps entries with products and removes duplicates without products

import dotenv from 'dotenv'
import { Redis } from '@upstash/redis'

dotenv.config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

async function cleanDuplicates() {
  console.log('🧹 Starting KOL duplicate cleanup...')
  
  try {
    // Get all campaign IDs
    const campaignKeys = await redis.keys('campaign:*')
    console.log(`Found ${campaignKeys.length} campaigns`)
    
    let totalDuplicatesRemoved = 0
    
    for (const campaignKey of campaignKeys) {
      let campaign
      
      // Try to get as JSON first
      try {
        campaign = await redis.json.get(campaignKey)
      } catch (error) {
        // If JSON fails, try as string
        if (error?.message?.includes('WRONGTYPE')) {
          try {
            const campaignStr = await redis.get(campaignKey)
            if (campaignStr && typeof campaignStr === 'string') {
              campaign = JSON.parse(campaignStr)
            }
          } catch (parseError) {
            console.log(`   ⚠️  Skipping ${campaignKey}: Invalid JSON data`)
            continue
          }
        } else {
          console.log(`   ⚠️  Skipping ${campaignKey}: ${error.message}`)
          continue
        }
      }
      
      if (!campaign || !campaign.kols || !Array.isArray(campaign.kols)) {
        continue
      }
      
      console.log(`\n📋 Campaign: ${campaign.name} (${campaignKey})`)
      console.log(`   Total KOLs: ${campaign.kols.length}`)
      
      // Group KOLs by handle
      const kolsByHandle = {}
      campaign.kols.forEach(kol => {
        const handle = kol.handle.toLowerCase()
        if (!kolsByHandle[handle]) {
          kolsByHandle[handle] = []
        }
        kolsByHandle[handle].push(kol)
      })
      
      // Find duplicates
      const duplicateHandles = Object.entries(kolsByHandle)
        .filter(([handle, kols]) => kols.length > 1)
      
      if (duplicateHandles.length === 0) {
        console.log('   ✅ No duplicates found')
        continue
      }
      
      console.log(`   ⚠️  Found ${duplicateHandles.length} handles with duplicates:`)
      
      // Process each duplicate
      const newKols = []
      const processedHandles = new Set()
      
      for (const kol of campaign.kols) {
        const handle = kol.handle.toLowerCase()
        
        if (processedHandles.has(handle)) {
          // Skip - already processed this handle
          totalDuplicatesRemoved++
          continue
        }
        
        const duplicates = kolsByHandle[handle]
        if (duplicates.length === 1) {
          // No duplicates for this handle
          newKols.push(kol)
        } else {
          // Has duplicates - merge them
          console.log(`      - @${kol.handle}: ${duplicates.length} entries`)
          
          // Start with the first entry as base
          let mergedKol = { ...duplicates[0] }
          
          // Merge data from all duplicates
          duplicates.forEach((dup, idx) => {
            // Keep the entry with a product if one exists
            if (dup.productId && !mergedKol.productId) {
              mergedKol = { ...dup }
            }
            
            // Merge metrics (take the max)
            mergedKol.views = Math.max(mergedKol.views || 0, dup.views || 0)
            mergedKol.likes = Math.max(mergedKol.likes || 0, dup.likes || 0)
            mergedKol.retweets = Math.max(mergedKol.retweets || 0, dup.retweets || 0)
            mergedKol.comments = Math.max(mergedKol.comments || 0, dup.comments || 0)
            
            // Merge links
            if (dup.links && dup.links.length > 0) {
              mergedKol.links = [...new Set([...(mergedKol.links || []), ...dup.links])]
            }
            
            // Keep latest stage/device/payment status
            if (dup.lastUpdated > (mergedKol.lastUpdated || 0)) {
              mergedKol.stage = dup.stage
              mergedKol.device = dup.device
              mergedKol.payment = dup.payment
            }
          })
          
          console.log(`        Merged: keeping ${mergedKol.productId ? 'entry with product' : 'latest entry'}`)
          newKols.push(mergedKol)
          processedHandles.add(handle)
        }
      }
      
      // Update campaign if changes were made
      if (newKols.length < campaign.kols.length) {
        const removedCount = campaign.kols.length - newKols.length
        campaign.kols = newKols
        campaign.updatedAt = new Date().toISOString()
        
        // Try to save as JSON first
        try {
          await redis.json.set(campaignKey, '$', campaign)
        } catch (error) {
          // If JSON fails, save as string
          if (error?.message?.includes('WRONGTYPE')) {
            await redis.set(campaignKey, JSON.stringify(campaign))
          } else {
            throw error
          }
        }
        
        console.log(`   ✅ Removed ${removedCount} duplicates`)
      }
    }
    
    console.log(`\n✅ Cleanup complete! Removed ${totalDuplicatesRemoved} total duplicates`)
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    process.exit(1)
  }
}

// Run the cleanup
cleanDuplicates() 