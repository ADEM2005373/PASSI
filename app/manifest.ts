import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Passi',
    short_name: 'Passi',
    description: 'Passi Event Ticketing & QR Scanner',
    start_url: '/',
    display: 'standalone',
    background_color: '#101828',
    theme_color: '#101828',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
