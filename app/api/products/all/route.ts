import { NextResponse } from 'next/server'
import { ProductService } from '@/lib/services/product-service'

export async function GET() {
  try {
    const products = await ProductService.getAllProducts()
    return NextResponse.json(products)
  } catch (error: any) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch products' },
      { status: 500 }
    )
  }
} 