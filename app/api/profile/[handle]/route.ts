import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { ProfileService } from '@/lib/services/profile-service'
import { ProfileMigrationService } from '@/lib/services/profile-migration'
import { UnifiedProfile } from '@/lib/types/profile'

export async function GET(
  request: NextRequest,
  { params }: { params: { handle: string } }
) {
  try {
    const handle = params.handle
    
    // Try to get profile with backward compatibility
    let profile = await ProfileMigrationService.getProfileByHandleCompat(handle)
    
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { handle: string } }
) {
  try {
    const session = await getServerSession(authOptions as any)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const handle = params.handle
    const updates = await request.json()
    
    // Get existing profile
    let profile = await ProfileMigrationService.getProfileByHandleCompat(handle)
    
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }
    
    // Check permissions
    const userHandle = (session as any).twitterHandle || (session as any).user?.name
    const userRole = (session as any).role
    
    // Normalize handles for comparison (remove @ and lowercase, but keep underscores)
    const normalizedUserHandle = userHandle?.replace('@', '').toLowerCase()
    const normalizedParamHandle = handle?.replace('@', '').toLowerCase()
    const normalizedProfileHandle = profile.twitterHandle?.replace('@', '').toLowerCase()
    
    // Special logging for Atitty case
    if (normalizedParamHandle === 'atitty_' || normalizedProfileHandle === 'atitty_') {
      console.log('=== ATITTY PROFILE UPDATE DEBUG ===')
      console.log('Session:', JSON.stringify(session, null, 2))
      console.log('User handle from session:', userHandle)
      console.log('Normalized user handle:', normalizedUserHandle)
      console.log('Param handle:', handle)
      console.log('Normalized param handle:', normalizedParamHandle)
      console.log('Profile handle:', profile.twitterHandle)
      console.log('Normalized profile handle:', normalizedProfileHandle)
      console.log('User role:', userRole)
      console.log('Is owner check:', normalizedUserHandle === normalizedParamHandle || normalizedUserHandle === normalizedProfileHandle)
      console.log('Comparison details:')
      console.log('  normalizedUserHandle === normalizedParamHandle:', normalizedUserHandle === normalizedParamHandle)
      console.log('  normalizedUserHandle === normalizedProfileHandle:', normalizedUserHandle === normalizedProfileHandle)
    }
    
    console.log('Profile update permission check:', {
      userHandle,
      normalizedUserHandle,
      paramHandle: handle,
      normalizedParamHandle,
      profileHandle: profile.twitterHandle,
      normalizedProfileHandle,
      userRole,
      sessionData: {
        twitterHandle: (session as any).twitterHandle,
        userName: (session as any).user?.name,
      }
    })
    
    const isOwner = normalizedUserHandle === normalizedParamHandle || 
                    normalizedUserHandle === normalizedProfileHandle ||
                    // Additional check: if the session user's name matches the profile handle
                    ((session as any)?.user?.name && (session as any).user.name.toLowerCase().replace('@', '') === normalizedProfileHandle) ||
                    // Check if it's the same user by comparing various possible handle formats
                    (normalizedUserHandle && normalizedProfileHandle && (
                      normalizedUserHandle === normalizedProfileHandle ||
                      normalizedUserHandle.replace('_', '') === normalizedProfileHandle.replace('_', '') ||
                      normalizedUserHandle.replace('-', '') === normalizedProfileHandle.replace('-', '')
                    ))
    const isAdmin = userRole === 'admin' || userRole === 'core' || 
                    // Special admin users
                    normalizedUserHandle === 'nabulines' || 
                    normalizedUserHandle === 'sharafi_eth' ||
                    normalizedUserHandle === 'alinabu'
    
    if (!isOwner && !isAdmin) {
      console.log('Permission denied:', { isOwner, isAdmin, normalizedUserHandle, normalizedParamHandle })
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }
    
    // Update allowed fields based on role
    const updatedProfile: UnifiedProfile = {
      ...profile,
      updatedAt: new Date(),
    }
    
    // Fields anyone can update on their own profile
    if (isOwner) {
      if (updates.name !== undefined) updatedProfile.name = updates.name
      if (updates.bio !== undefined) updatedProfile.bio = updates.bio
      if (updates.profileImageUrl !== undefined) updatedProfile.profileImageUrl = updates.profileImageUrl
      if (updates.email !== undefined) updatedProfile.email = updates.email
      if (updates.phone !== undefined) updatedProfile.phone = updates.phone
      if (updates.shippingAddress !== undefined) updatedProfile.shippingAddress = updates.shippingAddress
      if (updates.contacts !== undefined) updatedProfile.contacts = updates.contacts
      if (updates.socialLinks !== undefined) updatedProfile.socialLinks = updates.socialLinks
      if (updates.languages !== undefined) updatedProfile.languages = updates.languages
      if (updates.timezone !== undefined) updatedProfile.timezone = updates.timezone
      if (updates.country !== undefined) updatedProfile.country = updates.country
      if (updates.city !== undefined) updatedProfile.city = updates.city
    }
    
    // Fields only admins can update
    if (isAdmin) {
      if (updates.role !== undefined) updatedProfile.role = updates.role
      if (updates.approvalStatus !== undefined) {
        updatedProfile.approvalStatus = updates.approvalStatus
        if (updates.approvalStatus === 'approved') {
          updatedProfile.approvedBy = userHandle
          updatedProfile.approvedAt = new Date()
        } else if (updates.approvalStatus === 'rejected') {
          updatedProfile.rejectedBy = userHandle
          updatedProfile.rejectedAt = new Date()
        }
      }
      if (updates.isKOL !== undefined) updatedProfile.isKOL = updates.isKOL
      if (updates.tier !== undefined) updatedProfile.tier = updates.tier
      if (updates.currentTier !== undefined) updatedProfile.currentTier = updates.currentTier // Legacy support
      if (updates.tags !== undefined) updatedProfile.tags = updates.tags
      
      // Allow admins to update any field
      Object.keys(updates).forEach(key => {
        if (!(key in updatedProfile)) {
          (updatedProfile as any)[key] = updates[key]
        }
      })
    }
    
    console.log('Saving profile update:', {
      handle: profile.twitterHandle,
      isOwner,
      isAdmin,
      fieldsUpdated: Object.keys(updates)
    })
    
    // Save updated profile
    const saved = await ProfileService.saveProfile(updatedProfile)
    
    return NextResponse.json(saved)
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
} 