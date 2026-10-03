import { notifySessionExpired } from '@hrm/portal-ui';
import type { PaginationMeta } from '@hrm/shared-types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const TOKEN_KEY = 'hrm_admin_access_token';
const LEGACY_TOKEN_KEY = 'hrm_tenant_access_token';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getTenantAccessToken(): string | null {
  const current = localStorage.getItem(TOKEN_KEY);
  if (current) return current;
  const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacy) {
    localStorage.setItem(TOKEN_KEY, legacy);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    return legacy;
  }
  return null;
}

export function setTenantAccessToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }
}

interface ApiEnvelope<T> {
  data: T;
  meta?: PaginationMeta;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export async function tenantApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return (await tenantApiEnvelope<T>(path, options)).data;
}

/** Like `tenantApiRequest`, but keeps pagination `meta` for list endpoints. */
export async function tenantApiRequestWithMeta<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; meta: PaginationMeta | undefined }> {
  const envelope = await tenantApiEnvelope<T>(path, options);
  return { data: envelope.data, meta: envelope.meta };
}

async function tenantApiEnvelope<T>(
  path: string,
  options: RequestInit,
): Promise<ApiEnvelope<T>> {
  const token = getTenantAccessToken();
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return { data: undefined as T };
  }

  const payload = (await response.json().catch(() => ({}))) as
    | ApiEnvelope<T>
    | ApiErrorBody;

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody;

    if (response.status === 401 && !path.startsWith('/auth/')) {
      setTenantAccessToken(null);
      notifySessionExpired('admin');
    }

    throw new ApiError(
      errorBody.error?.message ?? `Request failed (${response.status})`,
      response.status,
      errorBody.error?.code,
    );
  }

  return payload as ApiEnvelope<T>;
}

export async function tenantLogin(
  email: string,
  password: string,
  tenantSubdomain: string,
): Promise<string> {
  const data = await tenantApiRequest<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, tenantSubdomain }),
  });

  setTenantAccessToken(data.accessToken);
  return data.accessToken;
}
