'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

interface WalletConnectButtonProps {
  onConnect?: (address: string) => void
  onDisconnect?: () => void
}

export function WalletConnectButton({ onConnect, onDisconnect }: WalletConnectButtonProps) {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState('')
  const [showWalletOptions, setShowWalletOptions] = useState(false)

  // Notify parent when connection state changes
  useEffect(() => {
    if (isConnected && address) {
      onConnect?.(address)
    } else {
      onDisconnect?.()
    }
  }, [isConnected, address, onConnect, onDisconnect])

  const handleConnect = async (connectorId: string) => {
    try {
      setIsConnecting(true)
      setError('')
      
      const connector = connectors.find(c => c.id === connectorId)
      if (!connector) {
        setError('Wallet connector not found')
        return
      }

      await connect({ connector })
      setShowWalletOptions(false)
    } catch (err) {
      console.error('Wallet connection error:', err)
      setError('Failed to connect wallet. Please try again.')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = () => {
    disconnect()
    setError('')
  }

  // Helper to mask wallet address
  const maskAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  if (isConnected && address) {
    return (
      <div className="space-y-4">
        <div className="bg-gray-900 border border-gray-700 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Connected Wallet</p>
              <p className="font-mono text-green-400">{maskAddress(address)}</p>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1 text-sm bg-red-900 border border-red-500 hover:bg-red-800 rounded transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!showWalletOptions ? (
        <button
          onClick={() => setShowWalletOptions(true)}
          disabled={isConnecting}
          className="w-full px-4 py-3 bg-blue-900 border border-blue-500 hover:bg-blue-800 rounded font-medium transition-colors disabled:opacity-50"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
          <p className="text-sm text-gray-400 mb-3">Select a wallet to connect:</p>
          
          {/* Coinbase Wallet */}
          <button
            onClick={() => handleConnect('coinbaseWallet')}
            disabled={isConnecting}
            className="w-full px-4 py-3 bg-black border border-green-500 hover:bg-green-900/20 rounded flex items-center justify-between transition-colors disabled:opacity-50"
          >
            <span className="font-medium">Coinbase Wallet</span>
            <span className="text-sm text-gray-400">Recommended</span>
          </button>

          {/* Phantom Wallet - using WalletConnect */}
          <button
            onClick={() => handleConnect('walletConnect')}
            disabled={isConnecting}
            className="w-full px-4 py-3 bg-black border border-purple-500 hover:bg-purple-900/20 rounded flex items-center justify-between transition-colors disabled:opacity-50"
          >
            <span className="font-medium">Phantom & Others</span>
            <span className="text-sm text-gray-400">via WalletConnect</span>
          </button>

          <button
            onClick={() => setShowWalletOptions(false)}
            className="w-full px-4 py-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-500 p-3 rounded">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
} 