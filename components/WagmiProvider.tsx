'use client'

import { WagmiProvider as WagmiConfigProvider, createConfig, http } from 'wagmi'
import { mainnet, base, optimism, arbitrum, polygon } from 'wagmi/chains'
import { coinbaseWallet, walletConnect } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useMemo } from 'react'

// Create queryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1_000 * 60 * 60 * 24, // 24 hours
    },
  },
})

export default function WagmiProvider({ children }: { children: ReactNode }) {
  // Create wagmi config inside component to ensure client-side only
  const config = useMemo(() => {
    // Check if we're on iOS
    const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    return createConfig({
      chains: [mainnet, base, optimism, arbitrum, polygon],
      transports: {
        [mainnet.id]: http(),
        [base.id]: http(),
        [optimism.id]: http(),
        [arbitrum.id]: http(),
        [polygon.id]: http(),
      },
      connectors: [
        coinbaseWallet({
          appName: 'Nabulines',
          // Use smart wallet for iOS to avoid deep linking issues
          preference: isIOS ? 'smartWalletOnly' : 'all',
        }),
        ...(typeof window !== 'undefined' ? [
          walletConnect({
            projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '2c921904d8ebc91517cd11c1cc4a267f',
            metadata: {
              name: 'Nabulines',
              description: 'Web3 Collaboration Platform',
              url: window.location.origin,
              icons: ['https://nabulines.com/icon.png']
            },
            showQrModal: true,
            qrModalOptions: {
              mobileLinks: ['phantom','coinbase','metamask','rainbow'],
            },
          } as any),
        ] : []),
      ],
      ssr: true,
    })
  }, [])

  return (
    <WagmiConfigProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiConfigProvider>
  )
} 