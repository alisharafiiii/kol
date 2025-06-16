'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { base } from 'wagmi/chains'

interface MiniKitWalletButtonProps {
  onConnect?: (address: string) => void
  onDisconnect?: () => void
}

export function MiniKitWalletButton({ onConnect, onDisconnect }: MiniKitWalletButtonProps) {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const [showError, setShowError] = useState(false)
  const [phantomAddress, setPhantomAddress] = useState<string>('')
  const [showWalletOptions, setShowWalletOptions] = useState(false)

  // Check for Phantom wallet
  const isPhantomInstalled = typeof window !== 'undefined' && window.phantom?.solana?.isPhantom

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

      if (!window.phantom?.solana) {
        window.open('https://phantom.app/', '_blank')
        return
      }

      const resp = await window.phantom.solana.connect()
      const address = resp.publicKey.toString()
      setPhantomAddress(address)
      console.log('Connected to Phantom:', address)
    } catch (err) {
      console.error('Phantom connection error:', err)
      setShowError(true)
    }
  }

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
      <div className="space-y-4">
        <div className="bg-gray-900 border border-gray-700 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Connected Wallet</p>
              <p className="font-mono text-green-400">{maskAddress(displayAddress)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {walletType}
                {chain && !phantomAddress && ` - ${chain.name}`}
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1 text-sm bg-red-900 border border-red-500 hover:bg-red-800 rounded transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
        
        {isWrongNetwork && !phantomAddress && (
          <div className="bg-yellow-900/20 border border-yellow-500 p-3 rounded">
            <p className="text-yellow-400 text-sm">
              Please switch to Base network in your wallet
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!showWalletOptions ? (
        <button
          onClick={handleConnect}
          disabled={isPending}
          className="w-full px-4 py-3 bg-blue-900 border border-blue-500 hover:bg-blue-800 rounded font-medium transition-colors disabled:opacity-50"
        >
          {isPending ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="space-y-3">
          <button
            onClick={connectEVM}
            disabled={isPending}
            className="w-full px-4 py-3 bg-blue-900 border border-blue-500 hover:bg-blue-800 rounded font-medium transition-colors disabled:opacity-50"
          >
            <div>
              <div>Coinbase / MetaMask</div>
              <div className="text-xs text-gray-400">Base Network (EVM)</div>
            </div>
          </button>

          <button
            onClick={connectPhantom}
            className="w-full px-4 py-3 bg-purple-900 border border-purple-500 hover:bg-purple-800 rounded font-medium transition-colors"
          >
            <div>
              <div>Phantom Wallet</div>
              <div className="text-xs text-gray-400">
                {isPhantomInstalled ? 'Solana Network' : 'Install Phantom →'}
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowWalletOptions(false)}
            className="w-full px-3 py-2 text-sm text-gray-400 hover:text-gray-300"
          >
            Cancel
          </button>
        </div>
      )}

      {(showError || connectError) && (
        <div className="bg-red-900/20 border border-red-500 p-3 rounded">
          <p className="text-red-400 text-sm">
            {connectError?.message || 'Failed to connect wallet. Make sure you have a wallet installed.'}
          </p>
        </div>
      )}

      <div className="text-xs text-gray-500 text-center">
        <p>Supported: Coinbase Wallet, MetaMask (Base), Phantom (Solana)</p>
      </div>
    </div>
  )
} 