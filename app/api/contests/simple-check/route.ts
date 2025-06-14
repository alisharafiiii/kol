import { NextRequest, NextResponse } from 'next/server'
import { ContestService } from '@/lib/services/contest-service'

export async function GET() {
  try {
    console.log('Simple check - Starting...')
    
    // Just try to get all contests without filters
    const allContests = await ContestService.getContests()
    console.log('Simple check - Found contests:', allContests.length)
    
    // Get contests with filters
    const activePublicContests = await ContestService.getContests({
      status: 'active',
      visibility: 'public'
    })
    console.log('Simple check - Active & public contests:', activePublicContests.length)
    
    const response = {
      success: true,
      counts: {
        all: allContests.length,
        activePublic: activePublicContests.length
      },
      contests: allContests.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        visibility: c.visibility,
        startTime: c.startTime,
        endTime: c.endTime
      }))
    }
    
    console.log('Simple check - Response:', response)
    return NextResponse.json(response)
  } catch (error) {
    console.error('Simple check error:', error)
    return NextResponse.json({ 
      error: 'Simple check failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
} 