import { getUserId, getAuthToken } from '../user';

const API_BASE = '/api';

export { API_BASE };

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string = 'UNKNOWN') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Id': getUserId(),
    ...extra,
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers = init?.headers
    ? { ...authHeaders(), ...(init.headers as Record<string, string>) }
    : authHeaders();

  if (init?.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const res = await fetch(url, { ...init, headers });

  if (!res.ok) {
    let errorMessage = `Request failed: ${res.statusText}`;
    let errorCode = 'UNKNOWN';
    try {
      const body = await res.json();
      errorMessage = body.error || body.message || errorMessage;
      errorCode = body.code || errorCode;
    } catch {
      // not JSON
    }
    throw new ApiError(errorMessage, res.status, errorCode);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>;
  }

  return res.text() as unknown as T;
}
