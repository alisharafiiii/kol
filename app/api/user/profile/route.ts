import { NextRequest, NextResponse } from 'next/server';
import { findUserByWallet, findUserByUsername } from '@/lib/user-identity';
import { redis, InfluencerProfile } from '@/lib/redis';
import { ProfileService } from '@/lib/services/profile-service';
import type { UnifiedProfile } from '@/lib/types/profile';

export async function GET(req: NextRequest) {
  console.log('=== USER PROFILE API: Request received ===');
  
  try {
    // Get the identifier from the query parameter - could be wallet or handle
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');
    const handle = searchParams.get('handle');
    
    console.log('USER PROFILE API: Params - wallet:', wallet, 'handle:', handle);
    
    if (!wallet && !handle) {
      console.log('USER PROFILE API: No wallet or handle provided');
      return NextResponse.json({ error: 'Either wallet address or handle is required' }, { status: 400 });
    }
    
    // Temporary fix for sharafi_eth while Redis is down
    const identifier = (wallet || handle || '').toLowerCase();
    console.log('USER PROFILE API: Checking identifier:', identifier);
    
    if (identifier === 'sharafi_eth' || identifier === '@sharafi_eth' || identifier === 'alinabu' || identifier === '@alinabu') {
      console.log(`USER PROFILE API: Master admin ${identifier} detected - returning admin profile`);
      const response = { 
        user: {
          id: identifier.replace('@', '') + '_admin',
          name: identifier.replace('@', ''),
          profileImageUrl: identifier.includes('sharafi') 
            ? 'https://pbs.twimg.com/profile_images/1911790623893422080/vxsHVWbL_400x400.jpg'
            : null,
          twitterHandle: identifier.replace('@', ''),
          approvalStatus: 'approved',
          role: 'admin'
        }
      };
      console.log('USER PROFILE API: Returning hardcoded admin response:', JSON.stringify(response, null, 2));
      return NextResponse.json(response);
    }
    
    let user = null;
    
    try {
      // Try to find by wallet first
      if (wallet) {
        console.log('USER PROFILE API: Searching by wallet:', wallet);
        user = await findUserByWallet(wallet);
        console.log('USER PROFILE API: User found by wallet:', user ? 'Yes' : 'No');
      }
      
      // If no user found by wallet, or if handle is provided, try by handle
      if (!user && handle) {
        const normalizedHandle = handle.replace('@', '').toLowerCase();
        console.log('USER PROFILE API: Searching by handle in ProfileService:', normalizedHandle);
        
        // First try ProfileService which has complete data
        const unifiedProfile = await ProfileService.getProfileByHandle(normalizedHandle);
        if (unifiedProfile) {
          console.log('USER PROFILE API: Found unified profile');
          // Return the complete profile data
          const response = {
            user: {
              id: unifiedProfile.id,
              name: unifiedProfile.name,
              profileImageUrl: unifiedProfile.profileImageUrl?.replace('_normal', '_400x400'),
              twitterHandle: unifiedProfile.twitterHandle,
              approvalStatus: unifiedProfile.approvalStatus || 'pending',
              role: unifiedProfile.role || 'user',
              // Complete profile data
              email: unifiedProfile.email,
              phone: unifiedProfile.phone,
              contacts: unifiedProfile.contacts,
              shippingAddress: unifiedProfile.shippingAddress,
              bio: unifiedProfile.bio,
              country: unifiedProfile.country,
              city: unifiedProfile.city,
              socialLinks: unifiedProfile.socialLinks,
              walletAddresses: unifiedProfile.walletAddresses,
              createdAt: unifiedProfile.createdAt,
              updatedAt: unifiedProfile.updatedAt,
              notes: unifiedProfile.notes,
              // KOL specific
              isKOL: unifiedProfile.isKOL,
              currentTier: unifiedProfile.currentTier,
              kolMetrics: unifiedProfile.kolMetrics,
              campaigns: unifiedProfile.campaigns
            }
          };
          console.log('USER PROFILE API: Returning unified profile data');
          return NextResponse.json(response);
        }
        
        // Fall back to old Redis lookup
        console.log('USER PROFILE API: Searching by handle in Redis:', normalizedHandle);
        
        const userIds = await redis.smembers(`idx:username:${normalizedHandle}`);
        console.log('USER PROFILE API: User IDs found:', userIds);
        
        if (userIds && userIds.length > 0) {
          let chosen: InfluencerProfile | null = null;
          for (const id of userIds) {
            const profile = await redis.json.get(`user:${id}`) as InfluencerProfile | null;
            if (!chosen) chosen = profile;
            if (profile?.approvalStatus === 'approved') {
              chosen = profile;
              break;
            }
          }
          user = chosen;
          console.log('USER PROFILE API: User found in Redis:', user ? 'Yes' : 'No');
        }
      }
      
      // If still no user and wallet was provided, try treating wallet as a Twitter handle
      if (!user && wallet) {
        const normalizedWallet = wallet.replace('@', '').toLowerCase();
        console.log('USER PROFILE API: Trying wallet as Twitter handle:', normalizedWallet);
        user = await findUserByUsername(normalizedWallet);
        console.log('USER PROFILE API: User found by username:', user ? 'Yes' : 'No');
      }
    } catch (redisError) {
      console.error('USER PROFILE API: Redis connection error:', redisError);
      // Continue with default response
    }
    
    if (!user) {
      const defaultResponse = { 
        user: {
          id: (wallet || handle || '').substring(0, 8),
          profileImageUrl: null,
          approvalStatus: 'pending'
        }
      };
      console.log('USER PROFILE API: No user found, returning default:', JSON.stringify(defaultResponse, null, 2));
      return NextResponse.json(defaultResponse);
    }
    
    // Return the user profile with necessary fields including approval status
    const response = {
      user: {
        id: user.id,
        name: user.name,
        profileImageUrl: user.profileImageUrl?.replace('_normal', '_400x400'),
        twitterHandle: user.twitterHandle,
        approvalStatus: user.approvalStatus || 'pending',
        role: user.role || 'user',
        // Add available fields from InfluencerProfile
        bio: user.bio,
        country: user.country,
        shippingInfo: user.shippingInfo,
        socialAccounts: user.socialAccounts,
        walletAddresses: user.walletAddresses,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        adminNotes: user.adminNotes,
        // KOL specific fields
        followerCount: user.followerCount,
        followingCount: user.followingCount,
        audienceTypes: user.audienceTypes,
        chains: user.chains,
        postPricePerPost: user.postPricePerPost,
        monthlySupportBudget: user.monthlySupportBudget,
        campaigns: user.campaigns,
        campaignHistory: user.campaignHistory
      }
    };
    console.log('USER PROFILE API: Returning user data:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('USER PROFILE API: Error fetching user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
} 