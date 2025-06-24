import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { createCampaign, getAllCampaigns, getUserCampaigns } from '@/lib/campaign'
import { redis } from '@/lib/redis'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const searchParams = request.nextUrl.searchParams
    const userOnly = searchParams.get('user') === 'true'
    
    if (userOnly && session?.user?.name) {
      // Get campaigns for logged in user
      try {
        const campaigns = await getUserCampaigns(session.user.name)
        return NextResponse.json(campaigns)
      } catch (redisError) {
        console.error('Redis error fetching user campaigns:', redisError)
        return NextResponse.json([]) // Return empty array when Redis is down
      }
    } else {
      // Get all campaigns
      try {
        const campaigns = await getAllCampaigns()
        return NextResponse.json(campaigns)
      } catch (redisError) {
        console.error('Redis error fetching all campaigns:', redisError)
        return NextResponse.json([]) // Return empty array when Redis is down
      }
    }
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json([]) // Return empty array instead of error
  }
}

export async function POST(request: NextRequest) {
  const requestId = Date.now() // Unique ID for this request
  console.log(`[Campaign API] POST request received (request ID: ${requestId})`)
  
  try {
    const session = await getServerSession(authOptions)
    console.log(`[Campaign API] Session user (request ${requestId}):`, session?.user?.name)
    
    if (!session?.user?.name) {
      console.log(`[Campaign API] Unauthorized - no session (request ${requestId})`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const data = await request.json()
    console.log(`[Campaign API] Request data (request ${requestId}):`, {
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      teamMembersCount: data.teamMembers?.length || 0,
      projectsCount: data.projects?.length || 0
    })
    
    // Validate required fields
    if (!data.name || !data.startDate || !data.endDate) {
      console.log(`[Campaign API] Missing required fields (request ${requestId})`)
      return NextResponse.json(
        { error: 'Missing required fields' }, 
        { status: 400 }
      )
    }
    
    // Validate team members are approved users
    if (data.teamMembers && data.teamMembers.length > 0) {
      console.log(`[Campaign API] Validating ${data.teamMembers.length} team members (request ${requestId})`)
      for (const handle of data.teamMembers) {
        const normalized = handle.replace('@','').toLowerCase()
        const ids = await redis.smembers(`idx:username:${normalized}`)
        if (!ids || ids.length === 0) {
          console.log(`[Campaign API] Team member @${handle} not found (request ${requestId})`)
          return NextResponse.json(
            { error: `Team member @${handle} not found` },
            { status: 400 }
          )
        }
        const profile = await redis.json.get(`user:${ids[0]}`)
        if (!profile || (profile as any).approvalStatus !== 'approved') {
          console.log(`[Campaign API] Team member @${handle} not approved (request ${requestId})`)
          return NextResponse.json(
            { error: `Team member @${handle} is not approved` },
            { status: 400 }
          )
        }
      }
    }
    
    console.log(`[Campaign API] Creating campaign in database (request ${requestId})...`)
    const campaign = await createCampaign({
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      chains: data.chains || ['Solana'],
      projects: data.projects || [],
      projectBudgets: data.projectBudgets || {},
      teamMembers: data.teamMembers || [],
      createdBy: (session.user as any).username || session.user.name
    })
    
    console.log(`[Campaign API] Campaign created successfully (request ${requestId}):`, {
      id: campaign.id,
      name: campaign.name,
      slug: campaign.slug
    })
    
    return NextResponse.json(campaign)
  } catch (error) {
    console.error(`[Campaign API] Error creating campaign (request ${requestId}):`, error)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
} 