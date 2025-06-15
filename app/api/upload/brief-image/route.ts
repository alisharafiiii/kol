import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getCampaign } from '@/lib/campaign'
import { ProfileService } from '@/lib/services/profile-service'
import { join } from 'path'
import { createSecureUploadHandler } from '@/lib/file-upload-security'
import { logAdminAccess } from '@/lib/admin-config'

// Configure upload directory
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'briefs')

// Create secure upload handler for brief images
const uploadHandler = createSecureUploadHandler(UPLOAD_DIR, {
  category: 'image',
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  processImages: true,
  scanViruses: false // Enable in production with ClamAV
})

export async function POST(request: NextRequest) {
  try {
    console.log('Brief image upload started')
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.name) {
      console.log('Upload denied: No session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('Upload user:', session.user.name)
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    const campaignId = formData.get('campaignId') as string
    
    if (!file) {
      console.log('Upload failed: No file provided')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    console.log('Upload file:', file.name, file.type, file.size, 'bytes')
    
    // If campaignId provided, check permissions
    if (campaignId) {
      console.log('Checking permissions for campaign:', campaignId)
      const campaign = await getCampaign(campaignId)
      if (!campaign) {
        console.log('Upload failed: Campaign not found')
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }
      
      const userHandle = (session.user as any).twitterHandle || session.user.name
      const profile = await ProfileService.getProfileByHandle(userHandle)
      const isAdmin = profile?.role === 'admin' || profile?.role === 'core'
      
      // Check if user has permission to edit this campaign
      if (!isAdmin && campaign.createdBy !== userHandle && !campaign.teamMembers.includes(userHandle)) {
        console.log('Upload failed: Permission denied for user', userHandle)
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
      }
      
      // Log admin action if admin is uploading
      if (isAdmin) {
        logAdminAccess(userHandle, 'campaign_brief_image_upload', {
          campaignId,
          campaignName: campaign.name,
          fileName: file.name,
          fileSize: file.size
        })
      }
    }
    
    // Process upload using secure handler
    const result = await uploadHandler(file)
    
    if (!result.success) {
      console.log('Upload failed:', result.error)
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    console.log(`Brief image uploaded successfully: ${result.url} (${file.size} bytes)`)
    console.log('Upload details:', result.details)
    
    return NextResponse.json({ 
      success: true,
      url: result.url,
      fileName: result.details.originalName,
      fileSize: result.details.size,
      fileType: result.details.type,
      secureName: result.details.secureName
    })
  } catch (error) {
    console.error('Error uploading brief image:', error)
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    )
  }
} 