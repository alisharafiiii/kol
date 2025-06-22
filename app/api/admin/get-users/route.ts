import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redis, InfluencerProfile } from '@/lib/redis'
import { ProfileService } from '@/lib/services/profile-service'

export async function GET(req: NextRequest) {
  try {
    // Check if user is logged in with Twitter and is admin
    const session: any = await getServerSession(authOptions as any)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Twitter login required' }, { status: 401 })
    }
    
    // Get Twitter handle from session
    const twitterHandle = session?.twitterHandle || session?.user?.twitterHandle || session?.user?.name
    const normalizedHandle = twitterHandle?.toLowerCase().replace('@', '')
    
    console.log('[ADMIN GET-USERS] Twitter handle:', twitterHandle, 'Normalized:', normalizedHandle)
    
    // Check if user is sharafi_eth (hardcoded admin)
    if (normalizedHandle !== 'sharafi_eth') {
      // For non-sharafi_eth users, check their role in session
      const userRole = session?.user?.role || session?.role
      console.log('[ADMIN GET-USERS] User role:', userRole)
      
      if (userRole !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }
    
    console.log('[ADMIN GET-USERS] Access granted, fetching users...')
    
    // Try to get users from both systems
    try {
      const allUsers: any[] = []
      const seenHandles = new Set<string>()
      
      // 1. Get users from NEW ProfileService system
      console.log('[ADMIN GET-USERS] Fetching from ProfileService...')
      const profiles = await ProfileService.searchProfiles({})
      console.log(`[ADMIN GET-USERS] Found ${profiles.length} profiles in ProfileService`)
      
      profiles.forEach(profile => {
        const handle = profile.twitterHandle?.toLowerCase()
        if (handle) {
          seenHandles.add(handle)
        }
        
        // Convert to the format expected by AdminPanel
        allUsers.push({
          id: profile.id,
          name: profile.name || profile.twitterHandle || 'Unknown',
          handle: profile.twitterHandle ? `@${profile.twitterHandle}` : '',
          twitterHandle: profile.twitterHandle,
          profileImageUrl: profile.profileImageUrl,
          role: profile.role,
          approvalStatus: profile.approvalStatus,
          tier: profile.tier || profile.currentTier,
          isKOL: profile.isKOL,
          email: profile.email,
          phone: profile.phone,
          telegram: (profile as any).telegram,
          country: profile.country,
          followerCount: (profile as any).followerCount || 0,
          totalFollowers: (profile as any).followerCount || 0,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
          // Include other fields that AdminPanel might need
          shippingInfo: (profile as any).shippingInfo,
          socialAccounts: (profile as any).socialAccounts || { twitter: { handle: profile.twitterHandle, followers: (profile as any).followerCount || 0 } },
          audienceTypes: (profile as any).audienceTypes,
          chains: (profile as any).chains,
          activeChains: profile.activeChains || (profile as any).chains || [],
          postPricePerPost: (profile as any).postPricePerPost,
          priceMonthly: (profile as any).priceMonthly,
          monthlySupportBudget: (profile as any).monthlySupportBudget,
          adminNotes: (profile as any).adminNotes,
          bestCollabUrls: (profile as any).bestCollabUrls,
          // Campaign and engagement fields
          campaigns: profile.campaigns || [],
          kolMetrics: profile.kolMetrics,
          notes: profile.notes || [],
          points: profile.points || 0,
          pointsBreakdown: profile.pointsBreakdown,
          // Ensure Discord fields are included
          discordId: (profile as any).discordId,
          discordUsername: (profile as any).discordUsername
        })
      })
      
      // 2. Get users from OLD Redis system (to catch any that haven't migrated)
      console.log('[ADMIN GET-USERS] Fetching from old Redis system...')
      const userKeys = await redis.keys('user:*')
      console.log(`[ADMIN GET-USERS] Found ${userKeys.length} user keys in old system`)
      
      // Fetch all user profiles from old system
      const oldUsers = await Promise.all(
        userKeys.map(async (key: string) => {
          const userId = key.replace('user:', '')
          const profile = await redis.json.get(key) as InfluencerProfile | null
          
          if (!profile) return null
          
          // Skip if we already have this user from ProfileService
          const profileHandle = profile.twitterHandle?.toLowerCase()?.replace('@', '')
          if (profileHandle && seenHandles.has(profileHandle)) {
            console.log(`[ADMIN GET-USERS] Skipping duplicate from old system: ${profileHandle}`)
            return null
          }
          
          // Calculate total follower count from all social profiles
          let totalFollowers = profile.followerCount || 0
          
          // Use the twitter handle from socialAccounts if available
          let handleFromSocial = ''
          if (profile.socialAccounts && profile.socialAccounts.twitter && 
              typeof profile.socialAccounts.twitter === 'object' && 
              'handle' in profile.socialAccounts.twitter) {
            handleFromSocial = profile.socialAccounts.twitter.handle || ''
            // Also update followers from Twitter if available
            if ('followers' in profile.socialAccounts.twitter && 
                typeof profile.socialAccounts.twitter.followers === 'number') {
              totalFollowers = profile.socialAccounts.twitter.followers
            }
          }
          
          // Handle other social accounts for total follower count
          if (profile.socialAccounts) {
            Object.entries(profile.socialAccounts).forEach(([platform, account]) => {
              if (platform !== 'twitter' && account && typeof account === 'object') {
                if ('followers' in account && typeof account.followers === 'number') {
                  totalFollowers += account.followers
                }
                if ('subscribers' in account && typeof account.subscribers === 'number') {
                  totalFollowers += account.subscribers
                }
              }
            })
          }
          
          // Get Twitter handle from profile or social accounts
          const twitterHandle = profile.twitterHandle || 
                   (handleFromSocial ? `@${handleFromSocial.replace(/^@/, '')}` : null)
          
          // Create a normalized user object with consistent properties
          return {
            ...profile,
            // Use consistent ID scheme
            id: profile.id || userId,
            // Use the Twitter handle from profile or social accounts, ensuring it has @ prefix
            handle: twitterHandle,
            // Keep both totalFollowers for UI and followerCount for original data
            totalFollowers,
            followerCount: profile.followerCount || totalFollowers
          }
        })
      )
      
      // Add valid old users to the list
      oldUsers.forEach(user => {
        if (user) {
          allUsers.push(user)
        }
      })
      
      console.log(`[ADMIN GET-USERS] Total users from both systems: ${allUsers.length}`)
      console.log(`[ADMIN GET-USERS] Returning ${allUsers.length} users`)
      return NextResponse.json({ users: allUsers })
      
    } catch (redisError) {
      console.error('[ADMIN GET-USERS] Redis error:', redisError)
      
      // If Redis is down, return empty array so admin panel still loads
      return NextResponse.json({ 
        users: [],
        error: 'Database connection failed - showing empty user list'
      })
    }
    
  } catch (error) {
    console.error('[ADMIN GET-USERS] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 