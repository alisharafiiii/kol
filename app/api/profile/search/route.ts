import { NextRequest, NextResponse } from 'next/server'
import { ProfileService } from '@/lib/services/profile-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const approved = searchParams.get('approved') === 'true'
    
    if (!query || query.length < 2) {
      return NextResponse.json([])
    }
    
    // Search profiles
    const profiles = await ProfileService.searchProfiles({ searchTerm: query })
    
    // Filter by approval status if requested
    let results = profiles
    if (approved) {
      results = profiles.filter(p => p.approvalStatus === 'approved')
    }
    
    // Limit results
    const limitedResults = results.slice(0, 10)
    
    return NextResponse.json(limitedResults)
  } catch (error: any) {
    console.error('Profile search error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search profiles' },
      { status: 500 }
    )
  }
} 