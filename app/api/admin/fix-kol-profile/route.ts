import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { ProfileService } from '@/lib/services/profile-service'
import { v4 as uuidv4 } from 'uuid'
import { checkAuth } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    // Check auth - only admins can fix profiles
    const auth = await checkAuth(request, ['admin', 'core'])
    if (!auth.authenticated || !auth.hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { handle } = await request.json()
    
    if (!handle) {
      return NextResponse.json(
        { error: 'Handle is required' },
        { status: 400 }
      )
    }
    
    console.log(`[Fix KOL Profile] Checking profile for KOL: ${handle}`)
    
    // Check if profile already exists
    const existingProfile = await ProfileService.getProfileByHandle(handle)
    if (existingProfile) {
      console.log(`[Fix KOL Profile] Profile already exists for ${handle}`)
      return NextResponse.json({
        message: 'Profile already exists',
        profile: existingProfile
      })
    }
    
    // Find KOL data from campaigns
    console.log(`[Fix KOL Profile] No profile found, searching in campaigns...`)
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
      console.log(`[Fix KOL Profile] KOL ${handle} not found in any campaign`)
      return NextResponse.json(
        { error: 'KOL not found in any campaign' },
        { status: 404 }
      )
    }
    
    console.log(`[Fix KOL Profile] Found KOL in campaign: ${foundInCampaign}`)
    console.log('[Fix KOL Profile] KOL data:', kolData)
    
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
    
    console.log(`[Fix KOL Profile] Created profile for ${handle} with ID: ${profile.id}`)
    
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
    console.log(`[Fix KOL Profile] Created backward-compatible user entry`)
    
    return NextResponse.json({
      message: 'Profile created successfully',
      profile,
      foundInCampaign
    })
    
  } catch (error) {
    console.error('[Fix KOL Profile] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fix KOL profile' },
      { status: 500 }
    )
  }
} 