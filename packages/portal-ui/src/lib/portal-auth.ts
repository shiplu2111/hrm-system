export type PortalKind = 'admin' | 'employee' | 'platform';

const TOKEN_KEYS: Record<PortalKind, string> = {
  admin: 'hrm_admin_access_token',
  employee: 'hrm_employee_access_token',
  platform: 'hrm_platform_access_token',
};

const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? '/api/v1';

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

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export function getPortalToken(portal: PortalKind): string | null {
  return localStorage.getItem(TOKEN_KEYS[portal]);
}

export function setPortalToken(portal: PortalKind, token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEYS[portal], token);
  } else {
    localStorage.removeItem(TOKEN_KEYS[portal]);
  }
}

export function clearPortalToken(portal: PortalKind): void {
  localStorage.removeItem(TOKEN_KEYS[portal]);
}

let loginInFlight: Promise<string> | null = null;

export async function portalLogin(
  portal: PortalKind,
  email: string,
  password: string,
  tenantSubdomain?: string,
): Promise<string> {
  const body: Record<string, string> = { email, password };
  if (tenantSubdomain) {
    body.tenantSubdomain = tenantSubdomain;
  }

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as
    | ApiEnvelope<{ accessToken: string; user?: { tenantId?: string | null } }>
    | ApiErrorBody;

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody;
    throw new ApiError(
      errorBody.error?.message ?? 'Login failed',
      response.status,
      errorBody.error?.code,
    );
  }

  const data = (payload as ApiEnvelope<{ accessToken: string; user?: { tenantId?: string | null } }>).data;
  const token = data.accessToken;

  if (portal === 'platform' && data.user?.tenantId) {
    throw new ApiError(
      'This account belongs to a company tenant. Use the Company Admin or Employee portal.',
      403,
      'WRONG_PORTAL',
    );
  }

  if (portal !== 'platform' && data.user?.tenantId == null) {
    throw new ApiError(
      'Platform operator accounts cannot sign in here. Use the Super Admin portal.',
      403,
      'WRONG_PORTAL',
    );
  }

  setPortalToken(portal, token);
  return token;
}

export async function portalApiRequest<T>(
  portal: PortalKind,
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const token = getPortalToken(portal);
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
    return undefined as T;
  }

  const payload = (await response.json().catch(() => ({}))) as
    | ApiEnvelope<T>
    | ApiErrorBody;

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody;

    if (response.status === 401 && !retried && !path.startsWith('/auth/')) {
      setPortalToken(portal, null);
      throw new ApiError(
        errorBody.error?.message ?? 'Session expired',
        401,
        errorBody.error?.code,
      );
    }

    throw new ApiError(
      errorBody.error?.message ?? `Request failed (${response.status})`,
      response.status,
      errorBody.error?.code,
    );
  }

  return (payload as ApiEnvelope<T>).data;
}

export async function ensurePortalLogin(
  portal: PortalKind,
  email: string,
  password: string,
  tenantSubdomain?: string,
): Promise<void> {
  if (loginInFlight) {
    await loginInFlight;
    return;
  }

  loginInFlight = portalLogin(portal, email, password, tenantSubdomain);

  try {
    await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}
