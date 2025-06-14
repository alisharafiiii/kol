// Contest type definitions

export interface Contest {
  id: string
  name: string
  description?: string
  startTime: Date
  endTime: Date
  imageUrl?: string
  sponsors: ContestSponsor[]
  sentimentTags?: string[]
  prizePool: number
  prizeDistribution: PrizeDistribution
  status: 'draft' | 'active' | 'ended' | 'cancelled'
  visibility: 'public' | 'hidden'
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy?: string
}

export interface ContestSponsor {
  projectId: string
  name: string
  imageUrl?: string
  twitterHandle: string
}

export interface PrizeDistribution {
  type: 'default' | 'custom'
  tiers: PrizeTier[]
}

export interface PrizeTier {
  position: number | string // e.g., 1, 2, 3, or "4-10"
  percentage: number
  amount?: number // Calculated based on prize pool
}

export interface ContestSubmission {
  id: string
  contestId: string
  userId: string
  userHandle: string
  userTier: 'hero' | 'legend' | 'star' | 'rising' | 'micro'
  tweetId: string
  tweetUrl: string
  tweetContent: string
  submittedAt: Date
  
  // Engagement metrics
  views: number
  likes: number
  retweets: number
  replies: number
  bookmarks: number
  quotes: number
  
  // Calculated scores
  rawEngagement: number
  tierMultiplier: number
  finalScore: number
  
  // Verification status
  verified: boolean
  verifiedAt?: Date
  verificationError?: string
  
  // Last sync
  lastSyncedAt?: Date
}

export interface ContestLeaderboard {
  contestId: string
  lastUpdated: Date
  entries: LeaderboardEntry[]
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  userHandle: string
  userImage?: string
  userTier: 'hero' | 'legend' | 'star' | 'rising' | 'micro'
  totalScore: number
  tweetCount: number
  totalEngagements: number
  prizeAmount?: number
}

export interface UserContestStats {
  userId: string
  contestId: string
  tweetsSubmitted: number
  totalEngagements: number
  currentRank: number
  totalScore: number
  earnedPoints: number
  lastUpdated: Date
}

// Helper function to generate poker-style distribution
export function generatePokerDistribution(numberOfWinners: number): PrizeTier[] {
  if (numberOfWinners <= 0) return []
  
  const tiers: PrizeTier[] = []
  
  if (numberOfWinners === 1) {
    tiers.push({ position: 1, percentage: 100 })
  } else if (numberOfWinners === 2) {
    tiers.push({ position: 1, percentage: 70 })
    tiers.push({ position: 2, percentage: 30 })
  } else if (numberOfWinners === 3) {
    tiers.push({ position: 1, percentage: 50 })
    tiers.push({ position: 2, percentage: 30 })
    tiers.push({ position: 3, percentage: 20 })
  } else if (numberOfWinners <= 5) {
    tiers.push({ position: 1, percentage: 40 })
    tiers.push({ position: 2, percentage: 25 })
    tiers.push({ position: 3, percentage: 15 })
    const remaining = 20
    const remainingWinners = numberOfWinners - 3
    const perWinner = remaining / remainingWinners
    for (let i = 4; i <= numberOfWinners; i++) {
      tiers.push({ position: i, percentage: perWinner })
    }
  } else {
    // For more than 5 winners, use a more distributed approach
    const percentages = [30, 20, 15, 10] // Top 4 get fixed percentages
    const remainingPercentage = 25
    const remainingWinners = numberOfWinners - 4
    const perWinner = remainingPercentage / remainingWinners
    
    for (let i = 0; i < 4 && i < numberOfWinners; i++) {
      tiers.push({ position: i + 1, percentage: percentages[i] })
    }
    
    for (let i = 5; i <= numberOfWinners; i++) {
      tiers.push({ position: i, percentage: perWinner })
    }
  }
  
  return tiers
}

// Default prize distributions
export const DEFAULT_PRIZE_DISTRIBUTIONS = {
  top3: {
    type: 'default' as const,
    tiers: generatePokerDistribution(3)
  },
  top5: {
    type: 'default' as const,
    tiers: generatePokerDistribution(5)
  },
  top10: {
    type: 'default' as const,
    tiers: generatePokerDistribution(10)
  }
};

// Tier multipliers for engagement scoring
export const TIER_MULTIPLIERS = {
  hero: 2.0,
  legend: 1.7,
  star: 1.5,
  rising: 1.3,
  micro: 1.0
}; 