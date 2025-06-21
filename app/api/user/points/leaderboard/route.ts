import { NextRequest, NextResponse } from 'next/server'
import { PointsService } from '@/lib/services/points-service'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const leaderboard = await PointsService.getLeaderboard(limit)
    
    return NextResponse.json({ leaderboard })
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
} 