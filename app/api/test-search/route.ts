import { ProfileService } from '@/lib/services/profile-service'
import { NextResponse } from 'next/server'

export async function GET() {
  const results = await ProfileService.searchProfiles({
    approvalStatus: 'approved'
  })
  return NextResponse.json(results)
} 