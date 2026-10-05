import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], weight: ['400','500','600','700','800','900'] })

export const viewport: Viewport = {
  themeColor: '#101828',
}

export const metadata: Metadata = {
  title: 'Passi · Billetterie intelligente',
  description: 'Réservez vos sorties, vivez plus intensément. Passi — la billetterie événementielle nouvelle génération.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Passi',
  },
}

import { ImpersonationBanner } from '@/components/ImpersonationBanner'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={inter.className}>
      <body className="min-h-screen antialiased transition-colors duration-300">
        <Providers>
          <ImpersonationBanner />
          {children}
        </Providers>
      </body>
    </html>
  )
}
