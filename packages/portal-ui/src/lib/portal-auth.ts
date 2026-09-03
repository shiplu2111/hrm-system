export type PortalKind = 'admin' | 'employee' | 'platform';

const TOKEN_KEYS: Record<PortalKind, string> = {
  admin: 'hrm_admin_access_token',
  employee: 'hrm_employee_access_token',
  platform: 'hrm_platform_access_token',
};

const SESSION_KEYS: Record<PortalKind, string> = {
  admin: 'hrm_admin_session',
  employee: 'hrm_employee_session',
  platform: 'hrm_platform_session',
};

const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? '/api/v1';

export interface PermissionClaim {
  module: string;
  action: string;
}

export interface PortalSessionUser {
  id: string;
  email: string;
  tenantId: string | null;
  roleId: string;
  roleName: string;
  employeeId: string | null;
  permissions: PermissionClaim[];
}

interface JwtPayload {
  sub: string;
  tenant_id: string | null;
  role_id: string;
  role_name?: string;
  employee_id: string | null;
  permissions?: PermissionClaim[];
  exp?: number;
}

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
  localStorage.removeItem(SESSION_KEYS[portal]);
}

export function getPortalSession(portal: PortalKind): PortalSessionUser | null {
  const raw = localStorage.getItem(SESSION_KEYS[portal]);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortalSessionUser;
  } catch {
    return null;
  }
}

function setPortalSession(portal: PortalKind, user: PortalSessionUser | null): void {
  if (user) {
    localStorage.setItem(SESSION_KEYS[portal], JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEYS[portal]);
  }
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const json = atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now();
}

/** Validates stored token + session belong to this portal and are not expired. */
export function validatePortalSession(portal: PortalKind): PortalSessionUser | null {
  const token = getPortalToken(portal);
  if (!token || isTokenExpired(token)) {
    clearPortalToken(portal);
    return null;
  }

  const session = getPortalSession(portal);
  if (session) {
    try {
      assertPortalAccess(portal, session);
      return session;
    } catch {
      clearPortalToken(portal);
      return null;
    }
  }

  const payload = decodeJwtPayload(token);
  if (!payload?.sub || !payload.role_id) {
    clearPortalToken(portal);
    return null;
  }

  const user: PortalSessionUser = {
    id: payload.sub,
    email: '',
    tenantId: payload.tenant_id ?? null,
    roleId: payload.role_id,
    roleName: payload.role_name ?? '',
    employeeId: payload.employee_id ?? null,
    permissions: payload.permissions ?? [],
  };

  try {
    assertPortalAccess(portal, user);
    setPortalSession(portal, user);
    return user;
  } catch {
    clearPortalToken(portal);
    return null;
  }
}

function hasPermission(
  user: Pick<PortalSessionUser, 'permissions'>,
  module: string,
  action: string,
): boolean {
  return (user.permissions ?? []).some(
    (p) => p.module === module && p.action === action,
  );
}

/** Admin-capable tenant user (HR, manager, owner, etc.) */
export function isAdminPortalUser(
  user: Pick<PortalSessionUser, 'roleName' | 'permissions' | 'employeeId'>,
): boolean {
  if (user.roleName === 'Employee') return false;
  if (user.roleName) return true;
  return (
    hasPermission(user, 'settings', 'view') ||
    hasPermission(user, 'employee', 'create') ||
    hasPermission(user, 'leave', 'approve')
  );
}

/** Self-service employee (ESS) login */
export function isEmployeePortalUser(
  user: Pick<PortalSessionUser, 'roleName' | 'permissions' | 'employeeId'>,
): boolean {
  if (user.roleName === 'Employee') return true;
  if (user.roleName) return false;
  return !!user.employeeId && !isAdminPortalUser(user);
}

export function assertPortalAccess(
  portal: PortalKind,
  user: Pick<PortalSessionUser, 'tenantId' | 'roleName' | 'permissions' | 'employeeId'>,
): void {
  if (portal === 'platform') {
    if (user.tenantId) {
      throw new ApiError(
        'This account belongs to a company tenant. Use the Company Admin or Employee portal.',
        403,
        'WRONG_PORTAL',
      );
    }
    return;
  }

  if (!user.tenantId) {
    throw new ApiError(
      'Platform operator accounts cannot sign in here. Use the Super Admin portal.',
      403,
      'WRONG_PORTAL',
    );
  }

  if (portal === 'employee' && !isEmployeePortalUser(user)) {
    throw new ApiError(
      'This account is not an employee self-service login. Use the Company Admin portal.',
      403,
      'WRONG_PORTAL',
    );
  }

  if (portal === 'admin' && !isAdminPortalUser(user)) {
    throw new ApiError(
      'Employee accounts must use the Employee portal, not Company Admin.',
      403,
      'WRONG_PORTAL',
    );
  }
}

let loginInFlight: Promise<{ token: string; user: PortalSessionUser }> | null = null;

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
    | ApiEnvelope<{
        accessToken: string;
        user: PortalSessionUser;
      }>
    | ApiErrorBody;

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody;
    throw new ApiError(
      errorBody.error?.message ?? 'Login failed',
      response.status,
      errorBody.error?.code,
    );
  }

  const data = (
    payload as ApiEnvelope<{
      accessToken: string;
      user: PortalSessionUser;
    }>
  ).data;

  assertPortalAccess(portal, data.user);

  setPortalToken(portal, data.accessToken);
  setPortalSession(portal, data.user);
  return data.accessToken;
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
      clearPortalToken(portal);
      throw new ApiError(
        errorBody.error?.message ?? 'Session expired',
        401,
        errorBody.error?.code ?? 'SESSION_EXPIRED',
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

  loginInFlight = portalLogin(portal, email, password, tenantSubdomain).then(
    (token) => ({
      token,
      user: getPortalSession(portal)!,
    }),
  );

  try {
    await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}
