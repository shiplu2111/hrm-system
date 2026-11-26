import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { CmsLocale } from '@hrm/shared-types';

export interface CmsPreviewTokenClaims {
  typ: 'cms_preview';
  aud: 'cms-preview';
  jti: string;
  pageId: string;
  slug: string;
  locale: CmsLocale;
  versionId: string;
  issuedBy: string | null;
  iat: number;
  exp: number;
}

function getPreviewSigningSecret(): string {
  return (
    process.env.CMS_PREVIEW_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    'cms_preview_hmac_dev_secret_2026'
  );
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const mod = padded.length % 4;
  const full = mod === 0 ? padded : padded + '='.repeat(4 - mod);
  return Buffer.from(full, 'base64').toString('utf8');
}

function signSegment(signingInput: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(signingInput).digest();
  return base64UrlEncode(sig);
}

export function signCmsPreviewToken(params: {
  pageId: string;
  slug: string;
  locale: CmsLocale;
  versionId: string;
  issuedBy?: string | null;
  ttlSeconds?: number;
  nowMs?: number;
}): { token: string; expiresAt: Date; claims: CmsPreviewTokenClaims } {
  const nowSec = Math.floor((params.nowMs ?? Date.now()) / 1000);
  const ttlSec = Math.min(24 * 60 * 60, Math.max(60, Math.floor(params.ttlSeconds ?? 30 * 60)));
  const exp = nowSec + ttlSec;

  const claims: CmsPreviewTokenClaims = {
    typ: 'cms_preview',
    aud: 'cms-preview',
    jti: randomUUID(),
    pageId: params.pageId,
    slug: params.slug,
    locale: params.locale,
    versionId: params.versionId,
    issuedBy: params.issuedBy ?? null,
    iat: nowSec,
    exp,
  };

  const headerEncoded = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadEncoded = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;
  const signatureEncoded = signSegment(signingInput, getPreviewSigningSecret());

  return {
    token: `${signingInput}.${signatureEncoded}`,
    expiresAt: new Date(exp * 1000),
    claims,
  };
}

export function verifyCmsPreviewToken(
  rawToken?: string | null,
  nowMs = Date.now(),
): CmsPreviewTokenClaims {
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  if (!token) {
    throw new UnauthorizedException({
      code: 'CMS_PREVIEW_TOKEN_REQUIRED',
      message: 'A valid signed preview token is required to view draft CMS content.',
    });
  }

  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new UnauthorizedException({
      code: 'CMS_PREVIEW_TOKEN_INVALID',
      message: 'Malformed CMS preview token.',
    });
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const expectedSig = signSegment(`${headerEncoded}.${payloadEncoded}`, getPreviewSigningSecret());

  const providedBuf = Buffer.from(signatureEncoded, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    throw new UnauthorizedException({
      code: 'CMS_PREVIEW_TOKEN_INVALID',
      message: 'Invalid CMS preview token signature.',
    });
  }

  let claims: Partial<CmsPreviewTokenClaims>;
  try {
    claims = JSON.parse(base64UrlDecode(payloadEncoded));
  } catch {
    throw new UnauthorizedException({
      code: 'CMS_PREVIEW_TOKEN_INVALID',
      message: 'Unparseable CMS preview token payload.',
    });
  }

  if (
    claims.typ !== 'cms_preview' ||
    claims.aud !== 'cms-preview' ||
    !claims.pageId ||
    !claims.versionId ||
    !claims.locale ||
    typeof claims.exp !== 'number'
  ) {
    throw new UnauthorizedException({
      code: 'CMS_PREVIEW_TOKEN_INVALID',
      message: 'Invalid CMS preview token claims.',
    });
  }

  const nowSec = Math.floor(nowMs / 1000);
  if (nowSec >= claims.exp) {
    throw new UnauthorizedException({
      code: 'CMS_PREVIEW_TOKEN_EXPIRED',
      message: 'CMS preview token has expired.',
    });
  }

  return claims as CmsPreviewTokenClaims;
}
