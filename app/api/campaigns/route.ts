import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
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
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const data = await request.json()
    
    // Validate required fields
    if (!data.name || !data.startDate || !data.endDate) {
      return NextResponse.json(
        { error: 'Missing required fields' }, 
        { status: 400 }
      )
    }
    
    // Validate team members are approved users
    if (data.teamMembers && data.teamMembers.length > 0) {
      for (const handle of data.teamMembers) {
        const normalized = handle.replace('@','').toLowerCase()
        const ids = await redis.smembers(`idx:username:${normalized}`)
        if (!ids || ids.length === 0) {
          return NextResponse.json(
            { error: `Team member @${handle} not found` },
            { status: 400 }
          )
        }
        const profile = await redis.json.get(`user:${ids[0]}`)
        if (!profile || (profile as any).approvalStatus !== 'approved') {
          return NextResponse.json(
            { error: `Team member @${handle} is not approved` },
            { status: 400 }
          )
        }
      }
    }
    
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
    
    return NextResponse.json(campaign)
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
} 