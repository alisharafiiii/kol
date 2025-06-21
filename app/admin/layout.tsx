import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { checkUserRoleFromSession } from '@/lib/user-identity'
import { isMasterAdmin } from '@/lib/admin-config'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // Get the Twitter session
  const session: any = await getServerSession(authOptions as any)
  
  // No session - not logged in
  if (!session || !session.twitterHandle) {
    console.log('Admin Layout: No authenticated Twitter session')
    
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-red-400 font-mono p-4">
        <div className="text-2xl tracking-widest mb-4">Admin Access Denied</div>
        <div className="text-sm max-w-md text-center mb-6">
          You must log in with Twitter and have admin privileges to access this page.
        </div>
        <a href="/" className="px-4 py-2 border border-red-400 hover:bg-red-900/30">
          Return to Home & Login
        </a>
      </div>
    )
  }
  
  try {
    // First check if user is a master admin
    if (isMasterAdmin(session.twitterHandle)) {
      console.log(`Admin Layout: Master admin access granted to @${session.twitterHandle}`)
      return (
        <div className="min-h-screen bg-black">
          {children}
        </div>
      )
    }
    
    // Check if the Twitter user has admin role
    const roleCheck = await checkUserRoleFromSession(session, ['admin'])
    
    if (roleCheck.hasAccess) {
      console.log(`Admin Layout: Access granted to @${session.twitterHandle} with role: ${roleCheck.role}`)
      return (
        <div className="min-h-screen bg-black">
          {children}
        </div>
      )
    }
    
    // User doesn't have admin access
    console.log(`Admin Layout: Access denied to @${session.twitterHandle} with role: ${roleCheck.role || 'none'}`)
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-red-400 font-mono p-4">
        <div className="text-2xl tracking-widest mb-4">Admin Access Denied</div>
        <div className="text-sm max-w-md text-center mb-6">
          Your Twitter account does not have admin privileges.
          <div className="mt-2">
            Twitter: @{session.twitterHandle}
          </div>
          <div className="mt-2">
            Role: {roleCheck.role || 'none'}
          </div>
        </div>
        <a href="/" className="px-4 py-2 border border-red-400 hover:bg-red-900/30">
          Return to Home
        </a>
      </div>
    )
  } catch (error) {
    console.error('Admin Layout: Error checking user role:', error)
    
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-red-400 font-mono p-4">
        <div className="text-2xl tracking-widest mb-4">Admin Access Error</div>
        <div className="text-sm max-w-md text-center mb-6">
          An error occurred while checking your permissions.
          <br />
          <span className="text-yellow-400">Error: {String((error as any).message || 'Unknown error')}</span>
        </div>
        <a href="/" className="px-4 py-2 border border-red-400 hover:bg-red-900/30">
          Return to Home
        </a>
      </div>
    )
  }
} 