import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { ContestService } from '@/lib/services/contest-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { contestId: string } }
) {
  try {
    const contest = await ContestService.getContestById(params.contestId)
    
    if (!contest) {
      return NextResponse.json({ error: 'Contest not found' }, { status: 404 })
    }
    
    return NextResponse.json(contest)
  } catch (error) {
    console.error('Error fetching contest:', error)
    return NextResponse.json({ error: 'Failed to fetch contest' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { contestId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user is admin - check multiple possible locations
    const twitterHandle = (session as any)?.twitterHandle || 
                         (session as any)?.user?.twitterHandle ||
                         session?.user?.name ||
                         (session as any)?.user?.username;
    
    // HARDCODED CHECK for sharafi_eth
    const normalizedHandle = twitterHandle?.toLowerCase().replace('@', '');
    const isAdmin = normalizedHandle === 'sharafi_eth';
    
    if (!isAdmin) {
      // Try checking role as fallback
      const userRole = (session as any)?.user?.role || (session as any)?.role
      if (userRole !== 'admin') {
        return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
      }
    }
    
    const updates = await request.json()
    
    // Ensure dates are properly converted
    if (updates.startTime) {
      updates.startTime = new Date(updates.startTime)
    }
    if (updates.endTime) {
      updates.endTime = new Date(updates.endTime)
    }
    
    console.log('PATCH /api/contests/[contestId] - Update data:', {
      contestId: params.contestId,
      status: updates.status,
      visibility: updates.visibility,
      startTime: updates.startTime,
      endTime: updates.endTime
    })
    
    const contest = await ContestService.updateContest(
      params.contestId,
      updates,
      twitterHandle || session.user?.email || 'admin'
    )
    
    return NextResponse.json(contest)
  } catch (error) {
    console.error('Error updating contest:', error)
    return NextResponse.json({ error: 'Failed to update contest' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { contestId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user is admin - check multiple possible locations
    const twitterHandle = (session as any)?.twitterHandle || 
                         (session as any)?.user?.twitterHandle ||
                         session?.user?.name ||
                         (session as any)?.user?.username;
    
    // HARDCODED CHECK for sharafi_eth
    const normalizedHandle = twitterHandle?.toLowerCase().replace('@', '');
    const isAdmin = normalizedHandle === 'sharafi_eth';
    
    if (!isAdmin) {
      // Try checking role as fallback
      const userRole = (session as any)?.user?.role || (session as any)?.role
      if (userRole !== 'admin') {
        return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
      }
    }
    
    const success = await ContestService.deleteContest(params.contestId)
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete contest' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting contest:', error)
    return NextResponse.json({ error: 'Failed to delete contest' }, { status: 500 })
  }
} 