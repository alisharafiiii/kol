import { NextRequest, NextResponse } from 'next/server'
import { EngagementService } from '@/lib/services/engagement-service'
import { checkAuth } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check auth
    const auth = await checkAuth(request, ['admin', 'core'])
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const jobs = await EngagementService.getRecentBatchJobs(Math.min(limit, 50))
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Error fetching batch jobs:', error)
    return NextResponse.json({ error: 'Failed to fetch batch jobs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check auth - only admin can trigger batch processing
    const auth = await checkAuth(request, ['admin'])
    if (!auth.authenticated || !auth.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // Check if there's already a running job
    const recentJobs = await EngagementService.getRecentBatchJobs(1)
    if (recentJobs.length > 0 && recentJobs[0].status === 'running') {
      return NextResponse.json({ 
        error: 'A batch job is already running', 
        job: recentJobs[0] 
      }, { status: 409 })
    }
    
    // Create a new batch job record
    const job = await EngagementService.createBatchJob()
    
    // Note: The actual processing should be done by a separate process
    // This endpoint just creates the job record
    // The batch processor script should be run separately (e.g., via cron or PM2)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Batch job created. Run the batch processor script to process it.',
      job
    })
  } catch (error) {
    console.error('Error creating batch job:', error)
    return NextResponse.json({ error: 'Failed to create batch job' }, { status: 500 })
  }
} 