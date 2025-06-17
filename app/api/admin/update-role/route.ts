import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { ProfileService } from '@/lib/services/profile-service';
import { redis, InfluencerProfile } from '@/lib/redis';
import { hasAdminAccess, logAdminAccess } from '@/lib/admin-config';

export async function POST(req: NextRequest) {
  console.log('=== UPDATE ROLE API: Request received ===');
  
  try {
    // Check authentication
    const session: any = await getServerSession(authOptions as any);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user role
    const twitterHandle = session?.twitterHandle || session?.user?.twitterHandle || session?.user?.name;
    const normalizedSessionHandle = twitterHandle?.toLowerCase().replace('@', '');
    let userRole = session?.role || session?.user?.role;
    
    // Check if user has admin or core permissions
    if (!hasAdminAccess(normalizedSessionHandle, userRole) && userRole !== 'admin' && userRole !== 'core') {
      return NextResponse.json({ error: 'Only admin or core users can update roles' }, { status: 403 });
    }
    
    const { handle, role, approvalStatus } = await req.json();
    
    if (!handle) {
      return NextResponse.json({ error: 'Handle is required' }, { status: 400 });
    }
    
    const normalizedHandle = handle.replace('@', '').toLowerCase();
    console.log('UPDATE ROLE API: Updating role for handle:', normalizedHandle, 'to:', role);
    
    // Log admin access
    logAdminAccess(normalizedSessionHandle, 'role_update', {
      method: userRole,
      targetHandle: handle,
      newRole: role,
      newApprovalStatus: approvalStatus,
      api: 'update_role'
    });
    
    // First try ProfileService (new system)
    let profile = await ProfileService.getProfileByHandle(normalizedHandle);
    
    if (profile) {
      console.log('UPDATE ROLE API: Found profile in ProfileService');
      
      // Update fields
      if (role !== undefined) profile.role = role;
      if (approvalStatus !== undefined) profile.approvalStatus = approvalStatus;
      
      // Save updated profile
      await ProfileService.saveProfile(profile);
      
      console.log('UPDATE ROLE API: Profile updated successfully in ProfileService');
      
      return NextResponse.json({ 
        success: true,
        message: 'Role updated successfully',
        profile: {
          id: profile.id,
          handle: profile.twitterHandle,
          name: profile.name,
          role: profile.role,
          approvalStatus: profile.approvalStatus
        }
      });
    }
    
    // Fall back to old Redis system
    console.log('UPDATE ROLE API: Profile not found in ProfileService, checking old Redis system...');
    
    const userIds = await redis.smembers(`idx:username:${normalizedHandle}`);
    if (!userIds || userIds.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = userIds[0];
    const user = await redis.json.get(`user:${userId}`) as InfluencerProfile | null;
    
    if (!user) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }
    
    // Update user
    const updatedUser = { ...user };
    if (role !== undefined) updatedUser.role = role;
    if (approvalStatus !== undefined) updatedUser.approvalStatus = approvalStatus;
    updatedUser.updatedAt = new Date().toISOString();
    
    // Save updated user
    await redis.json.set(`user:${userId}`, '$', updatedUser);
    
    console.log('UPDATE ROLE API: User updated successfully in old Redis system');
    
    return NextResponse.json({ 
      success: true,
      message: 'Role updated successfully',
      profile: {
        id: userId,
        handle: user.twitterHandle,
        name: user.name,
        role: updatedUser.role,
        approvalStatus: updatedUser.approvalStatus
      }
    });
    
  } catch (error) {
    console.error('UPDATE ROLE API: Error updating role:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
} 