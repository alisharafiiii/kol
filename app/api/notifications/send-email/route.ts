import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/auth-utils'
import { NotificationService } from '@/lib/notification-service'

export async function POST(request: NextRequest) {
  try {
    // Check auth - only internal calls allowed
    const auth = await checkAuth(request, ['admin', 'core', 'team'])
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { to, subject, html } = await request.json()
    
    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, html' },
        { status: 400 }
      )
    }
    
    // Queue notifications for each recipient
    const recipients = Array.isArray(to) ? to : [to]
    const notificationIds = []
    
    for (const email of recipients) {
      const id = await NotificationService.queue({
        type: 'note_added',
        recipientEmail: email,
        recipientName: email.split('@')[0], // Use email prefix as name
        subject,
        message: html.replace(/<[^>]*>/g, ''), // Strip HTML for plain text
        priority: 'high'
      })
      notificationIds.push(id)
    }
    
    // Process high priority notifications immediately
    await NotificationService.processPending(5)
    
    return NextResponse.json({ 
      success: true, 
      notificationIds,
      message: `Queued ${notificationIds.length} notifications`
    })
  } catch (error) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }
} 