const { redis } = require('./lib/redis');
const { ProfileService } = require('./lib/services/profile-service');

async function checkHunterProfile() {
  console.log('Checking hunter_nft profile...\n');
  
  // Check ProfileService
  console.log('1. Checking ProfileService:');
  const profile = await ProfileService.getProfileByHandle('hunter_nft');
  if (profile) {
    console.log('Found in ProfileService:');
    console.log('- ID:', profile.id);
    console.log('- Name:', profile.name);
    console.log('- Role:', profile.role);
    console.log('- Approval:', profile.approvalStatus);
    console.log('- Is KOL:', profile.isKOL);
    console.log('- Campaigns:', profile.campaigns?.length || 0);
    if (profile.campaigns?.length > 0) {
      console.log('\nCampaign details:');
      profile.campaigns.forEach((c, i) => {
        console.log(`  Campaign ${i + 1}:`);
        console.log('  - ID:', c.campaignId);
        console.log('  - Name:', c.campaignName);
        console.log('  - Status:', c.status);
        console.log('  - Joined:', c.joinedAt);
      });
    }
    console.log('- KOL Metrics:', profile.kolMetrics);
  } else {
    console.log('Not found in ProfileService');
  }
  
  // Check old Redis
  console.log('\n2. Checking old Redis system:');
  const userIds = await redis.smembers('idx:username:hunter_nft');
  console.log('User IDs found:', userIds);
  
  if (userIds.length > 0) {
    const userData = await redis.json.get(`user:${userIds[0]}`);
    if (userData) {
      console.log('Found in Redis:');
      console.log('- ID:', userData.id);
      console.log('- Name:', userData.name);
      console.log('- Role:', userData.role);
      console.log('- Approval:', userData.approvalStatus);
      console.log('- Campaigns:', userData.campaigns?.length || 0);
    }
  }
  
  // Check campaign-kol relationships
  console.log('\n3. Checking campaign-kol relationships:');
  const campaignKols = await redis.keys('campaign-kols:*');
  console.log('Total campaign-kol keys:', campaignKols.length);
  
  for (const key of campaignKols) {
    const kols = await redis.smembers(key);
    if (kols.includes('hunter_nft')) {
      const campaignId = key.split(':')[1];
      console.log(`Found in campaign: ${campaignId}`);
      
      // Get campaign details
      const campaign = await redis.json.get(`campaign:${campaignId}`);
      if (campaign) {
        console.log('Campaign name:', campaign.name);
        console.log('Campaign status:', campaign.status);
      }
    }
  }
  
  process.exit(0);
}

checkHunterProfile().catch(console.error);
