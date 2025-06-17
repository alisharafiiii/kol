'use client'

import { useEffect, useRef, useState } from 'react'
import LoginModal from '@/components/LoginModal'

interface ContractsLoginModalProps {
  show: boolean
}

export function ContractsLoginModal({ show }: ContractsLoginModalProps) {
  const [isReady, setIsReady] = useState(false)
  const attemptCount = useRef(0)

  useEffect(() => {
    // Check if LoginModal is ready
    const checkReady = () => {
      if (typeof window !== 'undefined' && (window as any).openLogin) {
        console.log('LoginModal is ready')
        setIsReady(true)
        return true
      }
      return false
    }

    // Initial check
    if (checkReady()) return

    // If not ready, keep checking
    const interval = setInterval(() => {
      attemptCount.current++
      console.log(`Checking if LoginModal is ready (attempt ${attemptCount.current})`)
      if (checkReady() || attemptCount.current > 20) {
        clearInterval(interval)
        if (attemptCount.current > 20) {
          console.error('LoginModal failed to initialize after 20 attempts')
        }
      }
    }, 100)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (show && isReady) {
      console.log('Triggering LoginModal to show')
      ;(window as any).openLogin()
    }
  }, [show, isReady])

  return <LoginModal />
} 