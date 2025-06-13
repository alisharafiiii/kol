import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get('handle');
    
    if (!handle) {
      return NextResponse.json({ error: 'Handle is required' }, { status: 400 });
    }
    
    const normalizedHandle = handle.replace('@', '').toLowerCase();
    
    // Get user IDs by handle
    const userIds = await redis.smembers(`idx:username:${normalizedHandle}`);
    
    if (!userIds || userIds.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Get the full profile
    let profile = null;
    for (const userId of userIds) {
      const userProfile = await redis.json.get(`user:${userId}`);
      if (userProfile) {
        profile = userProfile;
        break;
      }
    }
    
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    return NextResponse.json(profile);
    
  } catch (error) {
    console.error('Error fetching full user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get('handle');
    const updates = await req.json();
    
    console.log('[FULL-PROFILE PUT] Request:', { handle, updates });
    
    // Check if user is admin
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Check admin permissions
    const userRole = session?.user?.role || session?.role;
    const twitterHandle = session?.twitterHandle || session?.user?.twitterHandle || session?.user?.name;
    const normalizedSessionHandle = twitterHandle?.toLowerCase().replace('@', '');
    
    if (normalizedSessionHandle !== 'sharafi_eth' && userRole !== 'admin' && userRole !== 'core') {
      return NextResponse.json({ error: 'Admin or Core access required' }, { status: 403 });
    }
    
    if (!handle) {
      return NextResponse.json({ error: 'Handle is required' }, { status: 400 });
    }
    
    const normalizedHandle = handle.replace('@', '').toLowerCase();
    
    // Get user IDs by handle
    const userIds = await redis.smembers(`idx:username:${normalizedHandle}`);
    
    console.log('[FULL-PROFILE PUT] Found user IDs:', userIds);
    
    if (!userIds || userIds.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Update the profile
    const userId = userIds[0];
    const existingProfile = await redis.json.get(`user:${userId}`);
    
    console.log('[FULL-PROFILE PUT] Existing profile:', existingProfile);
    
    if (!existingProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Merge updates with existing profile
    const updatedProfile = {
      ...existingProfile,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    console.log('[FULL-PROFILE PUT] Updated profile to save:', updatedProfile);
    
    // Save updated profile - make sure it's serialized properly
    await redis.json.set(`user:${userId}`, '$', JSON.parse(JSON.stringify(updatedProfile)));
    
    console.log('[FULL-PROFILE PUT] Profile saved successfully');
    
    // Update role index if role changed
    if (updates.role && updates.role !== (existingProfile as any).role) {
      console.log('[FULL-PROFILE PUT] Updating role indexes');
      // Remove from old role index
      if ((existingProfile as any).role) {
        await redis.srem(`idx:role:${(existingProfile as any).role}`, userId);
      }
      // Add to new role index
      await redis.sadd(`idx:role:${updates.role}`, userId);
      console.log('[FULL-PROFILE PUT] Role indexes updated');
    }
    
    // Verify the save by reading it back
    const verifyProfile = await redis.json.get(`user:${userId}`);
    console.log('[FULL-PROFILE PUT] Verification - saved profile:', verifyProfile);
    
    return NextResponse.json(updatedProfile);
    
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
} 