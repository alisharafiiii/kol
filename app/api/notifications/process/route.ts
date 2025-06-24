import { NextResponse } from 'next/server'
import { NotificationService } from '@/lib/notification-service'
import { checkAuth } from '@/lib/auth-utils'

export async function POST(request: Request) {
  console.log('📧 [API] /api/notifications/process POST called')
  
  try {
    // Check auth - only admins can trigger notification processing
    const authResult = await checkAuth(request)
    if (!authResult.authenticated || authResult.role !== 'admin') {
      console.log('📧 [API] Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('📧 [API] Authenticated as:', authResult.user?.twitterHandle)
    
    // Check environment variables
    console.log('📧 [API] Environment check:')
    console.log('📧   SMTP_HOST:', process.env.SMTP_HOST ? '✅ SET' : '❌ NOT SET')
    console.log('📧   SMTP_PORT:', process.env.SMTP_PORT ? '✅ SET' : '❌ NOT SET')
    console.log('📧   SMTP_USER:', process.env.SMTP_USER ? '✅ SET' : '❌ NOT SET')
    console.log('📧   SMTP_PASS:', process.env.SMTP_PASS ? '✅ SET' : '❌ NOT SET')
    console.log('📧   SMTP_FROM:', process.env.SMTP_FROM ? '✅ SET' : '❌ NOT SET')
    
    const body = await request.json().catch(() => ({}))
    const limit = body.limit || 10
    
    // Get current queue status before processing
    const statusBefore = await NotificationService.getQueueStatus()
    console.log('📧 [API] Queue status before processing:', statusBefore)
    
    // Process pending notifications
    console.log(`📧 [API] Processing up to ${limit} pending notifications...`)
    await NotificationService.processPending(limit)
    console.log('📧 [API] Processing completed')
    
    // Get updated queue status
    const statusAfter = await NotificationService.getQueueStatus()
    console.log('📧 [API] Queue status after processing:', statusAfter)
    
    const processed = statusBefore.pending - statusAfter.pending
    console.log(`📧 [API] Processed ${processed} notifications`)
    
    return NextResponse.json({
      success: true,
      statusBefore,
      statusAfter,
      processed,
      environment: {
        SMTP_HOST: process.env.SMTP_HOST ? '✅ SET' : '❌ NOT SET',
        SMTP_PORT: process.env.SMTP_PORT ? '✅ SET' : '❌ NOT SET',
        SMTP_USER: process.env.SMTP_USER ? '✅ SET' : '❌ NOT SET',
        SMTP_PASS: process.env.SMTP_PASS ? '✅ SET' : '❌ NOT SET',
        SMTP_FROM: process.env.SMTP_FROM ? '✅ SET' : '❌ NOT SET'
      }
    })
    
  } catch (error: any) {
    console.error('📧 [API ERROR] Error processing notifications:', error)
    console.error('📧 [API ERROR] Stack trace:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Failed to process notifications' },
      { status: 500 }
    )
  }
}

// Add GET endpoint for checking queue status without processing
export async function GET(request: Request) {
  console.log('📧 [API] /api/notifications/process GET called')
  
  try {
    // Check auth
    const authResult = await checkAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const status = await NotificationService.getQueueStatus()
    console.log('📧 [API] Current queue status:', status)
    
    // Get sample notifications from queue (without processing)
    const redis = await import('@/lib/redis').then(m => m.redis)
    let pendingSample = null
    let sentSample = null
    
    try {
      const pending = await redis.lrange('notifications:queue', 0, 0)
      if (pending && pending[0]) {
        pendingSample = typeof pending[0] === 'string' ? JSON.parse(pending[0]) : pending[0]
      }
      
      const sent = await redis.lrange('notifications:sent', 0, 0)
      if (sent && sent[0]) {
        sentSample = typeof sent[0] === 'string' ? JSON.parse(sent[0]) : sent[0]
      }
    } catch (e) {
      console.error('📧 [API] Error getting samples:', e)
    }
    
    return NextResponse.json({
      success: true,
      status,
      environment: {
        SMTP_HOST: process.env.SMTP_HOST ? '✅ SET' : '❌ NOT SET',
        SMTP_PORT: process.env.SMTP_PORT ? '✅ SET' : '❌ NOT SET',
        SMTP_USER: process.env.SMTP_USER ? '✅ SET' : '❌ NOT SET',
        SMTP_PASS: process.env.SMTP_PASS ? '✅ SET' : '❌ NOT SET',
        SMTP_FROM: process.env.SMTP_FROM ? '✅ SET' : '❌ NOT SET'
      },
      samples: {
        pending: pendingSample,
        sent: sentSample
      }
    })
  } catch (error: any) {
    console.error('📧 [API ERROR] Error getting queue status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get queue status' },
      { status: 500 }
    )
  }
} 