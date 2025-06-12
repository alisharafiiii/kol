// Discord Analytics Types

export interface DiscordProject {
  id: string                          // project:discord:nanoid
  name: string
  serverId: string                    // Discord server ID
  serverName: string
  iconUrl?: string
  trackedChannels: string[]           // Array of channel IDs to track
  teamMods: string[]                  // Array of user handles who can manage
  createdAt: string
  createdBy: string
  updatedAt?: string
  isActive: boolean
  scoutProjectId?: string             // Link to Scout project
  stats?: {
    totalMessages: number
    totalUsers: number
    lastActivity?: string
  }
}

export interface DiscordChannel {
  id: string                          // Discord channel ID
  name: string
  type: 'text' | 'voice' | 'forum'
  projectId: string
  isTracked: boolean
  parent?: string | null              // Parent category name
  position?: number                   // Channel position for sorting
}

export interface DiscordMessage {
  id: string                          // message:discord:messageId
  projectId: string
  channelId: string
  channelName: string
  userId: string
  username: string
  userAvatar?: string
  content: string
  timestamp: string
  sentiment?: MessageSentiment        // Added after Gemini analysis
  tags?: string[]                     // spam, toxic, valuable, etc
  hasAttachments: boolean
  replyToId?: string                  // If it's a reply
}

export interface MessageSentiment {
  score: 'positive' | 'neutral' | 'negative'
  confidence: number                  // 0-1
  analyzedAt: string
  tags?: string[]                     // Additional classifications
}

export interface DiscordUser {
  id: string                          // Discord user ID
  username: string
  discriminator?: string              // For old Discord usernames
  avatar?: string
  projects: string[]                  // Projects they're active in
  stats: {
    [projectId: string]: UserProjectStats
  }
}

export interface UserProjectStats {
  messageCount: number
  firstSeen: string
  lastSeen: string
  sentimentBreakdown: {
    positive: number
    neutral: number
    negative: number
  }
  engagementScore?: number            // For Phase 2
  points?: number                     // For Phase 2
}

export interface DiscordAnalytics {
  projectId: string
  timeframe: 'daily' | 'weekly' | 'monthly' | 'custom'
  startDate: string
  endDate: string
  metrics: {
    totalMessages: number
    uniqueUsers: number
    averageMessagesPerUser: number
    sentimentBreakdown: {
      positive: number
      neutral: number
      negative: number
    }
    topUsers: Array<{
      userId: string
      username: string
      messageCount: number
      avgSentiment: number
    }>
    channelActivity: Array<{
      channelId: string
      channelName: string
      messageCount: number
    }>
    hourlyActivity: number[]          // 24 hours
    dailyTrend: Array<{
      date: string
      messages: number
      sentiment: number
    }>
  }
} 