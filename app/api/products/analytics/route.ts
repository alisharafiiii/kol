import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { ProductService } from '@/lib/services/product-service'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user is admin or core
    const userRole = (session as any).role || (session as any).user?.role
    if (!['admin', 'core'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const analytics = await ProductService.getAnalytics()
    
    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Error fetching product analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
} 