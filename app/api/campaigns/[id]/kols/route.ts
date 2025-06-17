import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { CampaignKOLService } from '@/lib/services/campaign-kol-service'
import { checkAuth } from '@/lib/auth-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id
    
    // Get KOLs from both sources
    const serviceKols = await CampaignKOLService.getCampaignKOLs(campaignId)
    
    // Also check campaign object for any embedded KOLs
    const { getCampaign } = await import('@/lib/campaign')
    const campaign = await getCampaign(campaignId)
    
    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    // Merge KOLs from both sources, avoiding duplicates
    const kolMap = new Map()
    
    // Add service KOLs
    serviceKols.forEach(kol => {
      if (kol.id) {
        kolMap.set(kol.id, kol)
      }
    })
    
    // Add campaign embedded KOLs
    if (campaign.kols && Array.isArray(campaign.kols)) {
      campaign.kols.forEach(kol => {
        if (kol.id && !kolMap.has(kol.id)) {
          kolMap.set(kol.id, kol)
        }
      })
    }
    
    // Return all unique KOLs
    return NextResponse.json(Array.from(kolMap.values()))
  } catch (error) {
    console.error('Error fetching campaign KOLs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch KOLs' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id
    console.log('[KOL POST] Campaign ID:', campaignId)
    
    // Check auth - only admin, core, and team can add KOLs
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
    
    const data = await request.json()
    console.log('[KOL POST] Request data:', data)
    
    // Validate required fields
    if (!data.handle || !data.name) {
      return NextResponse.json(
        { error: 'Missing required fields: handle and name are required' },
        { status: 400 }
      )
    }
    
    // Parse contact field if provided
    if (data.contact) {
      data.contact = CampaignKOLService.parseContact(data.contact)
    }
    
    // Prepare KOL data for campaign library
    const kolData = {
      handle: data.handle.replace('@', ''),
      name: data.name,
      pfp: data.pfp || data.image || '',
      tier: data.tier || 'micro',
      budget: data.budget || '',
      platform: Array.isArray(data.platform) ? data.platform : (data.platform ? [data.platform] : ['x']),
      stage: data.stage || 'reached out',
      device: data.device || 'na',
      payment: data.payment || 'pending',
      views: data.views || 0,
      links: data.links || [],
      contact: data.contact || '',
      productId: data.productId || '',
      productCost: data.productCost || 0,
      productQuantity: data.productQuantity || 1
    }
    
    // Create or ensure user profile exists for this KOL
    const { ProfileService } = await import('@/lib/services/profile-service')
    let profile = await ProfileService.getProfileByHandle(kolData.handle)
    
    if (!profile) {
      console.log('[KOL POST] Creating new user profile for:', kolData.handle)
      // Create a basic profile for the KOL
      const { v4: uuidv4 } = await import('uuid')
      profile = await ProfileService.saveProfile({
        id: uuidv4(),
        twitterHandle: kolData.handle,
        name: kolData.name,
        profileImageUrl: kolData.pfp,
        role: 'kol',
        approvalStatus: 'approved', // Auto-approve KOLs added to campaigns
        isKOL: true,
        tier: kolData.tier as any,
        currentTier: kolData.tier as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      console.log('[KOL POST] Created profile with ID:', profile.id)
    } else {
      console.log('[KOL POST] Found existing profile for:', kolData.handle, 'ID:', profile.id)
    }
    
    // Use the campaign library's function which properly updates the embedded KOL array
    const { addKOLToCampaign, updateKOLInCampaign, getCampaign } = await import('@/lib/campaign')
    const userHandle = auth.user?.twitterHandle || auth.user?.name || 'unknown'
    const userRole = auth.role || 'user'
    const isAdmin = ['admin', 'core'].includes(userRole)
    
    console.log('[DEBUG] Add KOL Auth:', {
      userHandle,
      userRole,
      isAdmin,
      authObj: auth
    })
    
    // Get the campaign first to check for existing KOL
    const campaign = await getCampaign(campaignId)
    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    // Check if KOL with the same handle already exists
    const existingKOL = campaign.kols.find(k => k.handle.toLowerCase() === kolData.handle.toLowerCase())
    
    // Check if there's an existing entry with the same handle AND product
    const existingKOLWithSameProduct = campaign.kols.find(k => 
      k.handle.toLowerCase() === kolData.handle.toLowerCase() && 
      k.productId === kolData.productId
    )
    
    if (existingKOLWithSameProduct) {
      // Update the existing entry with the same handle and product
      console.log('[DEBUG] Found existing KOL with same handle and product, updating:', kolData.handle, 'Product:', kolData.productId)
      
      const updates = {
        ...kolData,
        id: existingKOLWithSameProduct.id,
        lastUpdated: new Date()
      }
      
      // For admins, bypass the permission check
      if (isAdmin) {
        const kolIndex = campaign.kols.findIndex(k => k.id === existingKOLWithSameProduct.id)
        if (kolIndex !== -1) {
          campaign.kols[kolIndex] = { ...existingKOLWithSameProduct, ...updates }
          campaign.updatedAt = new Date().toISOString()
          
          const { redis } = await import('@/lib/redis')
          await redis.json.set(campaignId, '$', campaign as any)
          
          return NextResponse.json(campaign.kols[kolIndex])
        }
      } else {
        // For non-admins, use the regular function with permission checks
        const updatedCampaign = await updateKOLInCampaign(campaignId, existingKOLWithSameProduct.id, updates, userHandle, userRole)
        
        if (!updatedCampaign) {
          return NextResponse.json(
            { error: 'Failed to update existing KOL' },
            { status: 500 }
          )
        }
        
        const updatedKOL = updatedCampaign.kols.find(k => k.id === existingKOLWithSameProduct.id)
        return NextResponse.json(updatedKOL)
      }
    } else if (existingKOL && !kolData.productId) {
      // If no product is specified and there's an existing KOL, update the first entry without a product
      const existingKOLWithoutProduct = campaign.kols.find(k => 
        k.handle.toLowerCase() === kolData.handle.toLowerCase() && 
        !k.productId
      )
      
      if (existingKOLWithoutProduct) {
        console.log('[DEBUG] Found existing KOL without product, updating:', kolData.handle)
        
        const updates = {
          ...kolData,
          id: existingKOLWithoutProduct.id,
          lastUpdated: new Date()
        }
        
        // For admins, bypass the permission check
        if (isAdmin) {
          const kolIndex = campaign.kols.findIndex(k => k.id === existingKOLWithoutProduct.id)
          if (kolIndex !== -1) {
            campaign.kols[kolIndex] = { ...existingKOLWithoutProduct, ...updates }
            campaign.updatedAt = new Date().toISOString()
            
            const { redis } = await import('@/lib/redis')
            await redis.json.set(campaignId, '$', campaign as any)
            
            return NextResponse.json(campaign.kols[kolIndex])
          }
        } else {
          // For non-admins, use the regular function with permission checks
          const updatedCampaign = await updateKOLInCampaign(campaignId, existingKOLWithoutProduct.id, updates, userHandle, userRole)
          
          if (!updatedCampaign) {
            return NextResponse.json(
              { error: 'Failed to update existing KOL' },
              { status: 500 }
            )
          }
          
          const updatedKOL = updatedCampaign.kols.find(k => k.id === existingKOLWithoutProduct.id)
          return NextResponse.json(updatedKOL)
        }
      } else {
        // Create new entry
        console.log('[DEBUG] Creating new KOL entry without product for handle:', kolData.handle)
        
        // For admins, bypass the permission check by updating the campaign directly
        if (isAdmin) {
          const { nanoid } = await import('nanoid')
          const newKOL = {
            ...kolData,
            id: nanoid(),
            lastUpdated: new Date(),
          }
          
          campaign.kols.push(newKOL)
          campaign.updatedAt = new Date().toISOString()
          
          const { redis } = await import('@/lib/redis')
          await redis.json.set(campaignId, '$', campaign as any)
          
          return NextResponse.json(newKOL)
        } else {
          // For non-admins, use the regular function with permission checks
          const updatedCampaign = await addKOLToCampaign(campaignId, kolData, userHandle, userRole)
          
          if (!updatedCampaign) {
            return NextResponse.json(
              { error: 'Campaign not found' },
              { status: 404 }
            )
          }
          
          // Return the newly added KOL from the campaign
          const newKOL = updatedCampaign.kols[updatedCampaign.kols.length - 1]
          return NextResponse.json(newKOL)
        }
      }
    } else {
      // No existing KOL with this handle, or new product for existing KOL - create new entry
      console.log('[DEBUG] Creating new KOL entry with handle:', kolData.handle, 'Product:', kolData.productId)
      
      // For admins, bypass the permission check by updating the campaign directly
      if (isAdmin) {
        const { nanoid } = await import('nanoid')
        const newKOL = {
          ...kolData,
          id: nanoid(),
          lastUpdated: new Date(),
        }
        
        campaign.kols.push(newKOL)
        campaign.updatedAt = new Date().toISOString()
        
        const { redis } = await import('@/lib/redis')
        await redis.json.set(campaignId, '$', campaign as any)
        
        return NextResponse.json(newKOL)
      } else {
        // For non-admins, use the regular function with permission checks
        const updatedCampaign = await addKOLToCampaign(campaignId, kolData, userHandle, userRole)
        
        if (!updatedCampaign) {
          return NextResponse.json(
            { error: 'Campaign not found' },
            { status: 404 }
          )
        }
        
        // Return the newly added KOL from the campaign
        const newKOL = updatedCampaign.kols[updatedCampaign.kols.length - 1]
        return NextResponse.json(newKOL)
      }
    }
  } catch (error) {
    console.error('Error adding KOL to campaign:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Failed to add KOL' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const { kolId, ...updates } = await request.json()
    
    console.log('[DEBUG] KOL Update Request:', {
      campaignId,
      kolId,
      updates,
      productIdType: typeof updates.productId,
      productIdValue: updates.productId
    })
    
    if (!kolId) {
      return NextResponse.json(
        { error: 'KOL ID is required' },
        { status: 400 }
      )
    }
    
    // Parse contact field if updated
    if (updates.contact) {
      updates.contact = CampaignKOLService.parseContact(updates.contact)
    }
    
    // Handle null values for product fields
    const cleanedUpdates = { ...updates }
    
    // Check if productId is null and handle removal
    if (cleanedUpdates.productId === null || cleanedUpdates.productId === 'null') {
      console.log('[DEBUG] Removing product fields')
      // Don't include these fields in the update - let the update function handle removal
      cleanedUpdates.productId = ''  // Set to empty string instead of null
      cleanedUpdates.productCost = 0
      cleanedUpdates.productAssignmentId = ''
    }
    
    console.log('[DEBUG] Cleaned updates:', cleanedUpdates)
    
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
      
      // Handle null values for product fields
      const currentKol = campaign.kols[kolIndex]
      const updatedKol = { ...currentKol }
      
      // Apply updates
      Object.keys(cleanedUpdates).forEach(key => {
        (updatedKol as any)[key] = (cleanedUpdates as any)[key]
      })
      
      // If productId is being set to empty, also clear related fields
      if (cleanedUpdates.productId === '') {
        updatedKol.productId = ''
        updatedKol.productCost = 0
        updatedKol.productAssignmentId = ''
      }
      
      updatedKol.lastUpdated = new Date()
      campaign.kols[kolIndex] = updatedKol
      campaign.updatedAt = new Date().toISOString()
      
      const { redis } = await import('@/lib/redis')
      await redis.json.set(campaignId, '$', campaign as any)
      
      // Try to update in the service's data structure, but don't fail if it doesn't exist
      try {
        await CampaignKOLService.updateCampaignKOL(kolId, cleanedUpdates)
      } catch (serviceError) {
        console.log('[DEBUG] KOL not found in service structure, only exists in campaign:', serviceError)
        // This is OK - the KOL might only exist in the campaign's embedded array
      }
      
      // Return the updated KOL
      return NextResponse.json(campaign.kols[kolIndex])
    } else {
      // For non-admins, use the regular function with permission checks
      const updatedCampaign = await updateKOLInCampaign(campaignId, kolId, cleanedUpdates, userHandle, userRole)
      
      if (!updatedCampaign) {
        return NextResponse.json(
          { error: 'Campaign or KOL not found' },
          { status: 404 }
        )
      }
      
      // Try to update in the service's data structure, but don't fail if it doesn't exist
      try {
        await CampaignKOLService.updateCampaignKOL(kolId, cleanedUpdates)
      } catch (serviceError) {
        console.log('[DEBUG] KOL not found in service structure, only exists in campaign:', serviceError)
        // This is OK - the KOL might only exist in the campaign's embedded array
      }
      
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check auth
    const auth = await checkAuth(request, ['admin', 'core'])
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
    const { kolId } = await request.json()
    
    if (!kolId) {
      return NextResponse.json(
        { error: 'KOL ID is required' },
        { status: 400 }
      )
    }
    
    const userHandle = auth.user?.twitterHandle || auth.user?.name || 'unknown'
    const userRole = auth.role || 'user'
    const isAdmin = ['admin', 'core'].includes(userRole)
    
    // Get the campaign first
    const { getCampaign } = await import('@/lib/campaign')
    const campaign = await getCampaign(campaignId)
    
    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    // For admins, bypass the permission check by updating the campaign directly
    if (isAdmin) {
      campaign.kols = campaign.kols.filter(k => k.id !== kolId)
      campaign.updatedAt = new Date().toISOString()
      
      const { redis } = await import('@/lib/redis')
      await redis.json.set(campaignId, '$', campaign as any)
    } else {
      // For non-admins, use the regular function with permission checks
      const { removeKOLFromCampaign } = await import('@/lib/campaign')
      const updatedCampaign = await removeKOLFromCampaign(campaignId, kolId, userHandle, userRole)
      
      if (!updatedCampaign) {
        return NextResponse.json(
          { error: 'Failed to remove KOL' },
          { status: 400 }
        )
      }
    }
    
    // Also remove from the service's data structure to keep them in sync
    await CampaignKOLService.removeKOLFromCampaign(campaignId, kolId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing KOL:', error)
    return NextResponse.json(
      { error: 'Failed to remove KOL' },
      { status: 500 }
    )
  }
} 