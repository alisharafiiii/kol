import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsername } from '@/lib/user-identity';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isMasterAdmin, logAdminAccess } from '@/lib/admin-config';

export async function GET(req: NextRequest) {
  console.log('=== USER ROLE API: Request received ===');
  
  try {
    // Check if user is logged in with Twitter
    const session: any = await getServerSession(authOptions as any);
    console.log('USER ROLE API: Session data:', JSON.stringify(session, null, 2));
    
    if (!session?.user) {
      console.log('USER ROLE API: No session user found');
      return NextResponse.json({ error: 'Twitter login required' }, { status: 401 });
    }
    
    // Get handle from query parameter or session
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get('handle');
    console.log('USER ROLE API: Handle from query:', handle);
    
    // Get the session handle
    const sessionHandle = session?.twitterHandle || session?.user?.name;
    const checkHandle = handle || sessionHandle;
    
    if (!checkHandle) {
      console.log('USER ROLE API: No handle found');
      return NextResponse.json({ error: 'No handle provided' }, { status: 400 });
    }
    
    // Normalize handle for checking
    const normalizedHandle = checkHandle.replace('@', '').toLowerCase();
    console.log('USER ROLE API: Checking handle:', normalizedHandle);
    
    // Check for master admin FIRST, before any Redis calls
    if (isMasterAdmin(normalizedHandle)) {
      console.log('USER ROLE API: Master admin detected - returning admin role');
      logAdminAccess(normalizedHandle, 'role_check', { 
        method: 'master_admin',
        api: 'user_role'
      });
      return NextResponse.json({ 
        role: 'admin',
        handle: checkHandle,
        approvalStatus: 'approved'
      });
    }
    
    // Try to get user from Redis
    try {
      const user = await findUserByUsername(normalizedHandle);
      console.log('USER ROLE API: User found in Redis:', user ? 'Yes' : 'No');
      
      if (!user) {
        const response = { 
          role: 'scout', // Default role if user not found
          handle: checkHandle
        };
        console.log('USER ROLE API: User not found, returning default:', response);
        return NextResponse.json(response);
      }
      
      const response = { 
        role: user.role,
        handle: checkHandle,
        approvalStatus: user.approvalStatus
      };
      console.log('USER ROLE API: Returning user data:', response);
      return NextResponse.json(response);
    } catch (redisError) {
      console.error('USER ROLE API: Redis error in role check:', redisError);
      
      // Even if Redis is down, still return admin for master admins
      if (isMasterAdmin(normalizedHandle)) {
        console.log('USER ROLE API: Redis down but master admin detected - returning admin role');
        logAdminAccess(normalizedHandle, 'role_check', { 
          method: 'redis_fallback',
          error: 'redis_down',
          api: 'user_role'
        });
        return NextResponse.json({ 
          role: 'admin',
          handle: checkHandle,
          approvalStatus: 'approved'
        });
      }
      
      // For other users when Redis is down
      const response = { 
        role: 'scout',
        handle: checkHandle,
        error: 'Database temporarily unavailable'
      };
      console.log('USER ROLE API: Redis down, returning default:', response);
      return NextResponse.json(response);
    }
    
  } catch (error) {
    console.error('USER ROLE API: Error fetching user role:', error);
    
    // Even in case of complete failure, check for master admins
    const session: any = await getServerSession(authOptions as any);
    const sessionHandle = session?.twitterHandle || session?.user?.name;
    if (sessionHandle && isMasterAdmin(sessionHandle)) {
      logAdminAccess(sessionHandle, 'role_check', { 
        method: 'error_fallback',
        error: error instanceof Error ? error.message : 'unknown',
        api: 'user_role'
      });
      return NextResponse.json({ 
        role: 'admin',
        handle: sessionHandle,
        approvalStatus: 'approved'
      });
    }
    
    return NextResponse.json({ 
      error: 'Failed to fetch user role',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 