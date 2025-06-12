'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiConfig, createConfig, http } from 'wagmi'
import { base } from 'viem/chains'
import { coinbaseWallet, walletConnect } from 'wagmi/connectors'
import { MiniKitProvider } from '@coinbase/onchainkit/minikit'
import { useMemo } from 'react'

const queryClient = new QueryClient()

export default function AppProviders({
  children,
}: {
  children: React.ReactNode
}) {
  // Create wagmi config inside component to ensure client-side only
  const wagmiConfig = useMemo(() => {
    const connectors = [
      coinbaseWallet({ appName: 'kol' }),
    ];
    
    // Only add WalletConnect on client side to avoid indexedDB errors
    if (typeof window !== 'undefined') {
      connectors.push(
        walletConnect({ 
          projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '2c921904d8ebc91517cd11c1cc4a267f',
          showQrModal: true 
        }) as any
      );
    }
    
    return createConfig({
      chains: [base],
      connectors,
      transports: { [base.id]: http() },
      ssr: true,
    });
  }, []);

  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <MiniKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={base}
          config={{
            appearance: {
              mode: "auto",
              theme: "mini-app-theme",
              name: "kol",
              logo: process.env.NEXT_PUBLIC_ICON_URL,
            },
          }}
        >
          {children}
        </MiniKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
} 