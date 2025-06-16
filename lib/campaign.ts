import { redis } from './redis'
import { nanoid } from 'nanoid'
import { CampaignKOLService } from './services/campaign-kol-service'
import { ProfileService } from './services/profile-service'

export interface KOL {
  id: string
  handle: string
  name: string
  pfp?: string // Profile picture URL
  tier?: 'hero' | 'legend' | 'star' | 'rising' | 'micro' // KOL tier/badge
  budget?: string
  platform?: string[]
  stage?: 'reached out' | 'preparing' | 'posted' | 'done' | 'cancelled'
  device?: 'na' | 'on the way' | 'received' | 'owns' | 'sent before' | 'problem'
  payment?: 'pending' | 'approved' | 'rejected' | 'paid'
  lastUpdated?: Date
  views?: number
  likes?: number
  retweets?: number
  comments?: number
  contact?: string
  links?: string[]
  productId?: string // ID of the assigned product
  productCost?: number // Cost of the product (auto-filled from product price)
  productAssignmentId?: string // ID of the product assignment record
  productQuantity?: number // Quantity of the product (default 1)
}

export interface Campaign {
  id: string
  name: string
  slug: string // URL-friendly version of name
  startDate: string
  endDate: string
  chains?: string[] // blockchain chains for the campaign (multi-select)
  projects: string[] // project IDs from scout
  projectBudgets?: Record<string, { usd: string; devices: string }> // budgets per project
  teamMembers: string[] // twitter handles with edit access
  kols: KOL[]
  createdBy: string
  createdAt: string
  updatedAt: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  brief?: string // Rich text campaign brief
  briefUpdatedAt?: string
  briefUpdatedBy?: string
}

// Generate URL-friendly slug from campaign name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
}

// Create a new campaign
export async function createCampaign(data: {
  name: string
  startDate: string
  endDate: string
  chains?: string[]
  projects: string[]
  projectBudgets?: Record<string, { usd: string; devices: string }>
  teamMembers: string[]
  createdBy: string
}): Promise<Campaign> {
  const id = `campaign:${nanoid()}`
  const slug = generateSlug(data.name)
  
  // Check if slug already exists
  let finalSlug = slug
  let counter = 1
  while (await redis.exists(`campaign:slug:${finalSlug}`)) {
    finalSlug = `${slug}-${counter}`
    counter++
  }
  
  const campaign: Campaign = {
    id,
    name: data.name,
    slug: finalSlug,
    startDate: data.startDate,
    endDate: data.endDate,
    chains: data.chains,
    projects: data.projects,
    projectBudgets: data.projectBudgets || {},
    teamMembers: data.teamMembers,
    kols: [],
    createdBy: data.createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft'
  }
  
  // Save campaign
  await redis.json.set(id, '$', campaign as any)
  
  // Save slug mapping
  await redis.set(`campaign:slug:${finalSlug}`, id)
  
  // Add to campaigns list
  await redis.sadd('campaigns:all', id)
  
  // Add to creator's campaigns
  await redis.sadd(`campaigns:creator:${data.createdBy}`, id)
  
  return campaign
}

// Get campaign by ID
export async function getCampaign(id: string): Promise<Campaign | null> {
  try {
    const campaign = await redis.json.get(id, '$') as any
    const campaignData = campaign?.[0] || null
    
    if (campaignData) {
      // First, try to load KOLs from CampaignKOLService (new format)
      const serviceKols = await CampaignKOLService.getCampaignKOLs(id)
      
      if (serviceKols.length > 0) {
        // Use KOLs from service (new format)
        campaignData.kols = serviceKols.map(kol => ({
          id: kol.id,
          handle: kol.kolHandle,
          name: kol.kolName,
          pfp: kol.kolImage,
          tier: kol.tier,
          stage: kol.stage,
          device: kol.deviceStatus as any,
          budget: kol.budget.toString(),
          payment: kol.paymentStatus as any,
          views: kol.totalViews || 0,
          likes: 0, // Not stored in CampaignKOL
          retweets: 0, // Not stored in CampaignKOL
          comments: 0, // Not stored in CampaignKOL
          contact: '', // Not stored in CampaignKOL
          links: kol.links || [],
          platform: Array.isArray(kol.platform) ? kol.platform : [kol.platform],
          lastUpdated: kol.addedAt,
          // Product fields not in CampaignKOL yet
          productId: undefined,
          productAssignmentId: undefined,
          productCost: undefined
        }))
      }
      // If no KOLs in service, campaignData.kols will use the existing data (old format)
    }
    
    return campaignData
  } catch (error) {
    console.error('Error getting campaign:', error)
    return null
  }
}

// Get campaign by slug
export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  const id = await redis.get(`campaign:slug:${slug}`) as string | null
  if (!id) return null
  return getCampaign(id)
}

// Get all campaigns
export async function getAllCampaigns(): Promise<Campaign[]> {
  const ids = await redis.smembers('campaigns:all')
  const campaigns: Campaign[] = []
  
  for (const id of ids) {
    const campaign = await getCampaign(id)
    if (campaign) campaigns.push(campaign)
  }
  
  return campaigns.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

// Get campaigns for a specific user
export async function getUserCampaigns(userHandle: string): Promise<Campaign[]> {
  const allCampaigns = await getAllCampaigns()
  
  // Return campaigns where user is creator or team member
  return allCampaigns.filter(campaign => 
    campaign.createdBy === userHandle || 
    campaign.teamMembers.includes(userHandle)
  )
}

// Update campaign
export async function updateCampaign(
  id: string, 
  updates: Partial<Campaign>,
  userHandle: string,
  sessionRole?: string
): Promise<Campaign | null> {
  const campaign = await getCampaign(id)
  if (!campaign) return null
  
  console.log('Updating campaign:', {
    id,
    userHandle,
    sessionRole,
    currentCampaign: {
      createdBy: campaign.createdBy,
      teamMembers: campaign.teamMembers,
      chains: campaign.chains
    },
    updates: {
      chains: updates.chains,
      teamMembers: updates.teamMembers
    }
  })
  
  // Check if user is admin based on session role
  const isSessionAdmin = sessionRole === 'admin' || sessionRole === 'core'
  
  // Also check profile service for backwards compatibility
  const normalizedHandle = userHandle.replace('@', '').toLowerCase()
  const profile = await ProfileService.getProfileByHandle(normalizedHandle)
  console.log('User profile lookup:', {
    userHandle,
    normalizedHandle,
    profileFound: !!profile,
    profileRole: profile?.role,
    sessionRole,
    isSessionAdmin
  })
  
  const isAdmin = isSessionAdmin || profile?.role === 'admin' || profile?.role === 'core'
  const isCreator = campaign.createdBy === userHandle || campaign.createdBy === normalizedHandle
  const isTeamMember = campaign.teamMembers.includes(userHandle) || campaign.teamMembers.includes(normalizedHandle)
  
  console.log('Authorization check:', {
    isAdmin,
    isSessionAdmin,
    isCreator,
    isTeamMember,
    authorized: isAdmin || isCreator || isTeamMember
  })
  
  // Check if user has permission to edit
  if (!isAdmin && !isCreator && !isTeamMember) {
    console.error('Unauthorized update attempt:', {
      userHandle,
      normalizedHandle,
      campaignId: id,
      profileRole: profile?.role,
      sessionRole,
      createdBy: campaign.createdBy,
      teamMembers: campaign.teamMembers
    })
    throw new Error('Unauthorized')
  }
  
  // If name is being updated, update slug too
  if (updates.name && updates.name !== campaign.name) {
    const newSlug = generateSlug(updates.name)
    let finalSlug = newSlug
    let counter = 1
    
    // Check if new slug conflicts
    while (await redis.exists(`campaign:slug:${finalSlug}`) && finalSlug !== campaign.slug) {
      finalSlug = `${newSlug}-${counter}`
      counter++
    }
    
    // Delete old slug mapping
    await redis.del(`campaign:slug:${campaign.slug}`)
    
    // Set new slug
    updates.slug = finalSlug
    await redis.set(`campaign:slug:${finalSlug}`, id)
  }
  
  const updatedCampaign = {
    ...campaign,
    ...updates,
    updatedAt: new Date().toISOString()
  }
  
  console.log('Saving updated campaign:', {
    chains: updatedCampaign.chains,
    teamMembers: updatedCampaign.teamMembers
  })
  
  await redis.json.set(id, '$', updatedCampaign as any)
  return updatedCampaign
}

// Add KOL to campaign
export async function addKOLToCampaign(
  campaignId: string,
  kol: Omit<KOL, 'id' | 'lastUpdated'>,
  userHandle: string,
  sessionRole?: string
): Promise<Campaign | null> {
  const campaign = await getCampaign(campaignId)
  if (!campaign) return null
  
  // Check if user is admin based on session role
  const isSessionAdmin = sessionRole === 'admin' || sessionRole === 'core'
  
  // Also check profile service
  const normalizedHandle = userHandle.replace('@', '').toLowerCase()
  const profile = await ProfileService.getProfileByHandle(normalizedHandle)
  const isAdmin = isSessionAdmin || profile?.role === 'admin' || profile?.role === 'core'
  
  // Check permissions
  const isCreator = campaign.createdBy === userHandle || campaign.createdBy === normalizedHandle
  const isTeamMember = campaign.teamMembers.includes(userHandle) || campaign.teamMembers.includes(normalizedHandle)
  
  if (!isAdmin && !isCreator && !isTeamMember) {
    throw new Error('Unauthorized')
  }
  
  const newKOL: KOL = {
    ...kol,
    id: nanoid(),
    lastUpdated: new Date(),
    productId: kol.productId,
    productAssignmentId: kol.productAssignmentId,
    productCost: kol.productCost
  }
  
  campaign.kols.push(newKOL)
  campaign.updatedAt = new Date().toISOString()
  
  await redis.json.set(campaignId, '$', campaign as any)
  return campaign
}

// Update KOL in campaign
export async function updateKOLInCampaign(
  campaignId: string,
  kolId: string,
  updates: Partial<KOL>,
  userHandle: string,
  sessionRole?: string
): Promise<Campaign | null> {
  const campaign = await getCampaign(campaignId)
  if (!campaign) return null
  
  // Check if user is admin based on session role
  const isSessionAdmin = sessionRole === 'admin' || sessionRole === 'core'
  
  // Also check profile service
  const normalizedHandle = userHandle.replace('@', '').toLowerCase()
  const profile = await ProfileService.getProfileByHandle(normalizedHandle)
  const isAdmin = isSessionAdmin || profile?.role === 'admin' || profile?.role === 'core'
  
  // Check permissions
  const isCreator = campaign.createdBy === userHandle || campaign.createdBy === normalizedHandle
  const isTeamMember = campaign.teamMembers.includes(userHandle) || campaign.teamMembers.includes(normalizedHandle)
  
  if (!isAdmin && !isCreator && !isTeamMember) {
    throw new Error('Unauthorized')
  }
  
  const kolIndex = campaign.kols.findIndex(k => k.id === kolId)
  if (kolIndex === -1) return null
  
  campaign.kols[kolIndex] = {
    ...campaign.kols[kolIndex],
    ...updates,
    lastUpdated: new Date()
  }
  
  campaign.updatedAt = new Date().toISOString()
  
  await redis.json.set(campaignId, '$', campaign as any)
  return campaign
}

// Remove KOL from campaign
export async function removeKOLFromCampaign(
  campaignId: string,
  kolId: string,
  userHandle: string,
  sessionRole?: string
): Promise<Campaign | null> {
  const campaign = await getCampaign(campaignId)
  if (!campaign) return null
  
  // Check if user is admin based on session role
  const isSessionAdmin = sessionRole === 'admin' || sessionRole === 'core'
  
  // Also check profile service
  const normalizedHandle = userHandle.replace('@', '').toLowerCase()
  const profile = await ProfileService.getProfileByHandle(normalizedHandle)
  const isAdmin = isSessionAdmin || profile?.role === 'admin' || profile?.role === 'core'
  
  // Check permissions
  const isCreator = campaign.createdBy === userHandle || campaign.createdBy === normalizedHandle
  const isTeamMember = campaign.teamMembers.includes(userHandle) || campaign.teamMembers.includes(normalizedHandle)
  
  if (!isAdmin && !isCreator && !isTeamMember) {
    throw new Error('Unauthorized')
  }
  
  campaign.kols = campaign.kols.filter(k => k.id !== kolId)
  campaign.updatedAt = new Date().toISOString()
  
  await redis.json.set(campaignId, '$', campaign as any)
  return campaign
}

// Update campaign brief
export async function updateCampaignBrief(
  campaignId: string,
  brief: string,
  userHandle: string
): Promise<Campaign | null> {
  const campaign = await getCampaign(campaignId)
  if (!campaign) return null
  
  // Check if user is admin
  const normalizedHandle = userHandle.replace('@', '').toLowerCase()
  const profile = await ProfileService.getProfileByHandle(normalizedHandle)
  const isAdmin = profile?.role === 'admin' || profile?.role === 'core'
  
  // Check permissions - allow admin, creator, or team member
  if (!isAdmin && campaign.createdBy !== userHandle && !campaign.teamMembers.includes(userHandle)) {
    throw new Error('Unauthorized')
  }
  
  campaign.brief = brief
  campaign.briefUpdatedAt = new Date().toISOString()
  campaign.briefUpdatedBy = userHandle
  campaign.updatedAt = new Date().toISOString()
  
  await redis.json.set(campaignId, '$', campaign as any)
  return campaign
}

// Delete campaign
export async function deleteCampaign(id: string, userHandle: string): Promise<boolean> {
  const campaign = await getCampaign(id)
  if (!campaign) return false
  
  // Only creator can delete
  if (campaign.createdBy !== userHandle) {
    throw new Error('Unauthorized')
  }
  
  // Delete campaign data
  await redis.del(id)
  
  // Delete slug mapping
  await redis.del(`campaign:slug:${campaign.slug}`)
  
  // Remove from lists
  await redis.srem('campaigns:all', id)
  await redis.srem(`campaigns:creator:${campaign.createdBy}`, id)
  
  return true
} 