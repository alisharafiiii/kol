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
  icons: {
    icon: [
      { url: '/logo.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.png', sizes: '64x64', type: 'image/png' },
      { url: '/logo.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo.png', sizes: '512x512', type: 'image/png' },
      { url: '/logo.png', sizes: '1024x1024', type: 'image/png' },
    ],
    shortcut: '/logo.png',
    apple: '/logo.png',
    other: [
      {
        rel: 'mask-icon',
        url: '/logo.png',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.className} ${pressStart2P.variable} ${ibmPlexMono.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="icon" href="/logo.png" sizes="any" />
        <link rel="icon" href="/logo.png" type="image/png" sizes="1024x1024" />
        <link rel="icon" href="/logo.png" type="image/png" sizes="512x512" />
        <link rel="icon" href="/logo.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/logo.png" sizes="1024x1024" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00ff00" />
      </head>
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
