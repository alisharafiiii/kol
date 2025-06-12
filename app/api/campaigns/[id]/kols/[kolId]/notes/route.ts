import { NextRequest, NextResponse } from 'next/server'
import { ProfileService } from '@/lib/services/profile-service'
import { getCampaign } from '@/lib/campaign'
import { checkAuth } from '@/lib/auth-utils'
import { redis, InfluencerProfile } from '@/lib/redis'
import { NotificationService } from '@/lib/notification-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; kolId: string } }
) {
  try {
    // Check auth - anyone with access can add notes
    const auth = await checkAuth(request, ['admin', 'core', 'team'])
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    if (!auth.hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }
    
    const campaignId = params.id
    const kolId = params.kolId
    const { content } = await request.json()
    
    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 }
      )
    }
    
    // Get the campaign to find the KOL
    const campaign = await getCampaign(campaignId)
    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    // Find the KOL in the campaign
    const kol = campaign.kols.find(k => k.id === kolId)
    if (!kol) {
      return NextResponse.json(
        { error: 'KOL not found in campaign' },
        { status: 404 }
      )
    }
    
    // Get or create profile for the KOL
    let profile = await ProfileService.getProfileByHandle(kol.handle)
    if (!profile) {
      // Create a basic profile if it doesn't exist
      profile = await ProfileService.saveProfile({
        id: '',
        twitterHandle: kol.handle,
        name: kol.name,
        profileImageUrl: kol.pfp,
        role: 'kol',
        approvalStatus: 'approved',
        isKOL: true,
        currentTier: kol.tier,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
    
    // Add the note
    const note = await ProfileService.addNote(
      profile.id,
      auth.user?.twitterHandle || 'unknown',
      auth.user?.name || 'Unknown User',
      content,
      campaignId,
      auth.user?.image
    )
    
    // Send email notifications to admin and core members
    const notificationEmails: string[] = []
    
    // Get all team members with admin or core role
    const teamMembers = [...(campaign.teamMembers || []), campaign.createdBy].filter(Boolean)
    console.log('📧 Campaign details:', {
      campaignName: campaign.name,
      createdBy: campaign.createdBy,
      teamMembers: campaign.teamMembers,
      totalMembers: teamMembers.length
    })
    console.log('📧 Checking team members for email notifications:', teamMembers)
    
    for (const memberHandle of teamMembers) {
      // First try ProfileService
      let memberProfile = await ProfileService.getProfileByHandle(memberHandle)
      let email: string | undefined
      let role: string | undefined
      
      if (memberProfile) {
        email = memberProfile.email
        role = memberProfile.role
      } else {
        // Fall back to old InfluencerProfile system
        const normalizedHandle = memberHandle.replace('@', '').toLowerCase()
        const userIds = await redis.smembers(`idx:username:${normalizedHandle}`)
        
        if (userIds && userIds.length > 0) {
          // Try to find an approved profile or just take the first one
          for (const userId of userIds) {
            const influencerProfile = await redis.json.get(`user:${userId}`) as InfluencerProfile | null
            if (influencerProfile) {
              role = influencerProfile.role
              
              // Extract email from various possible locations
              // 1. Check if there's a direct email field (even though not in interface)
              const profileData = influencerProfile as any
              if (profileData.email) {
                email = profileData.email
              }
              // 2. Check contacts field (from user profile data)
              else if (profileData.contacts?.email) {
                email = profileData.contacts.email
              }
              // 3. Check shippingInfo for email-like strings
              else if (influencerProfile.shippingInfo) {
                const shippingText = JSON.stringify(influencerProfile.shippingInfo)
                const emailMatch = shippingText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
                if (emailMatch) {
                  email = emailMatch[0]
                }
              }
              // 4. Check bio for email
              else if (influencerProfile.bio) {
                const emailMatch = influencerProfile.bio.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
                if (emailMatch) {
                  email = emailMatch[0]
                }
              }
              // 5. Check adminNotes for email
              else if (influencerProfile.adminNotes) {
                const emailMatch = influencerProfile.adminNotes.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
                if (emailMatch) {
                  email = emailMatch[0]
                }
              }
              // 6. Check any other fields that might contain email
              else {
                const fullProfileText = JSON.stringify(influencerProfile)
                const emailMatch = fullProfileText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
                if (emailMatch) {
                  // Filter out potential false positives
                  const validEmail = emailMatch.find(e => !e.includes('example.com') && !e.includes('test.com'))
                  email = validEmail || emailMatch[0]
                }
              }
              
              console.log(`📧 Found member ${memberHandle} in InfluencerProfile:`, {
                hasEmail: !!email,
                role: role,
                extractedFrom: email ? 
                  (profileData.email ? 'direct email field' : 
                   profileData.contacts?.email ? 'contacts.email' :
                   influencerProfile.shippingInfo && JSON.stringify(influencerProfile.shippingInfo).includes(email) ? 'shippingInfo' : 
                   influencerProfile.bio && influencerProfile.bio.includes(email) ? 'bio' :
                   influencerProfile.adminNotes && influencerProfile.adminNotes.includes(email) ? 'adminNotes' :
                   'full profile scan') : 'not found'
              })
              break
            }
          }
        }
      }
      
      console.log(`📧 Checking member ${memberHandle}:`, {
        hasProfile: !!memberProfile,
        foundInOldSystem: !memberProfile && !!email,
        role: role,
        hasEmail: !!email,
        email: email
      })
      
      if (email && role && ['admin', 'core'].includes(role)) {
        notificationEmails.push(email)
      }
    }
    
    console.log('📧 Collected notification emails:', notificationEmails)
    
    // Send email notifications
    if (notificationEmails.length > 0) {
      try {
        console.log('📧 Sending email notifications to:', notificationEmails)
        
        // Queue notifications for each recipient
        const notificationIds = []
        for (const email of notificationEmails) {
          const id = await NotificationService.queue({
            type: 'note_added',
            recipientEmail: email,
            recipientName: email.split('@')[0],
            subject: `New note added for ${kol.name} in ${campaign.name}`,
            message: `
New Note Added

Campaign: ${campaign.name}
KOL: ${kol.name} (@${kol.handle})
Added by: ${auth.user?.name || 'Unknown'}

Note:
${content}

View Campaign: ${process.env.NEXTAUTH_URL || 'https://nabulines.com'}/campaigns/${campaign.slug}
`,
            priority: 'high'
          })
          notificationIds.push(id)
        }
        
        // Process high priority notifications immediately
        await NotificationService.processPending(5)
        
        console.log('📧 Email notifications queued:', {
          success: true,
          notificationIds,
          count: notificationIds.length
        })
      } catch (error) {
        console.error('📧 Failed to send email notifications:', error)
      }
    } else {
      console.log('📧 No email recipients found - no admin/core members with emails')
    }
    
    return NextResponse.json({ note: note, success: true })
  } catch (error) {
    console.error('Error adding note:', error)
    return NextResponse.json(
      { error: 'Failed to add note' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; kolId: string } }
) {
  try {
    const campaignId = params.id
    const kolId = params.kolId
    
    // Get the campaign to find the KOL
    const campaign = await getCampaign(campaignId)
    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    // Find the KOL in the campaign
    const kol = campaign.kols.find(k => k.id === kolId)
    if (!kol) {
      return NextResponse.json(
        { error: 'KOL not found in campaign' },
        { status: 404 }
      )
    }
    
    // Get profile for the KOL
    const profile = await ProfileService.getProfileByHandle(kol.handle)
    if (!profile) {
      return NextResponse.json({ notes: [] })
    }
    
    // Return notes for this campaign
    const campaignNotes = profile.notes?.filter(n => n.campaignId === campaignId) || []
    
    // Enrich notes with author images
    const enrichedNotes = await Promise.all(
      campaignNotes.map(async (note) => {
        // Try to get author profile for image
        if (!note.authorImage && note.authorId) {
          try {
            const authorProfile = await ProfileService.getProfileByHandle(note.authorId)
            if (authorProfile?.profileImageUrl) {
              return { ...note, authorImage: authorProfile.profileImageUrl }
            }
          } catch (error) {
            console.error('Error fetching author profile:', error)
          }
        }
        return note
      })
    )
    
    return NextResponse.json({ notes: enrichedNotes })
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    )
  }
} 