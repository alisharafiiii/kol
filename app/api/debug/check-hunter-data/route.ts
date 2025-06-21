import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { ProfileService } from '@/lib/services/profile-service';

export async function GET(req: NextRequest) {
  try {
    const result: any = {
      profileService: {},
      oldRedis: {},
      campaignKols: {},
      campaignData: []
    };
    
    // 1. Check ProfileService
    const profile = await ProfileService.getProfileByHandle('hunter_nft');
    if (profile) {
      result.profileService = {
        id: profile.id,
        name: profile.name,
        isKOL: profile.isKOL,
        campaigns: profile.campaigns,
        kolMetrics: profile.kolMetrics,
        role: profile.role,
        approvalStatus: profile.approvalStatus
      };
    }
    
    // 2. Check old Redis
    const userIds = await redis.smembers('idx:username:hunter_nft');
    if (userIds.length > 0) {
      const userData: any = await redis.json.get(`user:${userIds[0]}`);
      if (userData) {
        result.oldRedis = {
          id: userData.id,
          name: userData.name,
          role: userData.role,
          campaigns: userData.campaigns,
          found: true
        };
      }
    }
    
    // 3. Check campaign-kols (old format)
    const oldCampaignKols = await redis.smembers('campaign-kols:hunter_nft');
    result.campaignKols.oldFormat = oldCampaignKols;
    
    // 4. Check all campaigns for hunter_nft
    const campaignKeys = await redis.keys('campaign:*');
    console.log('Total campaign keys:', campaignKeys.length);
    
    for (const key of campaignKeys) {
      // Skip non-campaign keys
      if (key.includes(':kols') || key.includes(':')) continue;
      
      const campaign: any = await redis.json.get(key);
      if (campaign) {
        // Check if hunter_nft is in the KOLs array
        const hasHunter = campaign.kols?.some((k: any) => 
          k.handle === 'hunter_nft' || 
          k.handle === '@hunter_nft' ||
          k.name?.toLowerCase().includes('hunter')
        );
        
        if (hasHunter) {
          const campaignId = key.replace('campaign:', '');
          result.campaignData.push({
            campaignId,
            campaignName: campaign.name,
            status: campaign.status,
            kols: campaign.kols?.filter((k: any) => 
              k.handle === 'hunter_nft' || 
              k.handle === '@hunter_nft' ||
              k.name?.toLowerCase().includes('hunter')
            )
          });
          
          // Check campaign:id:kols set
          const kolsSetKey = `${key}:kols`;
          const kolIds = await redis.smembers(kolsSetKey);
          result.campaignData[result.campaignData.length - 1].kolsSetCount = kolIds.length;
        }
      }
    }
    
    // 5. Check for any keys containing hunter_nft
    const hunterKeys = await redis.keys('*hunter_nft*');
    result.allHunterKeys = hunterKeys;
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: 'Failed to check hunter data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
