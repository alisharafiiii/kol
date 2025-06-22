import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redis } from '@/lib/redis';
import { hasAdminAccess, logAdminAccess } from '@/lib/admin-config';

export async function POST(req: NextRequest) {
  try {
    // Check authentication - only admins can invalidate sessions
    const session: any = await getServerSession(authOptions as any);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const twitterHandle = session?.twitterHandle || session?.user?.twitterHandle || session?.user?.name;
    const normalizedHandle = twitterHandle?.toLowerCase().replace('@', '');
    const userRole = session?.role || session?.user?.role;
    
    // Check admin access
    if (!hasAdminAccess(normalizedHandle, userRole) && userRole !== 'admin' && userRole !== 'core') {
      return NextResponse.json({ error: 'Admin or core access required' }, { status: 403 });
    }
    
    const { userHandle } = await req.json();
    
    if (!userHandle) {
      return NextResponse.json({ error: 'User handle is required' }, { status: 400 });
    }
    
    const targetHandle = userHandle.toLowerCase().replace('@', '');
    
    console.log(`[Session Invalidation] Admin ${normalizedHandle} invalidating session for ${targetHandle}`);
    
    // Log admin action
    logAdminAccess(normalizedHandle, 'session_invalidation', {
      targetUser: targetHandle,
      reason: 'role_change'
    });
    
    // Set a flag that will force the user to re-authenticate
    // NextAuth will check this on the next request
    const invalidationKey = `auth:invalidate:${targetHandle}`;
    await redis.set(invalidationKey, Date.now(), { ex: 3600 }); // Expire after 1 hour
    
    return NextResponse.json({ 
      success: true,
      message: `Session invalidation triggered for ${targetHandle}. User will need to log in again.`
    });
    
  } catch (error) {
    console.error('Error invalidating session:', error);
    return NextResponse.json({ error: 'Failed to invalidate session' }, { status: 500 });
  }
} 