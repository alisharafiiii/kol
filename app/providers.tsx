"use client";

import { type ReactNode, useMemo } from "react";
import { base } from "wagmi/chains";
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { createConfig, WagmiConfig, http } from 'wagmi';
import { coinbaseWallet, walletConnect } from 'wagmi/connectors';

export function Providers(props: { children: ReactNode }) {
  // Create Wagmi config inside component to ensure client-side only
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
    <MiniKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={base}
      config={{
        appearance: {
          mode: "auto",
          theme: "mini-app-theme",
          name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME,
          logo: process.env.NEXT_PUBLIC_ICON_URL,
        },
      }}
    >
      {props.children}
    </MiniKitProvider>
    </WagmiConfig>
  );
}
