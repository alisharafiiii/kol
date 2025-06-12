import { NextRequest, NextResponse } from 'next/server'
import { getCampaign } from '@/lib/campaign'
import { redis } from '@/lib/redis'

export async function POST(request: NextRequest) {
  const campaignId = 'campaign:Te-1hZJ5AfwCwAEayvwLI'
  
  try {
    console.log('Starting duplicate cleanup for:', campaignId)
    
    // 1. Get the campaign using getCampaign which handles Redis properly
    const campaign = await getCampaign(campaignId)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    // 2. Get the KOLs array
    const kols = campaign.kols || []
    console.log('Found KOLs in campaign:', kols.length)
    
    // 3. Track duplicates by handle
    const seenHandles = new Set<string>()
    const kolsToKeep: any[] = []
    const duplicates: any[] = []
    
    for (const kol of kols) {
      // The actual data uses 'kolHandle', but the type uses 'handle'
      const handle = (kol as any).kolHandle || kol.handle
      const name = (kol as any).kolName || kol.name
      
      if (seenHandles.has(handle)) {
        // This is a duplicate
        duplicates.push(kol)
        console.log(`Duplicate found: ${handle} (${name}) - will remove`)
      } else {
        // First occurrence
        seenHandles.add(handle)
        kolsToKeep.push(kol)
        console.log(`Keeping: ${handle} (${name})`)
      }
    }
    
    console.log(`\nSummary:`)
    console.log(`- Total KOLs: ${kols.length}`)
    console.log(`- Unique KOLs to keep: ${kolsToKeep.length}`)
    console.log(`- Duplicates to remove: ${duplicates.length}`)
    
    // 4. Update the campaign with only unique KOLs
    if (duplicates.length > 0) {
      // Update the campaign object
      campaign.kols = kolsToKeep
      campaign.updatedAt = new Date().toISOString()
      
      // Save back to Redis using JSON.set
      await redis.json.set(campaignId, '$', campaign as any)
      
      console.log('\nDuplicate cleanup completed!')
      console.log('Updated campaign to have only unique KOLs')
    } else {
      console.log('\nNo duplicates found.')
    }
    
    return NextResponse.json({
      success: true,
      summary: {
        totalKols: kols.length,
        uniqueKols: kolsToKeep.length,
        duplicatesRemoved: duplicates.length
      },
      keptKols: kolsToKeep,
      removedDuplicates: duplicates
    })
    
  } catch (error: any) {
    console.error('Error in duplicate cleanup:', error)
    return NextResponse.json({ 
      error: 'Failed to cleanup duplicates', 
      details: error.message 
    }, { status: 500 })
  }
} 