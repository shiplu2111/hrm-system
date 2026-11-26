import type { CorsOptions, CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';

const ALLOWED_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'];
const ALLOWED_HEADERS = ['Content-Type', 'Accept', 'Authorization', 'x-request-id', 'x-tenant-id'];

function addOriginFromUrl(target: Set<string>, raw?: string): void {
  if (!raw) return;
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      const origin = new URL(trimmed).origin;
      target.add(origin);
    } catch {
      // Ignore malformed origin config
    }
  }
}

export function isPublicApiPath(urlPath: string): boolean {
  const normalized = (urlPath || '').split('?')[0] ?? '';
  return (
    normalized === '/api/v1/public' ||
    normalized.startsWith('/api/v1/public/') ||
    normalized === '/public' ||
    normalized.startsWith('/public/')
  );
}

export function resolveWebsiteOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const origins = new Set<string>();
  addOriginFromUrl(origins, env.WEBSITE_URL);
  addOriginFromUrl(origins, env.NEXT_PUBLIC_SITE_URL);
  addOriginFromUrl(origins, env.PUBLIC_CORS_ORIGINS);

  if (env.NODE_ENV !== 'production') {
    origins.add('http://localhost:5180');
    origins.add('http://127.0.0.1:5180');
  }

  return origins;
}

export function resolveAppOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const origins = resolveWebsiteOrigins(env);
  addOriginFromUrl(origins, env.APP_PORTAL_URL);
  addOriginFromUrl(origins, env.NEXT_PUBLIC_PORTAL_URL);
  addOriginFromUrl(origins, env.EMPLOYEE_APP_URL);
  addOriginFromUrl(origins, env.NEXT_PUBLIC_EMPLOYEE_APP_URL);
  addOriginFromUrl(origins, env.ADMIN_URL);
  addOriginFromUrl(origins, env.PLATFORM_URL);
  addOriginFromUrl(origins, env.NEXT_PUBLIC_PLATFORM_URL);
  addOriginFromUrl(origins, env.CORS_ALLOWED_ORIGINS);

  if (env.NODE_ENV !== 'production') {
    for (const port of ['5173', '5174', '5175', '5176', '5180']) {
      origins.add(`http://localhost:${port}`);
      origins.add(`http://127.0.0.1:${port}`);
    }
  }

  return origins;
}

export function isOriginAllowedForRequest(
  origin: string | undefined,
  urlPath: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!origin) return false;
  if (isPublicApiPath(urlPath)) {
    return resolveWebsiteOrigins(env).has(origin);
  }
  return resolveAppOrigins(env).has(origin);
}

/**
 * Route-aware CORS delegate:
 * - `/api/v1/public/*` allows ONLY configured website origins (no wildcard reflection)
 * - Non-public routes allow explicit configured portal/admin/platform/website origins
 */
export function createCorsDelegate(env: NodeJS.ProcessEnv = process.env): CorsOptionsDelegate<any> {
  return (req, callback) => {
    const requestOrigin =
      typeof req?.headers?.origin === 'string' ? req.headers.origin.trim() : undefined;
    const requestPath = req?.originalUrl || req?.url || '';
    const isPublic = isPublicApiPath(requestPath);
    const allowed = isOriginAllowedForRequest(requestOrigin, requestPath, env);

    const options: CorsOptions = {
      origin: allowed && requestOrigin ? requestOrigin : false,
      credentials: allowed ? !isPublic : false,
      methods: ALLOWED_METHODS,
      allowedHeaders: ALLOWED_HEADERS,
    };

    callback(null, options);
  };
}
