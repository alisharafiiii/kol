import { NextRequest, NextResponse } from 'next/server'
import { ProfileService } from '@/lib/services/profile-service'
 
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    
    // Search using ProfileService
    const profiles = await ProfileService.searchProfiles({
      searchTerm: query
    })
    
    // Map to expected format
    const results = profiles.map(profile => ({
      id: profile.id,
      name: profile.name || profile.twitterHandle || 'Unknown',
      twitterHandle: profile.twitterHandle,
      profileImageUrl: profile.profileImageUrl,
      role: profile.role,
      approvalStatus: profile.approvalStatus,
      tier: profile.tier,
      isKOL: profile.isKOL
    }))
    
    return NextResponse.json({ profiles: results })
  } catch (error) {
    console.error('Error searching profiles:', error)
    return NextResponse.json({ profiles: [] })
  }
} 