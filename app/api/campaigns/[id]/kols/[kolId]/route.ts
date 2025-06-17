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
    
    console.log('[KOL Update] Request:', {
      campaignId,
      kolId,
      updates,
      auth: {
        user: auth.user?.name,
        twitterHandle: auth.user?.twitterHandle,
        role: auth.role
      }
    })
    
    // Parse contact field if updated
    if (updates.contact) {
      updates.contact = CampaignKOLService.parseContact(updates.contact)
    }
    
    // Use the campaign library's function which properly updates the embedded KOL array
    const { updateKOLInCampaign, getCampaign } = await import('@/lib/campaign')
    const userHandle = auth.user?.twitterHandle || auth.user?.name || 'unknown'
    const userRole = auth.role || 'user'
    const isAdmin = ['admin', 'core'].includes(userRole)
    
    console.log('[KOL Update] User info:', {
      userHandle,
      userRole,
      isAdmin
    })
    
    // For admins, bypass the permission check by updating the campaign directly
    if (isAdmin) {
      const campaign = await getCampaign(campaignId)
      if (!campaign) {
        console.error('[KOL Update] Campaign not found:', campaignId)
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        )
      }
      
      const kolIndex = campaign.kols.findIndex(k => k.id === kolId)
      if (kolIndex === -1) {
        console.error('[KOL Update] KOL not found:', kolId)
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
      try {
        // Map the KOL fields to CampaignKOL fields
        const campaignKOLUpdates: any = {}
        
        if (updates.stage) campaignKOLUpdates.stage = updates.stage.replace(' ', '_') // Convert "reached out" to "reached_out"
        if (updates.device) campaignKOLUpdates.deviceStatus = updates.device
        if (updates.payment) campaignKOLUpdates.paymentStatus = updates.payment
        if (updates.budget) campaignKOLUpdates.budget = parseFloat(updates.budget.replace(/[^0-9.-]/g, '')) || 0
        if (updates.links) campaignKOLUpdates.links = updates.links
        if (updates.platform) campaignKOLUpdates.platform = Array.isArray(updates.platform) ? updates.platform[0] : updates.platform
        if (updates.views !== undefined) campaignKOLUpdates.totalViews = updates.views
        
        await CampaignKOLService.updateCampaignKOL(kolId, campaignKOLUpdates)
      } catch (serviceError) {
        console.error('[KOL Update] CampaignKOLService error:', serviceError)
        // Don't fail the whole update if service update fails
      }
      
      console.log('[KOL Update] Admin update successful')
      
      // Return the updated KOL
      return NextResponse.json(campaign.kols[kolIndex])
    } else {
      // For non-admins, use the regular function with permission checks
      try {
        const updatedCampaign = await updateKOLInCampaign(campaignId, kolId, updates, userHandle, userRole)
        
        if (!updatedCampaign) {
          console.error('[KOL Update] updateKOLInCampaign returned null')
          return NextResponse.json(
            { error: 'Campaign or KOL not found' },
            { status: 404 }
          )
        }
        
        // Also update in the service's data structure to keep them in sync
        try {
          // Map the KOL fields to CampaignKOL fields
          const campaignKOLUpdates: any = {}
          
          if (updates.stage) campaignKOLUpdates.stage = updates.stage.replace(' ', '_') // Convert "reached out" to "reached_out"
          if (updates.device) campaignKOLUpdates.deviceStatus = updates.device
          if (updates.payment) campaignKOLUpdates.paymentStatus = updates.payment
          if (updates.budget) campaignKOLUpdates.budget = parseFloat(updates.budget.replace(/[^0-9.-]/g, '')) || 0
          if (updates.links) campaignKOLUpdates.links = updates.links
          if (updates.platform) campaignKOLUpdates.platform = Array.isArray(updates.platform) ? updates.platform[0] : updates.platform
          if (updates.views !== undefined) campaignKOLUpdates.totalViews = updates.views
          
          await CampaignKOLService.updateCampaignKOL(kolId, campaignKOLUpdates)
        } catch (serviceError) {
          console.error('[KOL Update] CampaignKOLService error:', serviceError)
          // Don't fail the whole update if service update fails
        }
        
        console.log('[KOL Update] Non-admin update successful')
        
        // Return the updated KOL
        const updatedKOL = updatedCampaign.kols.find(k => k.id === kolId)
        return NextResponse.json(updatedKOL)
      } catch (updateError: any) {
        console.error('[KOL Update] updateKOLInCampaign error:', updateError.message)
        if (updateError.message === 'Unauthorized') {
          return NextResponse.json(
            { error: 'You do not have permission to edit this campaign' },
            { status: 403 }
          )
        }
        throw updateError
      }
    }
  } catch (error: any) {
    console.error('[KOL Update] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update KOL' },
      { status: 500 }
    )
  }
} 