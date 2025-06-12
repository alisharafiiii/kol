import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getCampaign } from '@/lib/campaign'
import { ProfileService } from '@/lib/services/profile-service'
import { v4 as uuidv4 } from 'uuid'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Configure upload directory
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'briefs')

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true })
  }
}

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
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      console.log('Upload failed: Invalid file type', file.type)
      return NextResponse.json({ 
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' 
      }, { status: 400 })
    }
    
    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      console.log('Upload failed: File too large', file.size)
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 5MB.' 
      }, { status: 400 })
    }
    
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
    }
    
    // Ensure upload directory exists
    console.log('Ensuring upload directory exists:', UPLOAD_DIR)
    await ensureUploadDir()
    
    // Verify directory exists
    if (!existsSync(UPLOAD_DIR)) {
      console.error('Upload directory does not exist after creation attempt:', UPLOAD_DIR)
      return NextResponse.json({ error: 'Upload directory error' }, { status: 500 })
    }
    
    // Read file as array buffer
    const buffer = await file.arrayBuffer()
    
    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${uuidv4()}.${fileExt}`
    const filePath = join(UPLOAD_DIR, fileName)
    
    console.log('Writing file to:', filePath)
    
    // Write file to disk
    await writeFile(filePath, Buffer.from(buffer))
    
    // Verify file was written
    if (!existsSync(filePath)) {
      console.error('File was not written successfully:', filePath)
      return NextResponse.json({ error: 'Failed to save file' }, { status: 500 })
    }
    
    // Generate URL for the uploaded file
    const fileUrl = `/uploads/briefs/${fileName}`
    
    console.log(`Brief image uploaded successfully: ${fileUrl} (${file.size} bytes)`)
    console.log('Full path:', filePath)
    
    return NextResponse.json({ 
      success: true,
      url: fileUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    })
  } catch (error) {
    console.error('Error uploading brief image:', error)
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    )
  }
} 