import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function DELETE(req: NextRequest) {
  try {
    // Check if user is logged in with Twitter and is admin
    const session: any = await getServerSession(authOptions as any);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Twitter login required' }, { status: 401 });
    }
    
    // Get Twitter handle from session
    const twitterHandle = session?.twitterHandle || session?.user?.twitterHandle || session?.user?.name;
    const normalizedHandle = twitterHandle?.toLowerCase().replace('@', '');
    
    console.log('[ADMIN DELETE-USER] Twitter handle:', twitterHandle, 'Normalized:', normalizedHandle);
    
    // Check if user is sharafi_eth (hardcoded admin) or has admin role
    if (normalizedHandle !== 'sharafi_eth') {
      const userRole = session?.user?.role || session?.role;
      console.log('[ADMIN DELETE-USER] User role:', userRole);
      
      if (userRole !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    }
    
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }
    
    console.log(`[ADMIN DELETE-USER] Attempting to delete user: ${userId}`);
    
    try {
      // Handle userId that might already include 'user:' prefix
      const redisKey = userId.startsWith('user:') ? userId : `user:${userId}`;
      const cleanUserId = userId.startsWith('user:') ? userId.replace('user:', '') : userId;
      
      // Get user data – if we can't find by ID, attempt by handle set
      let user = await redis.json.get(redisKey) as any;
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Build list of user IDs that share the same Twitter handle (duplicates)
      let duplicateIds: string[] = [];
      if (user.twitterHandle) {
        const hNorm = user.twitterHandle.replace('@','').toLowerCase();
        duplicateIds = await redis.smembers(`idx:username:${hNorm}`);
      }
      if (!duplicateIds.includes(cleanUserId)) duplicateIds.push(cleanUserId);
      
      // Helper to cleanup indexes for a single profile
      const cleanupForProfile = async (uId: string, profile: any) => {
        const promises = [];
        if (profile.twitterHandle) {
          const h = profile.twitterHandle.replace('@','').toLowerCase();
          promises.push(redis.srem(`idx:username:${h}`, uId));
        }
        if (profile.walletAddresses) {
          Object.values(profile.walletAddresses).forEach((addr: any) => {
            if (typeof addr === 'string') promises.push(redis.srem(`idx:wallet:${addr.toLowerCase()}`, uId));
          })
        }
        if (profile.approvalStatus) promises.push(redis.srem(`idx:status:${profile.approvalStatus}`, uId));
        if (profile.name) {
          const dn = profile.name.toLowerCase().replace(/\s+/g,'');
          promises.push(redis.srem(`idx:displayname:${dn}`, uId));
        }
        if (profile.role) promises.push(redis.srem(`idx:role:${profile.role}`, uId));
        promises.push(redis.del(`user:${uId}`));
        await Promise.all(promises);
      };

      // Iterate over duplicates and clean each
      for (const dupId of duplicateIds) {
        const dupProfile = dupId === userId ? user : await redis.json.get(`user:${dupId}`);
        if (dupProfile) await cleanupForProfile(dupId, dupProfile);
      }
      
      console.log(`[ADMIN DELETE-USER] Deleted profiles: ${duplicateIds.join(', ')}`);
      
      return NextResponse.json({ 
        success: true, 
        message: `Users ${duplicateIds.join(', ')} deleted successfully`,
        deletedBy: twitterHandle 
      });
    } catch (redisError) {
      console.error('[ADMIN DELETE-USER] Redis error:', redisError);
      return NextResponse.json({ 
        error: 'Failed to delete user - database error' 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('[ADMIN DELETE-USER] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 