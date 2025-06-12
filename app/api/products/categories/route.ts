import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { CategoryService } from '@/lib/services/category-service'

export async function GET() {
  try {
    const categories = await CategoryService.getAllCategories()
    return NextResponse.json(categories)
  } catch (error: any) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const category = await CategoryService.addCategory(data.name, data.color, 'admin')
    return NextResponse.json(category)
  } catch (error: any) {
    console.error('Error creating category:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create category' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }
    
    const success = await CategoryService.removeCategory(id)
    if (!success) {
      return NextResponse.json(
        { error: 'Category not found or cannot be deleted' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete category' },
      { status: 500 }
    )
  }
} 