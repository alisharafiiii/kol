import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { PointsService } from '@/lib/services/points-service'
import { hasAdminAccess } from '@/lib/admin-config'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const handle = searchParams.get('handle')
    
    if (!handle) {
      return NextResponse.json({ error: 'Handle is required' }, { status: 400 })
    }
    
    const points = await PointsService.getUserPoints(handle)
    
    return NextResponse.json({ points })
  } catch (error) {
    console.error('Error fetching user points:', error)
    return NextResponse.json({ error: 'Failed to fetch points' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Only admins can award points manually
    const userHandle = session?.twitterHandle || session?.user?.name
    const userRole = session?.role || session?.user?.role || 'user'
    
    if (!hasAdminAccess(userHandle, userRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const { userId, amount, source, description } = await req.json()
    
    if (!userId || !amount || !source || !description) {
      return NextResponse.json({ 
        error: 'userId, amount, source, and description are required' 
      }, { status: 400 })
    }
    
    const profile = await PointsService.awardPoints(
      userId,
      amount,
      source,
      description,
      { awardedBy: userHandle }
    )
    
    if (!profile) {
      return NextResponse.json({ error: 'Failed to award points' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true,
      points: profile.points,
      message: `Awarded ${amount} points to user`
    })
  } catch (error) {
    console.error('Error awarding points:', error)
    return NextResponse.json({ error: 'Failed to award points' }, { status: 500 })
  }
} 