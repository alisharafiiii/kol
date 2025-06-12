import { NextRequest, NextResponse } from 'next/server';
import { deleteProject, getProjectById } from '@/lib/project';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { findUserByUsername } from '@/lib/user-identity';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id
    
    // Get project by ID
    const project = await getProjectById(projectId)
    
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(project)
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Placeholder for project API
  return NextResponse.json(
    { error: 'Project API not implemented' },
    { status: 501 }
  )
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Placeholder for project API
  return NextResponse.json(
    { error: 'Project API not implemented' },
    { status: 501 }
  )
} 