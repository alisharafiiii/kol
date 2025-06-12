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
    
    // Check if user is admin
    const userRole = (session as any).role || (session as any).user?.role
    if (!['admin', 'core'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const activeOnly = searchParams.get('active') === 'true'
    
    let products
    if (projectId) {
      products = await ProductService.getProductsByProject(projectId)
    } else if (activeOnly) {
      products = await ProductService.getActiveProducts()
    } else {
      products = await ProductService.getAllProducts()
    }
    
    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user is admin
    const userRole = (session as any).role || (session as any).user?.role
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Only admins can create products' }, { status: 403 })
    }
    
    const body = await request.json()
    const { name, price, image, description, projectId, category, stock } = body
    
    if (!name || !price) {
      return NextResponse.json(
        { error: 'Name and price are required' },
        { status: 400 }
      )
    }
    
    const product = await ProductService.createProduct({
      name,
      price: parseFloat(price),
      image,
      description,
      projectId,
      category,
      stock: stock ? parseInt(stock) : undefined,
      active: true,
      createdBy: session.user.name || 'unknown'
    })
    
    return NextResponse.json(product)
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
} 