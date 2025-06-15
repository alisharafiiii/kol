import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { hasAdminAccess, isMasterAdmin, getMasterAdmins } from '@/lib/admin-config'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({
        authenticated: false,
        message: 'No session found. Please log in.'
      })
    }
    
    const userRole = (session as any)?.role || (session.user as any)?.role || 'none'
    const twitterHandle = (session as any)?.twitterHandle || session?.user?.name || 'unknown'
    const normalizedHandle = twitterHandle.toLowerCase().replace('@', '')
    
    const hasAdmin = hasAdminAccess(twitterHandle, userRole)
    const isMaster = isMasterAdmin(twitterHandle)
    
    return NextResponse.json({
      authenticated: true,
      session: {
        twitterHandle,
        normalizedHandle,
        role: userRole,
        user: {
          name: session.user?.name,
          email: session.user?.email,
          image: session.user?.image
        }
      },
      adminStatus: {
        hasAdminAccess: hasAdmin,
        isMasterAdmin: isMaster,
        reason: isMaster ? 'Master admin handle' : 
                userRole === 'admin' ? 'Admin role in database' : 
                'No admin access'
      },
      masterAdmins: getMasterAdmins(),
      debug: {
        fullSession: session,
        checkDetails: {
          handleCheck: `'${normalizedHandle}' in [${getMasterAdmins().join(', ')}] = ${isMaster}`,
          roleCheck: `'${userRole}' === 'admin' = ${userRole === 'admin'}`
        }
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 