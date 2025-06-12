import '@/app/globals.css'
import type { Metadata } from 'next'
import WagmiProvider from '@/components/WagmiProvider'
import OnchainKitProvider from '@/components/OnchainKitProvider'
import SessionWrap from '@/components/SessionWrap'
import { Inter } from 'next/font/google'
import UserIdentityManager from '@/components/UserIdentityManager'
import LayoutWrapper from '@/components/LayoutWrapper'
import { pressStart2P, ibmPlexMono } from './fonts'
import '@/lib/ensure-upload-dirs'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NABULINES',
  description: 'A retro cyberpunk KOL connector application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.className} ${pressStart2P.variable} ${ibmPlexMono.variable}`}>
      <body>
        <SessionWrap>
          <WagmiProvider>
            <OnchainKitProvider>
              <LayoutWrapper>
                {children}
              </LayoutWrapper>
              <UserIdentityManager />
            </OnchainKitProvider>
          </WagmiProvider>
        </SessionWrap>
      </body>
    </html>
  )
}
