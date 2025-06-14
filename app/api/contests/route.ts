import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { ContestService } from '@/lib/services/contest-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as any
    const visibility = searchParams.get('visibility') as any
    
    console.log('GET /api/contests - Filters:', { status, visibility })
    
    const contests = await ContestService.getContests({
      status,
      visibility
    })
    
    console.log('GET /api/contests - Found contests:', contests.length)
    
    // Log each contest's time range
    const now = new Date()
    contests.forEach(contest => {
      const start = new Date(contest.startTime)
      const end = new Date(contest.endTime)
      const isInTimeRange = now >= start && now <= end
      console.log(`Contest "${contest.name}":`, {
        status: contest.status,
        visibility: contest.visibility,
        start: start.toISOString(),
        end: end.toISOString(),
        now: now.toISOString(),
        isInTimeRange
      })
    })
    
    return NextResponse.json(contests)
  } catch (error) {
    console.error('Error fetching contests:', error)
    return NextResponse.json({ error: 'Failed to fetch contests' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    console.log('Contest API - Session:', JSON.stringify(session, null, 2))
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user is admin - check multiple possible locations
    const twitterHandle = (session as any)?.twitterHandle || 
                         (session as any)?.user?.twitterHandle ||
                         session?.user?.name ||
                         (session as any)?.user?.username;
    
    console.log('Contest API - Twitter handle:', twitterHandle)
    
    // HARDCODED CHECK for sharafi_eth
    const normalizedHandle = twitterHandle?.toLowerCase().replace('@', '');
    const isAdmin = normalizedHandle === 'sharafi_eth';
    
    console.log('Contest API - Is admin?', isAdmin)
    
    if (!isAdmin) {
      // Try checking role as fallback
      const userRole = (session as any)?.user?.role || (session as any)?.role
      if (userRole !== 'admin') {
        return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
      }
    }
    
    const data = await request.json()
    console.log('Contest API - Creating contest with data:', data)
    
    // Log the exact values being saved
    console.log('Contest API - Status:', data.status)
    console.log('Contest API - Visibility:', data.visibility)
    console.log('Contest API - Start Time:', data.startTime)
    console.log('Contest API - End Time:', data.endTime)
    
    const contest = await ContestService.createContest({
      ...data,
      createdBy: twitterHandle || session.user?.email || 'admin'
    })
    
    console.log('Contest API - Created contest:', contest)
    
    // Verify the contest was indexed properly
    const allContests = await ContestService.getContests()
    const activeContests = await ContestService.getContests({ status: 'active' })
    const publicContests = await ContestService.getContests({ visibility: 'public' })
    const activePublicContests = await ContestService.getContests({ status: 'active', visibility: 'public' })
    
    console.log('Contest API - Total contests after creation:', allContests.length)
    console.log('Contest API - Active contests:', activeContests.length)
    console.log('Contest API - Public contests:', publicContests.length)
    console.log('Contest API - Active & Public contests:', activePublicContests.length)
    
    return NextResponse.json(contest)
  } catch (error) {
    console.error('Error creating contest:', error)
    return NextResponse.json({ 
      error: 'Failed to create contest', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
} 