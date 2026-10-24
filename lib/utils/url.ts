/**
 * Canonical URL Utility
 * Prevents Vercel deployment hash URL leaks and cross-domain cookie dropping during OAuth & Auth redirects.
 */
export const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // 1. Force absolute production URL first
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // 2. Fallback
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  url = url.startsWith('http') ? url : `https://${url}`;
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

/**
 * Auto-converts GitHub blob URLs to raw user content URLs so images can render properly.
 * E.g., https://github.com/user/repo/blob/main/image.png -> https://raw.githubusercontent.com/user/repo/main/image.png
 */
export function formatImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.includes('github.com') && trimmed.includes('/blob/')) {
    return trimmed.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }
  return trimmed;
}

/**
 * Returns the canonical public URL for dynamic web passes (/p/:secretToken)
 */
export function getPassWebLink(secretToken: string): string {
  const base = process?.env?.NEXT_PUBLIC_SITE_URL || process?.env?.NEXT_PUBLIC_APP_URL || getURL();
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${cleanBase}/p/${secretToken}`;
}

