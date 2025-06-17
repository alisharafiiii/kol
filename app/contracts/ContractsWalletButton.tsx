'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { base } from 'wagmi/chains'

interface ContractsWalletButtonProps {
  onConnect?: (address: string) => void
  onDisconnect?: () => void
}

// Import the existing PhantomProvider type from LoginModal
interface PhantomProvider {
  solana?: {
    isPhantom?: boolean;
    isConnected?: boolean;
    connect: () => Promise<{ publicKey: { toString: () => string } }>;
    disconnect: () => Promise<void>;
    publicKey?: { toString: () => string };
  }
}

declare global {
  interface Window {
    phantom?: PhantomProvider;
  }
}

export function ContractsWalletButton({ onConnect, onDisconnect }: ContractsWalletButtonProps) {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const [showError, setShowError] = useState(false)
  const [phantomAddress, setPhantomAddress] = useState<string>('')
  const [showWalletOptions, setShowWalletOptions] = useState(false)
  const [isConnectingPhantom, setIsConnectingPhantom] = useState(false)

  // Check for Phantom wallet and mobile environment
  const [isPhantomInstalled, setIsPhantomInstalled] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  
  useEffect(() => {
    // Check for Phantom after component mounts
    setIsPhantomInstalled(typeof window !== 'undefined' && !!window.phantom?.solana?.isPhantom)
    
    // Check if we're on mobile
    const userAgent = window.navigator?.userAgent || ''
    const mobile = /iPhone|iPad|iPod|Android/i.test(userAgent)
    const ios = /iPhone|iPad|iPod/i.test(userAgent)
    setIsMobile(mobile)
    setIsIOS(ios)
  }, [])

  // Notify parent when connection state changes
  useEffect(() => {
    if (isConnected && address) {
      onConnect?.(address)
      setShowError(false)
    } else if (phantomAddress) {
      onConnect?.(phantomAddress)
    } else {
      onDisconnect?.()
    }
  }, [isConnected, address, phantomAddress, onConnect, onDisconnect])

  const handleConnect = async () => {
    setShowWalletOptions(true)
  }

  const connectEVM = async () => {
    try {
      setShowError(false)
      setShowWalletOptions(false)
      
      // For MiniKit, we should use the injected connector (MetaMask/Coinbase Wallet in-app browser)
      const injectedConnector = connectors.find(c => c.id === 'injected')
      const coinbaseConnector = connectors.find(c => c.id === 'coinbaseWalletSDK' || c.id === 'coinbaseWallet')
      
      // Try Coinbase Wallet first, then injected
      const connector = coinbaseConnector || injectedConnector || connectors[0]
      
      if (!connector) {
        console.error('No wallet connector available')
        setShowError(true)
        return
      }

      console.log('Connecting with connector:', connector.id, connector.name)
      
      await connect({ 
        connector,
        chainId: base.id // Ensure we're connecting to Base
      })
    } catch (err) {
      console.error('Wallet connection error:', err)
      setShowError(true)
    }
  }

  const connectPhantom = async () => {
    try {
      setShowError(false)
      setShowWalletOptions(false)
      setIsConnectingPhantom(true)

      // Check if we're on mobile
      if (isMobile) {
        // For iOS, we need to handle the deep link differently
        const isIOS = /iPhone|iPad|iPod/i.test(window.navigator?.userAgent || '')
        
        if (isIOS) {
          // First, check if Phantom is already connected (from a previous session)
          if (window.phantom?.solana?.isConnected) {
            try {
              const publicKey = window.phantom.solana.publicKey
              if (publicKey) {
                const address = publicKey.toString()
                setPhantomAddress(address)
                console.log('Phantom already connected:', address)
                setIsConnectingPhantom(false)
                return
              }
            } catch (err) {
              console.error('Error checking existing Phantom connection:', err)
            }
          }
          
          // Show a message to the user
          alert('You will be redirected to Phantom wallet. After connecting, please return to this page.')
          
          // Use a simpler deep link for iOS
          const deepLink = `https://phantom.app/ul/connect`
          
          // Store current URL in sessionStorage for redirect
          sessionStorage.setItem('phantom_redirect', window.location.href)
          sessionStorage.setItem('phantom_connecting', 'true')
          
          // Open Phantom app
          window.location.href = deepLink
          
          return
        } else {
          // Android flow
          const currentUrl = encodeURIComponent(window.location.href)
          const deepLink = `phantom://connect?app_url=${currentUrl}&redirect_url=${currentUrl}`
          
          window.location.href = deepLink
          
          setTimeout(() => {
            alert('Please install Phantom wallet app')
            setIsConnectingPhantom(false)
          }, 2000)
          
          return
        }
      }

      // Desktop flow - check if Phantom extension is installed
      if (!window.phantom?.solana?.isPhantom) {
        alert('Please install Phantom wallet extension first')
        setIsConnectingPhantom(false)
        return
      }

      const resp = await window.phantom.solana.connect()
      const address = resp.publicKey.toString()
      setPhantomAddress(address)
      console.log('Connected to Phantom:', address)
      setIsConnectingPhantom(false)
    } catch (err) {
      console.error('Phantom connection error:', err)
      setShowError(true)
      setIsConnectingPhantom(false)
    }
  }

  // Check for Phantom connection on page load (for mobile deep link return)
  useEffect(() => {
    const checkPhantomConnection = async () => {
      // First check if we're returning from a Phantom redirect
      const isReturningFromPhantom = sessionStorage.getItem('phantom_redirect')
      const wasConnecting = sessionStorage.getItem('phantom_connecting')
      
      if (wasConnecting) {
        setIsConnectingPhantom(true)
        sessionStorage.removeItem('phantom_connecting')
      }
      
      if (isReturningFromPhantom) {
        sessionStorage.removeItem('phantom_redirect')
        
        // Give Phantom a moment to inject itself
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      // Check if Phantom is available
      if (window.phantom?.solana) {
        try {
          // For iOS, we might need to manually connect even if isConnected is true
          if (window.phantom.solana.isConnected) {
            const publicKey = window.phantom.solana.publicKey
            if (publicKey) {
              const address = publicKey.toString()
              setPhantomAddress(address)
              console.log('Phantom already connected:', address)
              setIsConnectingPhantom(false)
              return
            }
          }
          
          // If we're returning from redirect but not connected, try to connect
          if (isReturningFromPhantom && !window.phantom.solana.isConnected) {
            try {
              const resp = await window.phantom.solana.connect()
              const address = resp.publicKey.toString()
              setPhantomAddress(address)
              console.log('Phantom connected after redirect:', address)
              setIsConnectingPhantom(false)
            } catch (err) {
              console.error('Failed to connect after redirect:', err)
              setIsConnectingPhantom(false)
            }
          } else if (wasConnecting) {
            // If we were connecting but Phantom isn't available yet, keep checking
            console.log('Still waiting for Phantom...')
          }
        } catch (err) {
          console.error('Error checking Phantom connection:', err)
          setIsConnectingPhantom(false)
        }
      } else if (wasConnecting || isReturningFromPhantom) {
        // Phantom not available yet, but we're expecting it
        console.log('Waiting for Phantom to be injected...')
      }
    }

    // Check immediately
    checkPhantomConnection()
    
    // Also check after delays to handle slow injection
    const timeout1 = setTimeout(checkPhantomConnection, 1000)
    const timeout2 = setTimeout(checkPhantomConnection, 2000)
    const timeout3 = setTimeout(() => {
      checkPhantomConnection()
      // Clear connecting state after 3 seconds if nothing happened
      setIsConnectingPhantom(false)
    }, 3000)
    
    return () => {
      clearTimeout(timeout1)
      clearTimeout(timeout2)
      clearTimeout(timeout3)
    }
  }, [])

  const handleDisconnect = async () => {
    if (phantomAddress && window.phantom?.solana) {
      try {
        await window.phantom.solana.disconnect()
        setPhantomAddress('')
      } catch (err) {
        console.error('Phantom disconnect error:', err)
      }
    } else {
      disconnect()
    }
    setShowError(false)
  }

  // Helper to mask wallet address
  const maskAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  // Check if we're on the wrong network
  const isWrongNetwork = isConnected && chain?.id !== base.id

  // If connected (either EVM or Phantom)
  if ((isConnected && address) || phantomAddress) {
    const displayAddress = phantomAddress || address || ''
    const walletType = phantomAddress ? 'Phantom (Solana)' : 'EVM Wallet'
    
    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="bg-gray-900 border border-gray-700 rounded p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-400">Connected Wallet</p>
              <p className="font-mono text-green-400 text-sm sm:text-base truncate">{maskAddress(displayAddress)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {walletType}
                {chain && !phantomAddress && ` - ${chain.name}`}
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-red-900 border border-red-500 hover:bg-red-800 rounded transition-colors whitespace-nowrap"
            >
              Disconnect
            </button>
          </div>
        </div>
        
        {isWrongNetwork && !phantomAddress && (
          <div className="bg-yellow-900/20 border border-yellow-500 p-2 sm:p-3 rounded">
            <p className="text-yellow-400 text-xs sm:text-sm">
              Please switch to Base network in your wallet
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {isConnectingPhantom && !showWalletOptions ? (
        <div className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-purple-900 border border-purple-500 rounded text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span className="text-sm sm:text-base">Connecting to Phantom...</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Please complete the connection in Phantom</p>
        </div>
      ) : !showWalletOptions ? (
        <button
          onClick={handleConnect}
          disabled={isPending}
          className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-blue-900 border border-blue-500 hover:bg-blue-800 rounded font-medium transition-colors disabled:opacity-50 text-sm sm:text-base"
        >
          {isPending ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          <button
            onClick={connectEVM}
            disabled={isPending}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-blue-900 border border-blue-500 hover:bg-blue-800 rounded font-medium transition-colors disabled:opacity-50 text-sm sm:text-base"
          >
            <div>
              <div>Coinbase / MetaMask</div>
              <div className="text-xs text-gray-400">Base Network (EVM)</div>
            </div>
          </button>

          <button
            onClick={connectPhantom}
            disabled={isConnectingPhantom}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-purple-900 border border-purple-500 hover:bg-purple-800 rounded font-medium transition-colors text-sm sm:text-base disabled:opacity-50"
          >
            <div>
              <div>{isConnectingPhantom ? 'Connecting...' : 'Phantom Wallet'}</div>
              <div className="text-xs text-gray-400">
                {isConnectingPhantom ? 'Please complete connection in Phantom' : 
                 isMobile ? (isIOS ? 'Opens Phantom App' : 'Open in Phantom App') : 
                 (isPhantomInstalled ? 'Solana Network' : 'Extension Required')}
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowWalletOptions(false)}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-400 hover:text-gray-300"
          >
            Cancel
          </button>
        </div>
      )}

      {(showError || connectError) && (
        <div className="bg-red-900/20 border border-red-500 p-2 sm:p-3 rounded">
          <p className="text-red-400 text-xs sm:text-sm">
            {connectError?.message || 'Failed to connect wallet. Make sure you have a wallet installed.'}
          </p>
        </div>
      )}

      <div className="text-xs text-gray-500 text-center">
        <p>Supported: Coinbase Wallet, MetaMask (Base), Phantom (Solana)</p>
        {isIOS && showWalletOptions && (
          <p className="mt-1 text-yellow-400">iOS: After connecting in Phantom, return to Safari</p>
        )}
      </div>
    </div>
  )
} 