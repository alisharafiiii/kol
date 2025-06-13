export interface TwitterConnection {
  discordId: string
  twitterHandle: string
  tier: number
  connectedAt: Date
  totalPoints: number
}

export interface Tweet {
  id: string
  tweetId: string
  submitterDiscordId: string
  submittedAt: Date
  category?: string
  url: string
  authorHandle: string
  content?: string
  metrics?: {
    likes: number
    retweets: number
    replies: number
  }
}

export interface EngagementLog {
  id: string
  tweetId: string
  userDiscordId: string
  interactionType: 'like' | 'retweet' | 'reply'
  points: number
  timestamp: Date
  batchId: string
}

export interface PointRule {
  id: string
  tier: number
  interactionType: 'like' | 'retweet' | 'reply'
  points: number
  multiplier?: number
}

export interface LeaderboardEntry {
  discordId: string
  twitterHandle: string
  tier: number
  totalPoints: number
  weeklyPoints: number
  rank: number
}

export interface BatchJob {
  id: string
  startedAt: Date
  completedAt?: Date
  status: 'pending' | 'running' | 'completed' | 'failed'
  tweetsProcessed: number
  engagementsFound: number
  error?: string
} 