import { redis } from './redis'
import type { UnifiedProfile } from './types/profile'

// Notification types
export type NotificationType = 
  | 'note_added'
  | 'campaign_assigned' 
  | 'payment_approved'
  | 'payment_rejected'
  | 'stage_updated'
  | 'profile_updated'

interface NotificationData {
  type: NotificationType
  recipientEmail: string
  recipientName: string
  subject: string
  message: string
  metadata?: Record<string, any>
  priority?: 'low' | 'normal' | 'high'
}

interface QueuedNotification extends NotificationData {
  id: string
  createdAt: string
  attempts: number
  status: 'pending' | 'sending' | 'sent' | 'failed'
  error?: string
}

// Email service configuration
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  from: process.env.SMTP_FROM || 'KOL Platform <notifications@nabulines.com>'
}

export class NotificationService {
  private static QUEUE_KEY = 'notifications:queue'
  private static SENT_KEY = 'notifications:sent'
  private static FAILED_KEY = 'notifications:failed'
  
  // Queue a notification
  static async queue(data: NotificationData): Promise<string> {
    const notification: QueuedNotification = {
      ...data,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending'
    }
    
    await redis.lpush(this.QUEUE_KEY, JSON.stringify(notification))
    
    // Process immediately if high priority
    if (data.priority === 'high') {
      await this.processNotification(notification)
    }
    
    return notification.id
  }
  
  // Process pending notifications
  static async processPending(limit = 10): Promise<void> {
    const pending = await redis.lrange(this.QUEUE_KEY, 0, limit - 1)
    
    for (const item of pending) {
      try {
        const notification = JSON.parse(item) as QueuedNotification
        
        if (notification.status === 'pending' || 
            (notification.status === 'failed' && notification.attempts < 3)) {
          await this.processNotification(notification)
        }
      } catch (error) {
        console.error('Error processing notification:', error)
      }
    }
  }
  
  // Process a single notification
  private static async processNotification(notification: QueuedNotification): Promise<void> {
    try {
      notification.status = 'sending'
      notification.attempts++
      
      // Update in queue
      await redis.lrem(this.QUEUE_KEY, 0, JSON.stringify(notification))
      await redis.lpush(this.QUEUE_KEY, JSON.stringify(notification))
      
      // Send email
      await this.sendEmail(notification)
      
      // Mark as sent
      notification.status = 'sent'
      await redis.lrem(this.QUEUE_KEY, 0, JSON.stringify(notification))
      await redis.lpush(this.SENT_KEY, JSON.stringify({
        ...notification,
        sentAt: new Date().toISOString()
      }))
      
    } catch (error: any) {
      notification.status = 'failed'
      notification.error = error.message
      
      // Update in queue
      await redis.lrem(this.QUEUE_KEY, 0, JSON.stringify(notification))
      
      if (notification.attempts >= 3) {
        // Move to failed queue
        await redis.lpush(this.FAILED_KEY, JSON.stringify(notification))
      } else {
        // Keep in queue for retry
        await redis.lpush(this.QUEUE_KEY, JSON.stringify(notification))
      }
      
      throw error
    }
  }
  
  // Send email via SMTP
  private static async sendEmail(notification: NotificationData): Promise<void> {
    // In production, use nodemailer or similar
    // For now, we'll simulate sending
    if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
      console.log('📧 [EMAIL SIMULATION] - No SMTP credentials configured')
      console.log('📧 =================== EMAIL CONTENT ===================')
      console.log('📧 TO:', notification.recipientEmail)
      console.log('📧 SUBJECT:', notification.subject)
      console.log('📧 TYPE:', notification.type)
      console.log('📧 PRIORITY:', notification.priority || 'normal')
      console.log('📧 MESSAGE:')
      console.log(notification.message)
      if (notification.metadata) {
        console.log('📧 METADATA:', JSON.stringify(notification.metadata, null, 2))
      }
      console.log('📧 =====================================================')
      return
    }
    
    // TODO: Implement actual email sending with nodemailer
    // const transporter = nodemailer.createTransport(SMTP_CONFIG)
    // await transporter.sendMail({
    //   from: SMTP_CONFIG.from,
    //   to: notification.recipientEmail,
    //   subject: notification.subject,
    //   html: this.generateEmailHTML(notification)
    // })
  }
  
  // Generate HTML email template
  private static generateEmailHTML(notification: NotificationData): string {
    const template = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background-color: #000; border: 1px solid #22c55e; }
          .header { background-color: #000; color: #86efac; padding: 20px; text-align: center; border-bottom: 1px solid #22c55e; }
          .content { padding: 30px; color: #86efac; }
          .footer { background-color: #000; color: #6b7280; padding: 20px; text-align: center; border-top: 1px solid #22c55e; font-size: 12px; }
          h1 { margin: 0; font-size: 24px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #22c55e; color: #000; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 20px; }
          .metadata { background-color: #064e3b; padding: 15px; margin-top: 20px; border-radius: 4px; }
          .metadata-item { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .metadata-item:last-child { margin-bottom: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>KOL Platform Notification</h1>
          </div>
          <div class="content">
            <h2>Hello ${notification.recipientName},</h2>
            <p>${notification.message}</p>
            ${notification.metadata ? this.renderMetadata(notification.metadata) : ''}
          </div>
          <div class="footer">
            <p>&copy; 2024 KOL Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
    return template
  }
  
  private static renderMetadata(metadata: Record<string, any>): string {
    const items = Object.entries(metadata)
      .map(([key, value]) => `
        <div class="metadata-item">
          <span>${key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.slice(1)}:</span>
          <span>${value}</span>
        </div>
      `)
      .join('')
    
    return `<div class="metadata">${items}</div>`
  }
  
  // Notification helpers for specific events
  static async notifyNoteAdded(
    profile: UnifiedProfile,
    noteAuthor: string,
    noteContent: string
  ): Promise<void> {
    if (!profile.email) return
    
    await this.queue({
      type: 'note_added',
      recipientEmail: profile.email,
      recipientName: profile.name || profile.twitterHandle,
      subject: 'New Note Added to Your Profile',
      message: `${noteAuthor} has added a note to your profile: "${noteContent}"`,
      metadata: {
        author: noteAuthor,
        added_at: new Date().toISOString()
      }
    })
  }
  
  static async notifyCampaignAssignment(
    profile: UnifiedProfile,
    campaignName: string,
    role: string
  ): Promise<void> {
    if (!profile.email) return
    
    await this.queue({
      type: 'campaign_assigned',
      recipientEmail: profile.email,
      recipientName: profile.name || profile.twitterHandle,
      subject: `You've been assigned to campaign: ${campaignName}`,
      message: `You have been assigned as a ${role} to the campaign "${campaignName}". Please check the platform for more details.`,
      metadata: {
        campaign: campaignName,
        role: role,
        assigned_at: new Date().toISOString()
      },
      priority: 'high'
    })
  }
  
  static async notifyPaymentStatus(
    profile: UnifiedProfile,
    campaignName: string,
    status: 'approved' | 'rejected',
    amount: number,
    reason?: string
  ): Promise<void> {
    if (!profile.email) return
    
    const isApproved = status === 'approved'
    
    await this.queue({
      type: isApproved ? 'payment_approved' : 'payment_rejected',
      recipientEmail: profile.email,
      recipientName: profile.name || profile.twitterHandle,
      subject: `Payment ${isApproved ? 'Approved' : 'Rejected'} - ${campaignName}`,
      message: isApproved
        ? `Your payment of $${amount} for campaign "${campaignName}" has been approved and will be processed soon.`
        : `Your payment request for campaign "${campaignName}" has been rejected. ${reason ? `Reason: ${reason}` : ''}`,
      metadata: {
        campaign: campaignName,
        amount: `$${amount}`,
        status: status,
        ...(reason && { reason })
      },
      priority: 'high'
    })
  }
  
  static async notifyStageUpdate(
    profile: UnifiedProfile,
    campaignName: string,
    oldStage: string,
    newStage: string
  ): Promise<void> {
    if (!profile.email) return
    
    await this.queue({
      type: 'stage_updated',
      recipientEmail: profile.email,
      recipientName: profile.name || profile.twitterHandle,
      subject: `Campaign Stage Updated - ${campaignName}`,
      message: `Your stage in campaign "${campaignName}" has been updated from "${oldStage}" to "${newStage}".`,
      metadata: {
        campaign: campaignName,
        old_stage: oldStage,
        new_stage: newStage,
        updated_at: new Date().toISOString()
      }
    })
  }
  
  // Get notification history
  static async getHistory(
    filter?: { type?: NotificationType; email?: string; limit?: number }
  ): Promise<QueuedNotification[]> {
    const limit = filter?.limit || 100
    const sent = await redis.lrange(this.SENT_KEY, 0, limit - 1)
    
    let notifications = sent.map(item => JSON.parse(item) as QueuedNotification)
    
    if (filter?.type) {
      notifications = notifications.filter(n => n.type === filter.type)
    }
    
    if (filter?.email) {
      notifications = notifications.filter(n => n.recipientEmail === filter.email)
    }
    
    return notifications
  }
  
  // Get queue status
  static async getQueueStatus(): Promise<{
    pending: number
    sent: number
    failed: number
  }> {
    const [pending, sent, failed] = await Promise.all([
      redis.llen(this.QUEUE_KEY),
      redis.llen(this.SENT_KEY),
      redis.llen(this.FAILED_KEY)
    ])
    
    return { pending, sent, failed }
  }
  
  // Clear old notifications (older than 30 days)
  static async cleanup(): Promise<void> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    // Clean sent notifications
    const sent = await redis.lrange(this.SENT_KEY, 0, -1)
    for (const item of sent) {
      const notification = JSON.parse(item) as QueuedNotification
      if (new Date(notification.createdAt) < thirtyDaysAgo) {
        await redis.lrem(this.SENT_KEY, 0, item)
      }
    }
    
    // Clean failed notifications
    const failed = await redis.lrange(this.FAILED_KEY, 0, -1)
    for (const item of failed) {
      const notification = JSON.parse(item) as QueuedNotification
      if (new Date(notification.createdAt) < thirtyDaysAgo) {
        await redis.lrem(this.FAILED_KEY, 0, item)
      }
    }
  }
} 