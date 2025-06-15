import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
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
    const isOwner = userHandle === handle
    const isAdmin = userRole === 'admin' || userRole === 'core'
    
    if (!isOwner && !isAdmin) {
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