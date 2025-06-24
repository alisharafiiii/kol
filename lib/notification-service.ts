import { redis } from './redis'
import type { UnifiedProfile } from './types/profile'
import nodemailer from 'nodemailer'

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
    
    try {
      console.log(`[NotificationService] Attempting LPUSH to key: ${this.QUEUE_KEY}`)
      await redis.lpush(this.QUEUE_KEY, JSON.stringify(notification))
      console.log(`[NotificationService] Successfully queued notification ${notification.id}`)
    } catch (error: any) {
      if (error.message?.includes('WRONGTYPE')) {
        console.error(`[NotificationService] Redis WRONGTYPE error on key: ${this.QUEUE_KEY}`)
        console.error(`[NotificationService] Expected: list, but key holds different type`)
        console.error(`[NotificationService] Full error:`, error)
        
        // Try to get the actual type
        try {
          const actualType = await redis.type(this.QUEUE_KEY)
          console.error(`[NotificationService] Actual Redis type for ${this.QUEUE_KEY}: ${actualType}`)
        } catch (typeError) {
          console.error(`[NotificationService] Could not determine type:`, typeError)
        }
      }
      throw error
    }
    
    // Process immediately if high priority
    if (data.priority === 'high') {
      await this.processNotification(notification)
    }
    
    return notification.id
  }
  
  // Process pending notifications
  static async processPending(limit = 10): Promise<void> {
    let pending: any[] = []
    
    try {
      console.log(`[NotificationService] Attempting LRANGE on key: ${this.QUEUE_KEY}`)
      pending = await redis.lrange(this.QUEUE_KEY, 0, limit - 1)
      console.log(`[NotificationService] Retrieved ${pending.length} pending notifications`)
    } catch (error: any) {
      if (error.message?.includes('WRONGTYPE')) {
        console.error(`[NotificationService] Redis WRONGTYPE error on key: ${this.QUEUE_KEY}`)
        console.error(`[NotificationService] Expected: list for LRANGE operation`)
        
        try {
          const actualType = await redis.type(this.QUEUE_KEY)
          console.error(`[NotificationService] Actual Redis type: ${actualType}`)
        } catch (typeError) {
          console.error(`[NotificationService] Could not determine type:`, typeError)
        }
      }
      console.error('[NotificationService] Error in processPending:', error)
      return
    }
    
    for (const item of pending) {
      try {
        // Handle both string and object responses from Redis
        const notification = typeof item === 'string' 
          ? JSON.parse(item) as QueuedNotification 
          : item as QueuedNotification
        
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
    console.log('📧 [processNotification] Processing notification:', notification.id)
    console.log('📧 [processNotification] Type:', notification.type)
    console.log('📧 [processNotification] Recipient:', notification.recipientEmail)
    console.log('📧 [processNotification] Attempt:', notification.attempts + 1)
    
    const originalNotification = { ...notification }
    
    try {
      notification.status = 'sending'
      notification.attempts++
      
      // Update in queue - remove old entry and add updated one
      // We need to match the exact stored format (might be object or string)
      const pending = await redis.lrange(this.QUEUE_KEY, 0, -1)
      for (const item of pending) {
        const stored = typeof item === 'string' ? JSON.parse(item) : item
        if (stored.id === originalNotification.id) {
          await redis.lrem(this.QUEUE_KEY, 0, typeof item === 'string' ? item : JSON.stringify(item))
          break
        }
      }
      await redis.lpush(this.QUEUE_KEY, JSON.stringify(notification))
      
      // Send email
      await this.sendEmail(notification)
      
      // Mark as sent
      notification.status = 'sent'
      
      // Remove from queue
      const queueItems = await redis.lrange(this.QUEUE_KEY, 0, -1)
      for (const item of queueItems) {
        const stored = typeof item === 'string' ? JSON.parse(item) : item
        if (stored.id === notification.id) {
          await redis.lrem(this.QUEUE_KEY, 0, typeof item === 'string' ? item : JSON.stringify(item))
          break
        }
      }
      
      // Add to sent queue
      await redis.lpush(this.SENT_KEY, JSON.stringify({
        ...notification,
        sentAt: new Date().toISOString()
      }))
      
    } catch (error: any) {
      notification.status = 'failed'
      notification.error = error.message
      
      // Update in queue
      const queueItems = await redis.lrange(this.QUEUE_KEY, 0, -1)
      for (const item of queueItems) {
        const stored = typeof item === 'string' ? JSON.parse(item) : item
        if (stored.id === notification.id) {
          await redis.lrem(this.QUEUE_KEY, 0, typeof item === 'string' ? item : JSON.stringify(item))
          break
        }
      }
      
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
    console.log('📧 [sendEmail] Starting email send process')
    console.log('📧 [sendEmail] Recipient:', notification.recipientEmail)
    console.log('📧 [sendEmail] Subject:', notification.subject)
    console.log('📧 [sendEmail] Type:', notification.type)
    
    // Check if this is HTML content
    const isHtml = notification.message.includes('<') && notification.message.includes('>')
    
    // Check SMTP configuration
    if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
      console.log('📧 [EMAIL SIMULATION] - No SMTP credentials configured')
      console.log('📧 =================== EMAIL CONTENT ===================')
      console.log('📧 TO:', notification.recipientEmail)
      console.log('📧 SUBJECT:', notification.subject)
      console.log('📧 TYPE:', notification.type)
      console.log('📧 PRIORITY:', notification.priority || 'normal')
      console.log('📧 FORMAT:', isHtml ? 'HTML' : 'Plain Text')
      console.log('📧 MESSAGE:')
      if (isHtml) {
        console.log('📧 [HTML Content - Preview not shown in console]')
        console.log('📧 [Length: ' + notification.message.length + ' characters]')
      } else {
        console.log(notification.message)
      }
      if (notification.metadata) {
        console.log('📧 METADATA:', JSON.stringify(notification.metadata, null, 2))
      }
      console.log('📧 =====================================================')
      return
    }
    
    // Send actual email with nodemailer
    try {
      console.log('📧 [SMTP] Creating nodemailer transporter...')
      console.log('📧 [SMTP] Config:', {
        host: SMTP_CONFIG.host,
        port: SMTP_CONFIG.port,
        secure: SMTP_CONFIG.secure,
        user: SMTP_CONFIG.auth.user,
        from: SMTP_CONFIG.from
      })
      
      const transporter = nodemailer.createTransport({
        host: SMTP_CONFIG.host,
        port: SMTP_CONFIG.port,
        secure: SMTP_CONFIG.secure,
        auth: {
          user: SMTP_CONFIG.auth.user,
          pass: SMTP_CONFIG.auth.pass
        }
      })
      
      console.log('📧 [SMTP] Verifying transporter connection...')
      await transporter.verify()
      console.log('📧 [SMTP] Transporter verified successfully')
      
      const mailOptions = {
        from: SMTP_CONFIG.from,
        to: notification.recipientEmail,
        subject: notification.subject,
        html: isHtml ? notification.message : this.generateEmailHTML(notification),
        text: isHtml ? this.stripHtml(notification.message) : notification.message
      }
      
      console.log('📧 [SMTP] Sending email...')
      const info = await transporter.sendMail(mailOptions)
      
      console.log('📧 [SMTP] Email sent successfully!')
      console.log('📧 [SMTP] Message ID:', info.messageId)
      console.log('📧 [SMTP] Response:', info.response)
    } catch (error: any) {
      console.error('📧 [SMTP ERROR] Failed to send email:', error.message)
      console.error('📧 [SMTP ERROR] Full error:', error)
      throw error
    }
  }
  
  // Helper to strip HTML tags for text version
  private static stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
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
    
    let notifications = sent.map(item => {
      // Handle both string and object responses from Redis
      return typeof item === 'string' ? JSON.parse(item) as QueuedNotification : item as QueuedNotification
    })
    
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
    const results = { pending: 0, sent: 0, failed: 0 }
    
    // Check each key individually to identify which one might have the wrong type
    const keys = [
      { name: 'QUEUE_KEY', key: this.QUEUE_KEY, field: 'pending' as keyof typeof results },
      { name: 'SENT_KEY', key: this.SENT_KEY, field: 'sent' as keyof typeof results },
      { name: 'FAILED_KEY', key: this.FAILED_KEY, field: 'failed' as keyof typeof results }
    ]
    
    for (const { name, key, field } of keys) {
      try {
        console.log(`[NotificationService] Attempting LLEN on ${name}: ${key}`)
        results[field] = await redis.llen(key)
      } catch (error: any) {
        if (error.message?.includes('WRONGTYPE')) {
          console.error(`[NotificationService] Redis WRONGTYPE error on ${name}: ${key}`)
          console.error(`[NotificationService] Expected: list for LLEN operation`)
          
          try {
            const actualType = await redis.type(key)
            console.error(`[NotificationService] Actual Redis type for ${key}: ${actualType}`)
          } catch (typeError) {
            console.error(`[NotificationService] Could not determine type:`, typeError)
          }
        } else {
          console.error(`[NotificationService] Error checking ${name}:`, error)
        }
      }
    }
    
    return results
  }
  
  // Clear old notifications (older than 30 days)
  static async cleanup(): Promise<void> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    // Clean sent notifications
    const sent = await redis.lrange(this.SENT_KEY, 0, -1)
    for (const item of sent) {
      try {
        // Handle both string and object responses from Redis
        const notification = typeof item === 'string' 
          ? JSON.parse(item) as QueuedNotification 
          : item as QueuedNotification
        
        if (new Date(notification.createdAt) < thirtyDaysAgo) {
          await redis.lrem(this.SENT_KEY, 0, typeof item === 'string' ? item : JSON.stringify(item))
        }
      } catch (error) {
        console.error('Error parsing notification during cleanup:', error)
      }
    }
    
    // Clean failed notifications
    const failed = await redis.lrange(this.FAILED_KEY, 0, -1)
    for (const item of failed) {
      try {
        // Handle both string and object responses from Redis
        const notification = typeof item === 'string' 
          ? JSON.parse(item) as QueuedNotification 
          : item as QueuedNotification
        
        if (new Date(notification.createdAt) < thirtyDaysAgo) {
          await redis.lrem(this.FAILED_KEY, 0, typeof item === 'string' ? item : JSON.stringify(item))
        }
      } catch (error) {
        console.error('Error parsing notification during cleanup:', error)
      }
    }
  }
} 