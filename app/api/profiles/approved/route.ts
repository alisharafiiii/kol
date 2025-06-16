import { NextRequest, NextResponse } from 'next/server'
import { ProfileService } from '@/lib/services/profile-service'
import { UnifiedProfile } from '@/lib/types/profile'

export async function GET(request: NextRequest) {
  try {
    console.log('[Approved Profiles API] Starting search...')
    
    // Search for all profiles (empty filter returns all)
    const allProfiles = await ProfileService.searchProfiles({})
    console.log('[Approved Profiles API] Total profiles found:', allProfiles.length)
    
    // Filter for approved users (those with role)
    const approvedProfiles = allProfiles.filter((profile: UnifiedProfile) => 
      profile.role && ['admin', 'core', 'team', 'kol'].includes(profile.role)
    )
    console.log('[Approved Profiles API] Approved profiles found:', approvedProfiles.length)
    
    // Map to simplified format for autocomplete
    const profiles = approvedProfiles.map((profile: UnifiedProfile) => ({
      handle: profile.twitterHandle,
      name: profile.name || profile.twitterHandle,
      profileImageUrl: profile.profileImageUrl,
      role: profile.role
    }))
    
    // Sort by role priority and then by name
    const rolePriority = { admin: 0, core: 1, team: 2, kol: 3 }
    profiles.sort((a: any, b: any) => {
      const aPriority = rolePriority[a.role as keyof typeof rolePriority] ?? 999
      const bPriority = rolePriority[b.role as keyof typeof rolePriority] ?? 999
      if (aPriority !== bPriority) return aPriority - bPriority
      return (a.name || '').localeCompare(b.name || '')
    })
    
    console.log('[Approved Profiles API] Returning profiles:', profiles.length)
    
    // Return array directly for compatibility with frontend
    return NextResponse.json(profiles)
  } catch (error) {
    console.error('Error fetching approved profiles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch approved profiles' },
      { status: 500 }
    )
  }
} 