export type LivenessResult = 'ALIVE' | 'REMOVED' | 'UNKNOWN';

export interface SocialAdapter {
  readonly key: string;
  supports(platform: string): boolean;
  /**
   * Must return UNKNOWN (never REMOVED) for network errors, timeouts or rate limits.
   * Only a definitive "this page no longer exists" should return REMOVED.
   */
  checkLiveness(url: string): Promise<LivenessResult>;
}

const registry = new Map<string, SocialAdapter>();

export function registerAdapter(adapter: SocialAdapter) { registry.set(adapter.key, adapter); }

export function adapterFor(platform: string): SocialAdapter | null {
  for (const adapter of registry.values()) if (adapter.supports(platform)) return adapter;
  return null;
}

export function listAdapters() { return [...registry.values()]; }
