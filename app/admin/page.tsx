'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import AdminPanel from '@/components/AdminPanel'
import Link from 'next/link'
import { hasAdminAccess, logAdminAccess } from '@/lib/admin-config'

export default function AdminPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    // Check if user is authorized to access the admin panel
    const checkAuthorization = async () => {
      console.log('=== ADMIN PAGE: Starting authorization check ===');
      console.log('Session status:', status);
      console.log('Session data:', JSON.stringify(session, null, 2));
      
      try {
        // Wait for session to load
        if (status === 'loading') {
          console.log('ADMIN PAGE: Session still loading, waiting...');
          return
        }
        
        // Check if user is logged in
        if (status === 'unauthenticated' || !session) {
          console.log('ADMIN PAGE: No session found - user not logged in')
          setError('Please log in with Twitter to access the admin panel')
          setIsAuthorized(false)
          setLoading(false)
          return
        }
        
        // Get Twitter handle from session - check multiple possible locations
        const twitterHandle = (session as any)?.twitterHandle || 
                            (session as any)?.user?.twitterHandle ||
                            session?.user?.name ||
                            (session as any)?.user?.username;
                            
        console.log('ADMIN PAGE: Extracted Twitter handle:', twitterHandle);
        console.log('ADMIN PAGE: All possible handles:', {
          sessionTwitterHandle: (session as any)?.twitterHandle,
          userTwitterHandle: (session as any)?.user?.twitterHandle,
          userName: session?.user?.name,
          userUsername: (session as any)?.user?.username
        });
        
        if (!twitterHandle) {
          console.log('ADMIN PAGE: No Twitter handle in session')
          setError('Twitter handle not found in session')
          setIsAuthorized(false)
          setLoading(false)
          return
        }
        
        // Check for master admin access (emergency bypass)
        const normalizedHandle = twitterHandle.toLowerCase().replace('@', '');
        console.log('ADMIN PAGE: Normalized handle:', normalizedHandle);
        
        // Quick check for master admin before API calls
        if (hasAdminAccess(normalizedHandle, null)) {
          console.log('ADMIN PAGE: Master admin detected - granting immediate access');
          logAdminAccess(normalizedHandle, 'admin_panel_access', { 
            method: 'master_admin',
            page: 'admin'
          });
          setIsAuthorized(true);
          setUserRole('admin');
          setLoading(false);
          return;
        }
        
        console.log('ADMIN PAGE: Not sharafi_eth, checking role via API for:', twitterHandle)
        
        // Check user role via API (only for non-sharafi_eth users)
        try {
          const response = await fetch('/api/user/role')
          console.log('ADMIN PAGE: Role API response status:', response.status);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('ADMIN PAGE: Role API error response:', errorText);
            throw new Error(`Role check failed with status: ${response.status}`)
          }
          
          const data = await response.json()
          console.log('ADMIN PAGE: Role check result:', JSON.stringify(data, null, 2))
          
          setUserRole(data.role)
          
          // Check session role first
          const sessionRole = (session as any)?.user?.role || (session as any)?.role;
          console.log('ADMIN PAGE: Session role:', sessionRole);
          console.log('ADMIN PAGE: API role:', data.role);
          
          // Check admin access using centralized function
          if (hasAdminAccess(normalizedHandle, data.role || sessionRole)) {
            console.log('ADMIN PAGE: User has admin access - granting access');
            logAdminAccess(normalizedHandle, 'admin_panel_access', { 
              method: 'role_check',
              role: data.role || sessionRole,
              page: 'admin'
            });
            setIsAuthorized(true)
          } else {
            console.log('ADMIN PAGE: User does NOT have admin access - denying access');
            setError(`You don't have admin permissions. Your role: ${data.role || 'none'}`)
            setIsAuthorized(false)
          }
        } catch (apiError) {
          console.error('ADMIN PAGE: API call failed:', apiError);
          // If API fails, check if user is a master admin
          if (hasAdminAccess(normalizedHandle, null)) {
            console.log('ADMIN PAGE: API failed but master admin detected - granting access anyway');
            logAdminAccess(normalizedHandle, 'admin_panel_access', { 
              method: 'api_fallback',
              error: 'api_failed',
              page: 'admin'
            });
            setIsAuthorized(true);
            setUserRole('admin');
          } else {
            setError('Unable to verify permissions - API error');
            setIsAuthorized(false);
          }
        }
      } catch (err: any) {
        console.error('ADMIN PAGE: Authorization check failed:', err)
        
        // Last resort - check if any handle in session is a master admin
        const sessionStr = JSON.stringify(session);
        const twitterHandle = (session as any)?.twitterHandle || 
                            (session as any)?.user?.twitterHandle ||
                            session?.user?.name ||
                            (session as any)?.user?.username;
        
        if (twitterHandle && hasAdminAccess(twitterHandle, null)) {
          console.log('ADMIN PAGE: Error occurred but master admin found in session - granting access');
          logAdminAccess(twitterHandle, 'admin_panel_access', { 
            method: 'error_fallback',
            error: err.message,
            page: 'admin'
          });
          setIsAuthorized(true);
          setUserRole('admin');
        } else {
          setError(`Error checking authorization: ${String((err as any).message || 'Unknown error')}`)
          setIsAuthorized(false)
        }
      } finally {
        console.log('ADMIN PAGE: Authorization check complete. Authorized:', isAuthorized);
        setLoading(false)
      }
    }
    
    checkAuthorization()
  }, [session, status, router])

  // Handle closing/exiting the admin panel
  const handleClose = () => {
    router.push('/')
  }

  if (loading || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black font-mono text-green-300">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!isAuthorized) {
    const twitterHandle = (session as any)?.twitterHandle || 
                         (session as any)?.user?.twitterHandle ||
                         session?.user?.name ||
                         (session as any)?.user?.username;
                         
    console.log('ADMIN PAGE: Rendering access denied. Handle:', twitterHandle, 'Role:', userRole);
    
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black font-mono text-red-400 p-6">
        <div className="border border-red-500 p-6 max-w-md text-center">
          <h1 className="text-xl uppercase mb-4" style={{ fontFamily: 'Press Start 2P, monospace' }}>Admin Access Denied</h1>
          <p className="mb-4 text-sm" style={{ fontFamily: 'Roboto Mono, monospace' }}>{error || "Your Twitter account does not have admin privileges."}</p>
          {session && (
            <div className="mb-4 text-xs" style={{ fontFamily: 'Roboto Mono, monospace' }}>
              <p>Twitter: @{twitterHandle}</p>
              <p>Role: {userRole || 'none'}</p>
              <p>Session Data: {JSON.stringify(session, null, 2).substring(0, 200)}...</p>
            </div>
          )}
          <Link href="/">
            <button className="px-4 py-2 border border-red-400 hover:bg-red-900/30">
              Return to Home
            </button>
          </Link>
        </div>
      </div>
    )
  }

  // If authorized, render the admin panel
  console.log('ADMIN PAGE: Rendering admin panel for authorized user');
  return <AdminPanel onClose={handleClose} />
} 