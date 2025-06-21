import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { ProfileService } from '@/lib/services/profile-service';
import { CampaignKOLService } from '@/lib/services/campaign-kol-service';

export async function GET(req: NextRequest) {
  try {
    console.log('Fixing hunter_nft campaign data...\n');
    
    // 1. Get hunter_nft's profile
    const profile = await ProfileService.getProfileByHandle('hunter_nft');
    if (!profile) {
      return NextResponse.json({ error: 'hunter_nft profile not found' }, { status: 404 });
    }
    
    const result: any = {
      profile: {
        id: profile.id,
        name: profile.name,
        isKOL: profile.isKOL,
        currentCampaigns: profile.campaigns?.length || 0,
      },
      campaigns: []
    };
    
    // 2. Search for campaigns hunter_nft is part of
    console.log('Searching for campaigns...');
    
    // Check campaign-kols relationships
    const campaignKeys = await redis.keys('campaign:*:kols');
    console.log('Found campaign keys:', campaignKeys.length);
    
    const hunterCampaigns = [];
    
    for (const key of campaignKeys) {
      const campaignId = key.split(':')[1];
      
      // Get KOLs for this campaign
      const kols = await CampaignKOLService.getCampaignKOLs(campaignId);
      
      // Check if hunter_nft is in this campaign
      const hunterKol = kols.find(k => 
        k.kolHandle === 'hunter_nft' || 
        k.kolHandle === '@hunter_nft' ||
        k.kolId === profile.id
      );
      
      if (hunterKol) {
        console.log(`Found in campaign ${campaignId}`);
        
        // Get campaign details
        const campaign: any = await redis.json.get(`campaign:${campaignId}`);
        if (campaign) {
          // Create campaign participation
          const participation = {
            campaignId: campaignId,
            campaignName: campaign.name,
            role: 'kol' as const,
            tier: hunterKol.tier,
            stage: hunterKol.stage,
            deviceStatus: hunterKol.deviceStatus,
            budget: hunterKol.budget,
            paymentStatus: hunterKol.paymentStatus,
            links: hunterKol.links || [],
            platform: hunterKol.platform,
            totalViews: hunterKol.totalViews,
            totalEngagement: hunterKol.totalEngagement,
            score: hunterKol.score,
            joinedAt: hunterKol.addedAt,
            completedAt: hunterKol.completedAt,
          };
          
          hunterCampaigns.push(participation);
          result.campaigns.push({
            campaignId,
            campaignName: campaign.name,
            stage: hunterKol.stage,
            budget: hunterKol.budget,
            views: hunterKol.totalViews,
            engagement: hunterKol.totalEngagement
          });
        }
      }
    }
    
    if (hunterCampaigns.length > 0) {
      console.log(`Found ${hunterCampaigns.length} campaigns for hunter_nft`);
      
      // Update profile
      profile.isKOL = true;
      profile.campaigns = hunterCampaigns;
      
      // Calculate KOL metrics
      profile.kolMetrics = {
        totalCampaigns: hunterCampaigns.length,
        totalEarnings: hunterCampaigns.reduce((sum, c) => sum + (c.budget || 0), 0),
        totalViews: hunterCampaigns.reduce((sum, c) => sum + (c.totalViews || 0), 0),
        totalEngagement: hunterCampaigns.reduce((sum, c) => sum + (c.totalEngagement || 0), 0),
        averageEngagementRate: 0,
        topPlatform: 'twitter',
        tierHistory: hunterCampaigns.map(c => ({
          tier: c.tier,
          date: c.joinedAt,
          campaignId: c.campaignId
        }))
      };
      
      // Calculate average engagement rate
      if (profile.kolMetrics.totalViews > 0) {
        profile.kolMetrics.averageEngagementRate = 
          (profile.kolMetrics.totalEngagement / profile.kolMetrics.totalViews) * 100;
      }
      
      console.log('Updating profile with campaign data...');
      await ProfileService.saveProfile(profile);
      
      result.success = true;
      result.message = 'Profile updated successfully';
      result.kolMetrics = profile.kolMetrics;
    } else {
      result.success = false;
      result.message = 'No campaigns found for hunter_nft';
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fix hunter campaigns',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 