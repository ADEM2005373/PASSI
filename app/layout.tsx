import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], weight: ['400','500','600','700','800','900'] })

export const metadata: Metadata = {
  title: 'Passi · Billetterie intelligente',
  description: 'Réservez vos sorties, vivez plus intensément. Passi — la billetterie événementielle nouvelle génération.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={inter.className}>
      <body className="min-h-screen antialiased transition-colors duration-300">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
