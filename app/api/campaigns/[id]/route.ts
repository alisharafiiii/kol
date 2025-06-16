import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getCampaign, updateCampaign, deleteCampaign } from '@/lib/campaign'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaign = await getCampaign(params.id)
    
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    return NextResponse.json(campaign)
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    console.log('Campaign API - Session data:', {
      hasSession: !!session,
      userName: session?.user?.name,
      userEmail: session?.user?.email,
      userRole: (session as any)?.role || (session as any)?.user?.role
    })
    
    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized - No session' }, { status: 401 })
    }
    
    const updates = await request.json()
    
    console.log('Campaign update request:', {
      campaignId: params.id,
      updates,
      user: session.user.name
    })
    
    // Extract role from session
    const sessionRole = (session as any)?.role || (session as any)?.user?.role
    
    const campaign = await updateCampaign(params.id, updates, session.user.name, sessionRole)
    
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    return NextResponse.json(campaign)
  } catch (error: any) {
    console.error('Error updating campaign:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized - Permission denied' }, { status: 403 })
    }
    
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const success = await deleteCampaign(params.id, session.user.name)
    
    if (!success) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting campaign:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Only campaign creator can delete' }, { status: 403 })
    }
    
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  }
} 