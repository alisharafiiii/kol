import { redis } from '../lib/redis'
import { ProfileService } from '../lib/services/profile-service'
import { v4 as uuidv4 } from 'uuid'

async function fixKOLProfile(handle: string) {
  try {
    console.log(`Checking profile for KOL: ${handle}`)
    
    // Check if profile already exists
    const existingProfile = await ProfileService.getProfileByHandle(handle)
    if (existingProfile) {
      console.log(`Profile already exists for ${handle}`)
      return
    }
    
    // Find KOL data from campaigns
    console.log(`No profile found, searching in campaigns...`)
    const campaignIds = await redis.smembers('campaigns:all')
    let kolData: any = null
    let foundInCampaign: string | null = null
    
    for (const campaignId of campaignIds) {
      const campaign = await redis.json.get(campaignId, '$')
      const campaignData = campaign?.[0]
      
      if (campaignData?.kols) {
        const kol = campaignData.kols.find((k: any) => 
          k.handle?.toLowerCase() === handle.toLowerCase()
        )
        
        if (kol) {
          kolData = kol
          foundInCampaign = campaignData.name
          break
        }
      }
    }
    
    if (!kolData) {
      console.log(`KOL ${handle} not found in any campaign`)
      return
    }
    
    console.log(`Found KOL in campaign: ${foundInCampaign}`)
    console.log('KOL data:', kolData)
    
    // Create profile
    const profile = await ProfileService.saveProfile({
      id: uuidv4(),
      twitterHandle: kolData.handle,
      name: kolData.name || kolData.handle,
      profileImageUrl: kolData.pfp || '',
      role: 'kol',
      approvalStatus: 'approved',
      isKOL: true,
      tier: kolData.tier || 'micro',
      currentTier: kolData.tier || 'micro',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    
    console.log(`Created profile for ${handle} with ID: ${profile.id}`)
    
    // Also create the old-style user entry for backward compatibility
    const userId = `user:${profile.id}`
    const userEntry = {
      id: profile.id,
      twitterHandle: kolData.handle,
      name: kolData.name || kolData.handle,
      profileImageUrl: kolData.pfp || '',
      role: 'kol',
      approvalStatus: 'approved',
      tier: kolData.tier || 'micro',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    await redis.json.set(userId, '$', userEntry)
    await redis.sadd(`idx:username:${kolData.handle.toLowerCase()}`, profile.id)
    console.log(`Created backward-compatible user entry`)
    
  } catch (error) {
    console.error('Error fixing KOL profile:', error)
  }
}

// Run the fix for ted3166
if (process.argv[2]) {
  fixKOLProfile(process.argv[2]).then(() => {
    console.log('Done')
    process.exit(0)
  }).catch(err => {
    console.error('Failed:', err)
    process.exit(1)
  })
} else {
  console.log('Usage: npm run fix-kol-profile <handle>')
  console.log('Example: npm run fix-kol-profile ted3166')
  process.exit(1)
} 