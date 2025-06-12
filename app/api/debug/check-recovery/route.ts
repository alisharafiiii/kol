import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { getCampaign } from '@/lib/campaign'
import { CampaignKOLService } from '@/lib/services/campaign-kol-service'

export async function GET(request: NextRequest) {
  const campaignId = 'campaign:Te-1hZJ5AfwCwAEayvwLI'
  
  const results: any = {
    campaignId,
    campaignData: null,
    serviceKols: [],
    redisKolSet: [],
    campaignKolKeys: [],
    profilesWithParticipation: []
  }
  
  try {
    // 1. Check campaign data
    const campaign = await getCampaign(campaignId)
    if (campaign) {
      results.campaignData = {
        name: campaign.name,
        kolsCount: campaign.kols.length,
        lastUpdated: campaign.updatedAt,
        kols: campaign.kols
      }
    }
    
    // 2. Check CampaignKOLService data
    const serviceKols = await CampaignKOLService.getCampaignKOLs(campaignId)
    results.serviceKols = serviceKols
    
    // 3. Check Redis for campaign KOL set
    const kolIds = await redis.smembers(`${campaignId}:kols`)
    results.redisKolSet = kolIds
    
    // 4. Check for any campaign:kol:* keys
    const keys = await redis.keys('campaign:kol:*')
    const matchingKols = []
    
    for (const key of keys) {
      try {
        const kolData = await redis.json.get(key)
        if (kolData && (kolData as any).campaignId === campaignId) {
          matchingKols.push({
            key,
            data: kolData
          })
        }
      } catch (err) {
        // Ignore errors
      }
    }
    
    results.campaignKolKeys = matchingKols
    
    // 5. Check profiles for campaign participation
    const profileKeys = await redis.keys('profile:*')
    const profilesWithParticipation = []
    
    for (const profileKey of profileKeys) {
      try {
        const profile = await redis.json.get(profileKey)
        if (profile && (profile as any).campaigns) {
          const campaigns = (profile as any).campaigns
          const participation = campaigns.find((c: any) => c.campaignId === campaignId)
          if (participation) {
            profilesWithParticipation.push({
              profileKey,
              twitterHandle: (profile as any).twitterHandle,
              name: (profile as any).name,
              participation
            })
          }
        }
      } catch (err) {
        // Ignore errors
      }
    }
    
    results.profilesWithParticipation = profilesWithParticipation
    
  } catch (error) {
    console.error('Error checking recovery:', error)
    results.error = error instanceof Error ? error.message : 'Unknown error'
  }
  
  return NextResponse.json(results, { status: 200 })
} 