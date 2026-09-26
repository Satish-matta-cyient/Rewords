import type { ApiResponse } from '@shared/types';

// A trailing slash here is a common deployment typo and would double up in every path.
const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/+$/, '');

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, string>;
  readonly requestId?: string;

  constructor(message: string, status: number, code: string, details?: Record<string, string>, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

const OFFLINE_MESSAGE = 'Cannot reach the server. Check your internet connection and try again.';
const UNREACHABLE_MESSAGE = 'The EduRewards service is not responding right now. Please try again in a moment.';

/** A failed fetch means the request never reached the API — surface that plainly. */
async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, 0, 'NETWORK_ERROR');
  }
}

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) { accessToken = token; }
export function getAccessToken() { return accessToken; }
export function setUnauthorizedHandler(handler: () => void) { onUnauthorized = handler; }

async function attemptRefresh(): Promise<boolean> {
  // Collapse concurrent 401s into a single refresh round-trip.
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!response.ok) return false;
      const payload = (await response.json()) as ApiResponse<{ accessToken: string }>;
      if (!payload.success) return false;
      setAccessToken(payload.data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  raw?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function execute<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { body, query, raw, headers, ...rest } = options;
  const isFormData = body instanceof FormData;

  const response = await send(buildUrl(path, query), {
    ...rest,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(headers as Record<string, string>),
    },
    ...(body !== undefined ? { body: isFormData ? body : JSON.stringify(body) } : {}),
  });

  // A 401 on any call triggers one silent refresh-and-retry.
  if (response.status === 401 && !isRetry && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    const refreshed = await attemptRefresh();
    if (refreshed) return execute<T>(path, options, true);
    setAccessToken(null);
    onUnauthorized?.();
  }

  if (raw) {
    if (!response.ok) throw new ApiError('Request failed', response.status, 'INTERNAL_ERROR');
    return (await response.text()) as T;
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  // The API always answers JSON. A non-JSON body means a proxy or static host
  // answered instead, so the request never reached the backend.
  if (!payload) throw new ApiError(UNREACHABLE_MESSAGE, response.status, 'NETWORK_ERROR');
  if (!payload.success) {
    throw new ApiError(
      payload.error.message,
      response.status,
      payload.error.code,
      payload.error.details as Record<string, string> | undefined,
      payload.error.requestId,
    );
  }
  return payload.data;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => execute<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => execute<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => execute<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => execute<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) => execute<T>(path, { ...options, method: 'DELETE', body }),
  download: async (path: string, query?: RequestOptions['query']) => {
    const response = await send(buildUrl(path, query), {
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!response.ok) throw new ApiError('Export failed', response.status, 'INTERNAL_ERROR');
    return response.blob();
  },
};
