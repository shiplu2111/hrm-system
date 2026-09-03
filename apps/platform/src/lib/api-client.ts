const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const TOKEN_KEY = 'hrm_platform_access_token';

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

export function getPlatformAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setPlatformAccessToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getPlatformAccessToken();
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

  const payload = (await response.json().catch(() => ({}))) as
    | ApiEnvelope<T>
    | ApiErrorBody;

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody;
    throw new ApiError(
      errorBody.error?.message ?? `Request failed (${response.status})`,
      response.status,
      errorBody.error?.code,
    );
  }

  return (payload as ApiEnvelope<T>).data;
}

export async function platformLogin(
  email: string,
  password: string,
): Promise<string> {
  const data = await apiRequest<{
    accessToken: string;
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  setPlatformAccessToken(data.accessToken);
  return data.accessToken;
}
