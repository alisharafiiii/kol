'use client'

import { useState } from 'react'
import { MiniKitWalletButton } from './MiniKitWalletButton'
import { useAccount, useSignMessage } from 'wagmi'

interface ContractSignerProps {
  contractData: any
  onSign: (signature: string, walletAddress: string) => void
  onCancel: () => void
  signingType: 'create' | 'sign'
}

export function ContractSigner({ contractData, onSign, onCancel, signingType }: ContractSignerProps) {
  const [walletAddress, setWalletAddress] = useState('')
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState('')
  
  // Wagmi hooks for wallet interaction
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const handleWalletConnect = async (address: string) => {
    setWalletAddress(address)
    setError('')
  }

  const handleWalletDisconnect = () => {
    setWalletAddress('')
    setError('')
  }

  const handleSign = async () => {
    if (!walletAddress && !address) {
      setError('Please connect your wallet first')
      return
    }

    setSigning(true)
    setError('')

    try {
      // Create the message to sign
      const message = JSON.stringify({
        contract: contractData.title,
        assignedTo: contractData.assignedTo,
        createdAt: new Date().toISOString(),
        type: signingType,
        nonce: Date.now()
      })

      let signature = ''
      const signerAddress = walletAddress || address

      // Check if we're using wagmi (Ethereum wallets)
      if (isConnected && signMessageAsync) {
        try {
          // Sign with Ethereum wallet (Coinbase, MetaMask, etc.)
          signature = await signMessageAsync({ message })
        } catch (err) {
          console.error('Ethereum signing error:', err)
          throw new Error('Failed to sign with wallet')
        }
      } 
      // Check for Phantom wallet (Solana)
      else if (window.solana && window.solana.isPhantom) {
        try {
          const encodedMessage = new TextEncoder().encode(message)
          // Type assertion for Solana wallet
          const solanaWallet = window.solana as any
          const signedMessage = await solanaWallet.signMessage(encodedMessage, 'utf8')
          signature = Buffer.from(signedMessage.signature).toString('hex')
        } catch (err) {
          console.error('Solana signing error:', err)
          throw new Error('Failed to sign with Phantom wallet')
        }
      }
      // Fallback to mock signature if no wallet provider is available
      else {
        console.warn('No wallet provider found, using mock signature')
        signature = `0x${Buffer.from(message).toString('hex')}_${signerAddress}_signed`
      }

      // Call the onSign callback with the signature
      onSign(signature, signerAddress as string)
    } catch (error: any) {
      console.error('Error signing:', error)
      setError(error.message || 'Failed to sign contract')
      setSigning(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">
          {signingType === 'create' ? 'Sign to Create Contract' : 'Sign Contract'}
        </h2>

        <div className="mb-6 space-y-4">
          <div className="bg-black p-4 rounded text-sm">
            <p className="text-gray-400 mb-2">Contract Summary:</p>
            <p className="font-medium">{contractData.title}</p>
            <p className="text-sm text-gray-400 mt-1">
              Assigned to: @{contractData.assignedTo}
            </p>
          </div>

          {!walletAddress && !address ? (
            <div>
              <p className="text-sm text-gray-400 mb-4">
                Connect your wallet to sign this contract
              </p>
              <MiniKitWalletButton
                onConnect={handleWalletConnect}
                onDisconnect={handleWalletDisconnect}
              />
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-400 mb-2">Connected Wallet:</p>
              <p className="font-mono text-xs bg-black p-2 rounded break-all">
                {walletAddress || address}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-500 p-3 rounded">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSign}
            disabled={(!walletAddress && !address) || signing}
            className="flex-1 px-4 py-2 bg-green-900 hover:bg-green-800 disabled:opacity-50 rounded font-medium"
          >
            {signing ? 'Signing...' : 'Sign Contract'}
          </button>
        </div>
      </div>
    </div>
  )
} 