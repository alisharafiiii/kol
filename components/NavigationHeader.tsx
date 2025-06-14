'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import Image from 'next/image'

export default function NavigationHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isApproved, setIsApproved] = useState(false)
  
  // Check user status
  useEffect(() => {
    const checkUserStatus = async () => {
      if (!session?.user?.name) return
      
      try {
        const handle = (session as any)?.twitterHandle || session.user.name
        const normalizedHandle = handle.replace('@', '')
        const res = await fetch(`/api/user/profile?handle=${encodeURIComponent(normalizedHandle)}`)
        
        if (res.ok) {
          const data = await res.json()
          if (data.user) {
            setIsApproved(data.user.approvalStatus === 'approved')
            setIsAdmin(data.user.role === 'admin')
          }
        }
      } catch (error) {
        console.error('Error checking user status:', error)
      }
    }
    
    checkUserStatus()
  }, [session])
  
  // Don't show on landing page
  if (pathname === '/' || pathname === '/login') return null
  
  const navItems = [
    { path: '/scout', label: 'Scout', requiresApproval: true },
    { path: '/campaigns', label: 'Campaigns', requiresApproval: true },
    { path: '/admin', label: 'Admin', requiresAdmin: true },
  ]
  
  const isActive = (path: string) => pathname?.startsWith(path) || false
  
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-black border-b border-green-300/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12 sm:h-14">
          {/* Logo */}
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => router.push('/')}
          >
            <div className="relative w-8 h-8 sm:w-10 sm:h-10">
              <Image
                src="/logo.png"
                alt="Nabulines"
                fill
                className="object-contain rounded"
                priority
              />
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex items-center gap-2 sm:gap-4">
            {navItems.map(item => {
              // Check if user has permission to see this item
              if (item.requiresAdmin && !isAdmin) return null
              if (item.requiresApproval && !isApproved && !isAdmin) return null
              
              return (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-mono transition-colors relative ${
                    isActive(item.path)
                      ? 'text-green-300'
                      : 'text-green-300/70 hover:text-green-300'
                  }`}
                >
                  {item.label}
                  {isActive(item.path) && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-300" />
                  )}
                </button>
              )
            })}
            
            {/* Home link */}
            <button
              onClick={() => router.push('/')}
              className="px-3 py-1.5 text-xs sm:text-sm font-mono text-green-300/70 hover:text-green-300 transition-colors"
            >
              Home
            </button>
          </nav>
        </div>
      </div>
    </header>
  )
} 