import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { identifyUser } from '@/lib/user-identity';

/**
 * API endpoint to handle Twitter-based identity management
 */
export async function POST(request: NextRequest) {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    
    // Check if we have a logged in user with Twitter data
    if (!session?.user) {
      return NextResponse.json({ 
        error: 'No authenticated session found',
        identity: null 
      }, { status: 401 });
    }
    
    // Extract Twitter data from session
    const { name, image } = session.user;
    // Get Twitter handle from token if available
    const twitterHandle = (session as any)?.twitterHandle || name;
    
    if (twitterHandle) {
      // Create Twitter data - DO NOT include role or approvalStatus to preserve admin settings
      const twitterData = {
        twitterHandle: twitterHandle.startsWith('@') ? twitterHandle : `@${twitterHandle}`,
        name: name || twitterHandle,
        profileImageUrl: image || undefined,
        socialAccounts: {
          twitter: {
            handle: twitterHandle.replace('@', ''),
            followers: 0 // We would need to fetch this separately
          }
        }
      };
      
      // Identify or create user
      const { user, isNewUser } = await identifyUser(twitterData);
      
      return NextResponse.json({
        success: true,
        identity: {
          name: user.name,
          username: twitterHandle,
          profile_image_url: user.profileImageUrl || image,
          approvalStatus: user.approvalStatus || 'pending'
        },
        isNewUser
      });
    }
    
    // Return session data even if we couldn't process it fully
    return NextResponse.json({
      success: true,
      identity: {
        name: session.user.name,
        username: (session.user as any)?.username || session.user.name,
        profile_image_url: session.user.image,
        approvalStatus: 'pending'
      }
    });
  } catch (error) {
    console.error('Error in Twitter identity API:', error);
    return NextResponse.json(
      { error: 'Failed to process Twitter identity' },
      { status: 500 }
    );
  }
} 