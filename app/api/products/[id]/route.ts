import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { ProductService } from '@/lib/services/product-service'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    
    const product = await ProductService.getProduct(params.id)
    
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    
    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user is admin
    const userRole = (session as any).role || (session as any).user?.role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Only admins can update products' }, { status: 403 })
    }
    
    const body = await request.json()
    const updates: any = {}
    
    // Only update provided fields
    if (body.name !== undefined) updates.name = body.name
    if (body.price !== undefined) updates.price = parseFloat(body.price)
    if (body.image !== undefined) updates.image = body.image
    if (body.description !== undefined) updates.description = body.description
    if (body.projectId !== undefined) updates.projectId = body.projectId
    if (body.category !== undefined) updates.category = body.category
    if (body.stock !== undefined) updates.stock = parseInt(body.stock)
    if (body.active !== undefined) updates.active = body.active
    
    const product = await ProductService.updateProduct(params.id, updates)
    
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    
    return NextResponse.json(product)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user is admin
    const userRole = (session as any).role || (session as any).user?.role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Only admins can delete products' }, { status: 403 })
    }
    
    const success = await ProductService.deleteProduct(params.id)
    
    if (!success) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting product:', error)
    
    if (error.message?.includes('active campaigns')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  }
} 