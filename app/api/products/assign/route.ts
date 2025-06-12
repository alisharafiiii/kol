import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { ProductService } from '@/lib/services/product-service'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user has permission (admin or team member)
    const userRole = (session as any).role || (session as any).user?.role
    const userHandle = (session as any).twitterHandle || session.user.name
    
    const body = await request.json()
    const { productId, campaignId, kolId, notes } = body
    
    if (!productId || !campaignId || !kolId) {
      return NextResponse.json(
        { error: 'Product ID, Campaign ID, and KOL ID are required' },
        { status: 400 }
      )
    }
    
    const assignment = await ProductService.assignProduct(
      productId,
      campaignId,
      kolId,
      notes
    )
    
    return NextResponse.json(assignment)
  } catch (error: any) {
    console.error('Error assigning product:', error)
    
    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    
    if (error.message?.includes('out of stock')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json(
      { error: 'Failed to assign product' },
      { status: 500 }
    )
  }
} 