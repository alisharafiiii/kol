import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/auth-utils'
import { CampaignKOLService } from '@/lib/services/campaign-kol-service'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; kolId: string } }
) {
  try {
    // Check auth
    const auth = await checkAuth(request, ['admin', 'core', 'team'])
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    if (!auth.hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }
    
    const campaignId = params.id
    const kolId = params.kolId
    const updates = await request.json()
    
    // Parse contact field if updated
    if (updates.contact) {
      updates.contact = CampaignKOLService.parseContact(updates.contact)
    }
    
    // Use the campaign library's function which properly updates the embedded KOL array
    const { updateKOLInCampaign, getCampaign } = await import('@/lib/campaign')
    const userHandle = auth.user?.twitterHandle || auth.user?.name || 'unknown'
    const userRole = auth.role || 'user'
    const isAdmin = ['admin', 'core'].includes(userRole)
    
    // For admins, bypass the permission check by updating the campaign directly
    if (isAdmin) {
      const campaign = await getCampaign(campaignId)
      if (!campaign) {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        )
      }
      
      const kolIndex = campaign.kols.findIndex(k => k.id === kolId)
      if (kolIndex === -1) {
        return NextResponse.json(
          { error: 'KOL not found' },
          { status: 404 }
        )
      }
      
      campaign.kols[kolIndex] = {
        ...campaign.kols[kolIndex],
        ...updates,
        lastUpdated: new Date()
      }
      
      campaign.updatedAt = new Date().toISOString()
      
      const { redis } = await import('@/lib/redis')
      await redis.json.set(campaignId, '$', campaign as any)
      
      // Also update in the service's data structure to keep them in sync
      await CampaignKOLService.updateCampaignKOL(kolId, updates)
      
      // Return the updated KOL
      return NextResponse.json(campaign.kols[kolIndex])
    } else {
      // For non-admins, use the regular function with permission checks
      const updatedCampaign = await updateKOLInCampaign(campaignId, kolId, updates, userHandle)
      
      if (!updatedCampaign) {
        return NextResponse.json(
          { error: 'Campaign or KOL not found' },
          { status: 404 }
        )
      }
      
      // Also update in the service's data structure to keep them in sync
      await CampaignKOLService.updateCampaignKOL(kolId, updates)
      
      // Return the updated KOL
      const updatedKOL = updatedCampaign.kols.find(k => k.id === kolId)
      return NextResponse.json(updatedKOL)
    }
  } catch (error) {
    console.error('Error updating KOL:', error)
    return NextResponse.json(
      { error: 'Failed to update KOL' },
      { status: 500 }
    )
  }
} 