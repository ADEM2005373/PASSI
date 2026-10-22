import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: false,
});

const securityHeaders = [
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://connect.facebook.net https://www.facebook.com https://*.facebook.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.unsplash.com https://raw.githubusercontent.com https://avatars.githubusercontent.com https://*.githubusercontent.com https://github.com https://i.imgur.com https://*.imgur.com https://www.facebook.com https://facebook.com https://*.facebook.com https://api.dicebear.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://images.unsplash.com https://*.unsplash.com https://www.facebook.com https://facebook.com https://*.facebook.com https://connect.facebook.net",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  // Clickjacking protection
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // MIME sniffing protection
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Referrer policy
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Permissions Policy (Camera allowed for QR scanning, microphone/geolocation disabled)
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), browsing-topics=()',
  },
  // HSTS (Forced HTTPS)
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // XSS Protection legacy header
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'github.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: '**.imgur.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.unsplash.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withSerwist(nextConfig);
