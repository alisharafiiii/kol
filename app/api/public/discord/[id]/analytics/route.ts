import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { DiscordService } from '@/lib/services/discord-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication and role
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session as any)?.role || (session.user as any)?.role
    const allowedRoles = ['admin', 'core', 'team', 'viewer']
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden - insufficient role permissions' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get('timeframe') as 'daily' | 'weekly' | 'monthly' | 'custom' || 'weekly'
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    const analytics = await DiscordService.getAnalytics(params.id, timeframe, startDate, endDate)

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Error fetching Discord analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
} 