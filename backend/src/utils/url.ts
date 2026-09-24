import type { Platform } from '../../../shared/constants';

const HOST_MAP: Record<string, Platform> = {
  'instagram.com': 'INSTAGRAM',
  'facebook.com': 'FACEBOOK',
  'fb.watch': 'FACEBOOK',
  'linkedin.com': 'LINKEDIN',
  'twitter.com': 'X',
  'x.com': 'X',
  'youtube.com': 'YOUTUBE',
  'youtu.be': 'YOUTUBE',
  't.me': 'TELEGRAM',
  'telegram.me': 'TELEGRAM',
};

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'igshid', 'igsh', 'fbclid', 'gclid', 'si', 'feature', 'ref_src', 'ref_url', 's', 't',
]);

/**
 * Strips tracking params, lowercases the host and removes trailing slashes so that
 * two visually different URLs pointing at the same post collide on the unique index.
 */
export function normaliseUrl(raw: string): string {
  const url = new URL(raw.trim());
  url.hash = '';
  url.protocol = 'https:';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.search = url.searchParams.toString() ? `?${url.searchParams.toString()}` : '';
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.toString();
}

export function detectPlatform(raw: string): Platform | null {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
    for (const [domain, platform] of Object.entries(HOST_MAP)) {
      if (host === domain || host.endsWith(`.${domain}`)) return platform;
    }
    return null;
  } catch {
    return null;
  }
}

export function platformMatchesUrl(platform: Platform, raw: string): boolean {
  const detected = detectPlatform(raw);
  return detected === null || detected === platform;
}
