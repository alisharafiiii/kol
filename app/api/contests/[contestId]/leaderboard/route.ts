import { NextRequest, NextResponse } from 'next/server'
import { ContestService } from '@/lib/services/contest-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { contestId: string } }
) {
  try {
    const leaderboard = await ContestService.getLeaderboard(params.contestId)
    
    if (!leaderboard) {
      return NextResponse.json({ 
        contestId: params.contestId,
        lastUpdated: new Date(),
        entries: []
      })
    }
    
    return NextResponse.json(leaderboard)
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
} 