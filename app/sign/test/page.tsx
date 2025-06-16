'use client'

import { MiniKitWalletButton } from '@/modules/onchain-contracts/components/MiniKitWalletButton'
import { useState, useEffect } from 'react'
import { useConnect } from 'wagmi'

export default function TestWalletPage() {
  const [walletAddress, setWalletAddress] = useState('')
  const { connectors } = useConnect()

  // Debug: Log available connectors
  useEffect(() => {
    console.log('Available connectors:', connectors.map(c => ({
      id: c.id,
      name: c.name,
      ready: c.ready
    })))
  }, [connectors])

  return (
    <div className="min-h-screen bg-black text-green-300 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Test Wallet Connection</h1>
        
        <div className="bg-gray-900 border border-green-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">MiniKit Wallet Test</h2>
          <p className="text-sm text-gray-400 mb-4">
            This page tests wallet connection with Base MiniKit.
          </p>
          <p className="text-xs text-gray-500">
            Make sure you're using Coinbase Wallet app or have MetaMask installed.
          </p>
        </div>

        <div className="space-y-4">
          <MiniKitWalletButton 
            onConnect={(address) => {
              setWalletAddress(address)
              console.log('Wallet connected:', address)
            }}
            onDisconnect={() => {
              setWalletAddress('')
              console.log('Wallet disconnected')
            }}
          />
          
          {walletAddress && (
            <div className="bg-green-900/20 border border-green-500 p-4 rounded">
              <p className="text-green-400">✓ Wallet connected successfully!</p>
              <p className="text-sm text-gray-300 mt-2">Address: {walletAddress}</p>
            </div>
          )}
        </div>

        <div className="mt-8 p-4 bg-gray-900 border border-gray-700 rounded">
          <p className="text-xs text-gray-500 mb-2">Debug Info:</p>
          <p className="text-xs font-mono">
            Connectors: {connectors.length} available
          </p>
        </div>
      </div>
    </div>
  )
} 