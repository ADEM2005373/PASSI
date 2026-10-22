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
import { MetaPixelEvents } from '@/components/MetaPixelEvents'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={inter.className}>
      <head>
        {/* Meta Pixel Code */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '2127499911468404');
              fbq('track', 'PageView');
            `,
          }}
        />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=2127499911468404&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {/* End Meta Pixel Code */}
      </head>
      <body className="min-h-screen antialiased transition-colors duration-300">
        <Providers>
          <MetaPixelEvents />
          <ImpersonationBanner />
          {children}
        </Providers>
      </body>
    </html>
  )
}
