import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sanitizeAnalyticsPath, sanitizeAnalyticsProps } from '../../../../lib/analytics';

const MAX_BODY_BYTES = 8 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQUESTS = 120;

const ipBuckets = new Map<string, number[]>();

function isRateLimited(clientKey: string, now = Date.now()): boolean {
  const recent = (ipBuckets.get(clientKey) ?? []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_REQUESTS) {
    ipBuckets.set(clientKey, recent);
    return true;
  }
  recent.push(now);
  ipBuckets.set(clientKey, recent);
  if (ipBuckets.size > 5000) {
    // Periodic pruning of stale buckets
    for (const [k, list] of ipBuckets.entries()) {
      if (list.every((ts) => now - ts >= RATE_WINDOW_MS)) {
        ipBuckets.delete(k);
      }
    }
  }
  return false;
}

const analyticsPayloadSchema = z.object({
  event: z.enum([
    'pageview',
    'visit',
    'pricing_view',
    'signup_start',
    'email_verified',
    'tenant_created',
    'demo_request',
    'contact_submit',
  ]),
  path: z.string().max(500).optional().default('/'),
  locale: z.string().max(16).optional(),
  cookieless: z.boolean().optional().default(true),
  provider: z.enum(['plausible', 'first-party', 'none']).optional().default('first-party'),
  props: z.record(z.unknown()).optional(),
});

/**
 * First-party non-PII analytics collector endpoint gated behind cookie consent
 * (or explicit cookieless mode where law allows). Enforces size limit and rate limit,
 * strips all PII, and never sets cookies.
 */
export async function POST(request: Request) {
  try {
    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const clientIp = forwardedFor || request.headers.get('x-real-ip') || 'anonymous';
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many analytics requests.' } },
        { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } },
      );
    }

    const contentLengthHeader = request.headers.get('content-length');
    if (contentLengthHeader && Number(contentLengthHeader) > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Analytics payload exceeds size limit.' } },
        { status: 413, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const rawText = await request.text();
    if (Buffer.byteLength(rawText, 'utf8') > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Analytics payload exceeds size limit.' } },
        { status: 413, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    let rawBody: unknown = null;
    try {
      rawBody = JSON.parse(rawText);
    } catch {
      rawBody = null;
    }

    const parsed = analyticsPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_ANALYTICS_PAYLOAD', message: 'Invalid analytics event payload.' } },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const sanitizedPath = sanitizeAnalyticsPath(parsed.data.path);
    const sanitizedProps = sanitizeAnalyticsProps(parsed.data.props);
    if (parsed.data.locale && /^[a-z]{2}(-[A-Z]{2})?$/.test(parsed.data.locale)) {
      sanitizedProps.locale = parsed.data.locale;
    }

    // Optional server-side forwarder to Plausible Events API (strictly cookieless & non-PII)
    const plausibleHost = process.env.PLAUSIBLE_API_HOST?.trim().replace(/\/+$/, '');
    const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5180').replace(/\/+$/, '');

    if (plausibleHost && plausibleDomain && parsed.data.provider !== 'none') {
      void fetch(`${plausibleHost}/api/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': request.headers.get('user-agent') || 'CMSN-HR-Website/1.0',
        },
        body: JSON.stringify({
          name: parsed.data.event,
          url: `${siteUrl}${sanitizedPath}`,
          domain: plausibleDomain,
          props: sanitizedProps,
        }),
      }).catch(() => {
        // Non-blocking upstream telemetry forwarding
      });
    }

    return new NextResponse(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        'X-Analytics-Cookieless': parsed.data.cookieless ? '1' : '0',
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
