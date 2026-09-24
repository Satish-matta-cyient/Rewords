import { describe, it, expect } from 'vitest';
import { normaliseUrl, detectPlatform, platformMatchesUrl } from '../../../backend/src/utils/url';

describe('URL normalisation', () => {
  it('collapses tracking-parameter variants onto one canonical URL', () => {
    const base = 'https://www.instagram.com/p/ABC123';
    expect(normaliseUrl(`${base}/?utm_source=whatsapp&igshid=xyz`)).toBe(normaliseUrl(base));
    expect(normaliseUrl(`${base}#comment`)).toBe(normaliseUrl(base));
    expect(normaliseUrl('https://m.instagram.com/p/ABC123/')).toBe(normaliseUrl(base));
  });

  it('identifies the platform from the host', () => {
    expect(detectPlatform('https://www.instagram.com/p/x')).toBe('INSTAGRAM');
    expect(detectPlatform('https://x.com/user/status/1')).toBe('X');
    expect(detectPlatform('https://youtu.be/abc')).toBe('YOUTUBE');
    expect(detectPlatform('https://example.com/post')).toBeNull();
  });

  it('rejects a URL that contradicts the declared platform', () => {
    expect(platformMatchesUrl('INSTAGRAM', 'https://www.linkedin.com/posts/x')).toBe(false);
    expect(platformMatchesUrl('LINKEDIN', 'https://www.linkedin.com/posts/x')).toBe(true);
  });
});
