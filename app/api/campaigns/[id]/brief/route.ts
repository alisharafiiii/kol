import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getCampaign, updateCampaignBrief } from '@/lib/campaign'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaign = await getCampaign(params.id)
    
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    return NextResponse.json({
      brief: campaign.brief,
      briefUpdatedAt: campaign.briefUpdatedAt,
      briefUpdatedBy: campaign.briefUpdatedBy
    })
  } catch (error: any) {
    console.error('Error fetching campaign brief:', error)
    return NextResponse.json({ error: 'Failed to fetch brief' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { brief } = await request.json()
    const userHandle = (session.user as any).twitterHandle || session.user.name
    
    // Use the existing helper function which handles permissions and updates
    const updatedCampaign = await updateCampaignBrief(params.id, brief, userHandle)
    
    if (!updatedCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating campaign brief:', error)
    
    // Handle specific error from the helper function
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }
    
    return NextResponse.json({ error: 'Failed to update brief' }, { status: 500 })
  }
} 