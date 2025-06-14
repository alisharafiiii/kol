import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { ContestService } from '@/lib/services/contest-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { contestId: string } }
) {
  try {
    const submissions = await ContestService.getContestSubmissions(params.contestId)
    
    return NextResponse.json({ 
      submissions,
      count: submissions.length
    })
  } catch (error) {
    console.error('Error fetching submissions:', error)
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { contestId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const data = await request.json()
    
    // TODO: Implement tweet submission logic
    // This would validate the tweet, fetch engagement metrics, and save the submission
    
    return NextResponse.json({ message: 'Submission endpoint not yet implemented' }, { status: 501 })
  } catch (error) {
    console.error('Error submitting to contest:', error)
    return NextResponse.json({ error: 'Failed to submit to contest' }, { status: 500 })
  }
} 