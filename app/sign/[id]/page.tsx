'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SignContractPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to the main contracts page
    router.push('/contracts')
  }, [router])
  
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-xl">Redirecting to contracts...</div>
    </div>
  )
} 