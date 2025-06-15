'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Custom hook for managing CSRF tokens
 * Automatically includes CSRF token in fetch requests
 */
export function useCSRF() {
  const [csrfToken, setCSRFToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch CSRF token on mount
  useEffect(() => {
    const fetchCSRFToken = async () => {
      try {
        const response = await fetch('/api/csrf-token')
        if (response.ok) {
          const data = await response.json()
          setCSRFToken(data.token)
          
          // Store in session storage for other components
          if (data.token) {
            sessionStorage.setItem('csrf-token', data.token)
          }
        }
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error)
      } finally {
        setLoading(false)
      }
    }

    // Check session storage first
    const storedToken = sessionStorage.getItem('csrf-token')
    if (storedToken) {
      setCSRFToken(storedToken)
      setLoading(false)
    } else {
      fetchCSRFToken()
    }
  }, [])

  // Enhanced fetch function that includes CSRF token
  const secureFetch = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    // Get latest token from state or session storage
    const token = csrfToken || sessionStorage.getItem('csrf-token')
    
    // Add CSRF token to headers for state-changing requests
    const method = (options.method || 'GET').toUpperCase()
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && token) {
      options.headers = {
        ...options.headers,
        'X-CSRF-Token': token
      }
    }

    const response = await fetch(url, options)

    // Update token from response header if provided
    const newToken = response.headers.get('X-CSRF-Token')
    if (newToken && newToken !== token) {
      setCSRFToken(newToken)
      sessionStorage.setItem('csrf-token', newToken)
    }

    return response
  }, [csrfToken])

  return {
    csrfToken,
    loading,
    secureFetch
  }
}

/**
 * Wrapper around fetch that automatically includes CSRF token
 * Can be used as a drop-in replacement for fetch
 */
export async function csrfFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get token from session storage
  const token = sessionStorage.getItem('csrf-token')
  
  // Add CSRF token to headers for state-changing requests
  const method = (options.method || 'GET').toUpperCase()
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && token) {
    options.headers = {
      ...options.headers,
      'X-CSRF-Token': token
    }
  }

  const response = await fetch(url, options)

  // Update token from response header if provided
  const newToken = response.headers.get('X-CSRF-Token')
  if (newToken && newToken !== token) {
    sessionStorage.setItem('csrf-token', newToken)
  }

  return response
} 