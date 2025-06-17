import Redis from 'ioredis'
import { v4 as uuidv4 } from 'uuid'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

async function fixAllKOLs() {
  try {
    console.log('Scanning all campaigns for KOLs without profiles...')
    
    const campaignIds = await redis.smembers('campaigns:all')
    const kolsToFix = []
    
    // Find all KOLs in campaigns
    for (const campaignId of campaignIds) {
      const campaign = await redis.call('JSON.GET', campaignId, '$')
      const campaignData = campaign ? JSON.parse(campaign)[0] : null
      
      if (campaignData?.kols) {
        for (const kol of campaignData.kols) {
          if (kol.handle) {
            // Check if this KOL has a profile
            const profileKey = `profile:handle:${kol.handle.toLowerCase()}`
            const profileId = await redis.get(profileKey)
            
            if (!profileId) {
              // Also check old-style user index
              const userIds = await redis.smembers(`idx:username:${kol.handle.toLowerCase()}`)
              
              if (userIds.length === 0) {
                kolsToFix.push({
                  ...kol,
                  campaignName: campaignData.name,
                  campaignId
                })
              }
            }
          }
        }
      }
    }
    
    console.log(`Found ${kolsToFix.length} KOLs without profiles`)
    
    // Fix each KOL
    for (const kol of kolsToFix) {
      console.log(`\nFixing KOL: ${kol.handle} from campaign: ${kol.campaignName}`)
      
      const profileId = uuidv4()
      
      // Create UnifiedProfile
      const profile = {
        id: profileId,
        twitterHandle: kol.handle,
        name: kol.name || kol.handle,
        profileImageUrl: kol.pfp || '',
        role: 'kol',
        approvalStatus: 'approved',
        isKOL: true,
        tier: kol.tier || 'micro',
        currentTier: kol.tier || 'micro',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        campaigns: []
      }
      
      // Save profile
      await redis.call('JSON.SET', `profile:${profileId}`, '$', JSON.stringify(profile))
      await redis.set(`profile:handle:${kol.handle.toLowerCase()}`, profileId)
      
      // Also create old-style user entry for backward compatibility
      const userEntry = {
        id: profileId,
        twitterHandle: kol.handle,
        name: kol.name || kol.handle,
        profileImageUrl: kol.pfp || '',
        role: 'kol',
        approvalStatus: 'approved',
        tier: kol.tier || 'micro',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      
      await redis.call('JSON.SET', `user:${profileId}`, '$', JSON.stringify(userEntry))
      await redis.sadd(`idx:username:${kol.handle.toLowerCase()}`, profileId)
      
      console.log(`✓ Created profile for ${kol.handle} with ID: ${profileId}`)
    }
    
    console.log(`\nFixed ${kolsToFix.length} KOL profiles`)
    
  } catch (error) {
    console.error('Error fixing KOL profiles:', error)
  } finally {
    await redis.quit()
  }
}

// Run the fix
fixAllKOLs() 