'use client'

import { ReactNode } from 'react'

interface ContractsFeatureGuardProps {
  children: ReactNode
  fallback?: ReactNode
}

export function ContractsFeatureGuard({ 
  children, 
  fallback = null 
}: ContractsFeatureGuardProps) {
  // Check if contracts feature is enabled
  if (process.env.NEXT_PUBLIC_ENABLE_CONTRACTS !== 'true') {
    return <>{fallback}</>
  }

  return <>{children}</>
} 