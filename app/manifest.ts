import type { MetadataRoute } from 'next';

// Web app manifest — makes Content Box installable (Add to Home Screen / PWA)
// with the neon box icon. Served at /manifest.webmanifest; Next links it
// automatically from the document head.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Content Box',
    short_name: 'Content Box',
    description: 'Temporary multi-creator content rental marketplace.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
