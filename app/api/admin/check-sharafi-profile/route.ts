import { NextResponse } from 'next/server';
import { ProfileService } from '@/lib/services/profile-service';
import { redis } from '@/lib/redis';

export async function GET() {
  try {
    console.log('🔍 Checking sharafi_eth profile...\n');
    
    // Check all possible places where sharafi's data might be
    const results: any = {
      profiles: [],
      redisData: {},
      indexes: {}
    };
    
    // 1. Check ProfileService
    const profiles = await ProfileService.searchProfiles({});
    const sharafiProfiles = profiles.filter(p => 
      p.twitterHandle === 'sharafi_eth' || 
      p.name === 'nabu.base.eth' ||
      p.id === 'user_sharafi_eth' ||
      p.id === 'twitter_sharafi_eth' ||
      p.id?.includes('sharafi')
    );
    
    results.profiles = sharafiProfiles.map(p => ({
      id: p.id,
      twitterHandle: p.twitterHandle,
      name: p.name,
      role: p.role,
      approvalStatus: p.approvalStatus
    }));
    
    // 2. Check Redis directly
    const directKeys = [
      'user:user_sharafi_eth',
      'user_sharafi_eth',
      'profile:user_sharafi_eth',
      'user:twitter_sharafi_eth'
    ];
    
    for (const key of directKeys) {
      try {
        const data = await redis.json.get(key);
        if (data) {
          results.redisData[key] = data;
        }
      } catch (e) {
        // Key doesn't exist
      }
    }
    
    // 3. Check indexes
    results.indexes.username = await redis.smembers('idx:username:sharafi_eth');
    results.indexes.profileHandle = await redis.smembers('idx:profile:handle:sharafi_eth');
    
    // 4. Check if nabu.base.eth is in any indexes
    const nabuProfiles = profiles.filter(p => p.name === 'nabu.base.eth');
    results.nabuProfiles = nabuProfiles.map(p => ({
      id: p.id,
      twitterHandle: p.twitterHandle,
      name: p.name,
      role: p.role
    }));
    
    return NextResponse.json({
      success: true,
      data: results,
      summary: {
        profilesFound: results.profiles.length,
        redisKeysFound: Object.keys(results.redisData).length,
        usernameIndexEntries: results.indexes.username?.length || 0,
        nabuProfilesFound: results.nabuProfiles?.length || 0
      }
    });
  } catch (error) {
    console.error('Error checking sharafi profile:', error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
} 