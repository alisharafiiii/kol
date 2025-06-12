import { redis } from '../lib/redis'
import { getCampaign } from '../lib/campaign'
import { CampaignKOLService } from '../lib/services/campaign-kol-service'

async function checkCampaignRecovery() {
  const campaignId = 'campaign:Te-1hZJ5AfwCwAEayvwLI'
  
  console.log('Checking campaign recovery options for:', campaignId)
  console.log('='.repeat(50))
  
  try {
    // 1. Check campaign data
    console.log('\n1. Checking campaign data:')
    const campaign = await getCampaign(campaignId)
    if (campaign) {
      console.log('Campaign found:', campaign.name)
      console.log('KOLs in campaign:', campaign.kols.length)
      console.log('Last updated:', campaign.updatedAt)
    } else {
      console.log('Campaign not found!')
    }
    
    // 2. Check CampaignKOLService data
    console.log('\n2. Checking CampaignKOLService data:')
    const serviceKols = await CampaignKOLService.getCampaignKOLs(campaignId)
    console.log('KOLs from service:', serviceKols.length)
    if (serviceKols.length > 0) {
      console.log('Found KOLs:')
      serviceKols.forEach(kol => {
        console.log(`- ${kol.kolHandle} (${kol.kolName}) - Stage: ${kol.stage}, Budget: ${kol.budget}`)
      })
    }
    
    // 3. Check Redis for campaign KOL set
    console.log('\n3. Checking Redis campaign KOL set:')
    const kolIds = await redis.smembers(`${campaignId}:kols`)
    console.log('KOL IDs in set:', kolIds.length)
    if (kolIds.length > 0) {
      console.log('KOL IDs:', kolIds)
    }
    
    // 4. Check for any campaign:kol:* keys
    console.log('\n4. Scanning for campaign:kol:* keys:')
    const scanStream = redis.scanStream({
      match: 'campaign:kol:*',
      count: 100
    })
    
    const campaignKOLKeys: string[] = []
    for await (const keys of scanStream) {
      campaignKOLKeys.push(...keys)
    }
    
    console.log('Found campaign KOL keys:', campaignKOLKeys.length)
    
    // Check which ones might belong to our campaign
    if (campaignKOLKeys.length > 0) {
      console.log('\nChecking for KOLs belonging to our campaign:')
      for (const key of campaignKOLKeys) {
        try {
          const kolData = await redis.json.get(key)
          if (kolData && (kolData as any).campaignId === campaignId) {
            console.log(`Found KOL: ${key}`)
            console.log(JSON.stringify(kolData, null, 2))
          }
        } catch (err) {
          // Ignore errors for individual keys
        }
      }
    }
    
    // 5. Check profiles for campaign participation
    console.log('\n5. Checking profiles for campaign participation:')
    const profileKeys = await redis.keys('profile:*')
    let foundProfiles = 0
    
    for (const profileKey of profileKeys) {
      try {
        const profile = await redis.json.get(profileKey)
        if (profile && (profile as any).campaigns) {
          const campaigns = (profile as any).campaigns
          const participation = campaigns.find((c: any) => c.campaignId === campaignId)
          if (participation) {
            foundProfiles++
            console.log(`\nProfile ${(profile as any).twitterHandle} participated in campaign:`)
            console.log('- Role:', participation.role)
            console.log('- Tier:', participation.tier)
            console.log('- Budget:', participation.budget)
            console.log('- Stage:', participation.stage)
          }
        }
      } catch (err) {
        // Ignore errors
      }
    }
    
    console.log(`\nTotal profiles with campaign participation: ${foundProfiles}`)
    
  } catch (error) {
    console.error('Error checking recovery:', error)
  }
  
  await redis.quit()
}

checkCampaignRecovery().catch(console.error) 