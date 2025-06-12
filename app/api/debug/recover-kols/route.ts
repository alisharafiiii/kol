import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { getCampaign } from '@/lib/campaign'

export async function POST(request: NextRequest) {
  const campaignId = 'campaign:Te-1hZJ5AfwCwAEayvwLI'
  
  try {
    console.log('Starting KOL recovery for:', campaignId)
    
    // 1. Get the campaign
    const campaign = await getCampaign(campaignId)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    // 2. Find all campaign:kol:* keys
    const keys = await redis.keys('campaign:kol:*')
    const recoveredKols = []
    const restoredKolIds = []
    
    // 3. Check each KOL and recover if it belongs to our campaign
    for (const key of keys) {
      try {
        const kolData = await redis.json.get(key) as any
        if (kolData && kolData.campaignId === campaignId) {
          console.log(`Found KOL to recover: ${kolData.kolHandle}`)
          
          // Add KOL ID back to the campaign's KOL set
          await redis.sadd(`${campaignId}:kols`, kolData.id)
          restoredKolIds.push(kolData.id)
          
          // Convert CampaignKOL format to campaign's embedded KOL format
          const embeddedKol = {
            id: kolData.id,
            handle: kolData.kolHandle,
            name: kolData.kolName,
            pfp: kolData.kolImage || '',
            tier: kolData.tier,
            stage: kolData.stage === 'reached_out' ? 'reached out' : kolData.stage,
            device: kolData.deviceStatus || 'na',
            budget: kolData.budget?.toString() || '0',
            payment: kolData.paymentStatus || 'pending',
            views: kolData.totalViews || 0,
            likes: 0,
            retweets: 0,
            comments: 0,
            contact: '',
            links: kolData.links || [],
            platform: Array.isArray(kolData.platform) ? kolData.platform : [kolData.platform || 'x'],
            lastUpdated: new Date(kolData.addedAt || Date.now()),
            productId: kolData.productId,
            productAssignmentId: kolData.productAssignmentId,
            productCost: kolData.productCost
          }
          
          recoveredKols.push(embeddedKol)
        }
      } catch (err) {
        console.error(`Error processing ${key}:`, err)
      }
    }
    
    // 4. Update the campaign with recovered KOLs
    if (recoveredKols.length > 0) {
      campaign.kols = recoveredKols
      campaign.updatedAt = new Date().toISOString()
      
      await redis.json.set(campaignId, '$', campaign as any)
      
      console.log(`Successfully recovered ${recoveredKols.length} KOLs`)
      
      return NextResponse.json({
        success: true,
        message: `Successfully recovered ${recoveredKols.length} KOLs`,
        recoveredKols: recoveredKols.map(k => ({
          handle: k.handle,
          name: k.name,
          budget: k.budget,
          stage: k.stage
        })),
        campaignName: campaign.name,
        totalKolsNow: recoveredKols.length
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'No KOLs found to recover',
        campaign: campaign.name
      })
    }
    
  } catch (error) {
    console.error('Error during recovery:', error)
    return NextResponse.json(
      { error: 'Recovery failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 