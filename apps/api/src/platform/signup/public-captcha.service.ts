import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import type { PublicCaptchaChallengeResponse } from '@hrm/shared-types';

interface ChallengePayload {
  nonce: string;
  expected: number;
  exp: number;
}

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const TURNSTILE_TIMEOUT_MS = 3000;
const PROVIDER_FALLBACK_COOLDOWN_MS = 60 * 1000;
const DEFAULT_TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

@Injectable()
export class PublicCaptchaService {
  private readonly logger = new Logger(PublicCaptchaService.name);
  private readonly usedNonces = new Map<string, number>();
  private providerDegradedUntil = 0;

  private getSigningSecret(): string {
    return (
      process.env.SIGNUP_CAPTCHA_SECRET ||
      process.env.FIELD_ENCRYPTION_KEY ||
      process.env.JWT_ACCESS_SECRET ||
      'dev-public-signup-captcha-secret'
    );
  }

  private signPayload(encodedPayload: string): string {
    return createHmac('sha256', this.getSigningSecret())
      .update(encodedPayload)
      .digest('base64url');
  }

  private pruneUsedNonces(now: number): void {
    for (const [nonce, exp] of this.usedNonces.entries()) {
      if (exp <= now) {
        this.usedNonces.delete(nonce);
      }
    }
  }

  isTurnstileConfigured(): boolean {
    return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
  }

  isProviderFallbackActive(now = Date.now()): boolean {
    return !this.isTurnstileConfigured() || this.providerDegradedUntil > now;
  }

  markProviderDegraded(now = Date.now()): void {
    this.providerDegradedUntil = now + PROVIDER_FALLBACK_COOLDOWN_MS;
  }

  issueChallenge(now = Date.now()): PublicCaptchaChallengeResponse {
    const a = randomInt(2, 10);
    const b = randomInt(2, 10);
    const exp = now + CHALLENGE_TTL_MS;
    const payload: ChallengePayload = {
      nonce: randomBytes(12).toString('hex'),
      expected: a + b,
      exp,
    };

    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = this.signPayload(encoded);
    const turnstileSiteKey =
      process.env.TURNSTILE_SITE_KEY?.trim() || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
    const fallbackActive = this.isProviderFallbackActive(now);

    return {
      challengeId: `${encoded}.${sig}`,
      prompt: `Verify human check: what is ${a} + ${b}?`,
      expiresAt: new Date(exp).toISOString(),
      provider: fallbackActive ? 'local_fallback' : 'turnstile',
      fallbackActive,
      ...(!fallbackActive && turnstileSiteKey ? { siteKey: turnstileSiteKey } : {}),
    };
  }

  async verifyToken(token: string, remoteIp?: string): Promise<void> {
    const trimmed = token?.trim() ?? '';
    if (!trimmed) {
      throw new BadRequestException({
        code: 'CAPTCHA_FAILED',
        message: 'CAPTCHA verification is required.',
      });
    }

    // Production Turnstile verification when configured and token is not local HMAC fallback challenge
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (turnstileSecret && !trimmed.includes(':')) {
      const verifyUrl = process.env.TURNSTILE_VERIFY_URL?.trim() || DEFAULT_TURNSTILE_VERIFY_URL;
      const form = new URLSearchParams();
      form.set('secret', turnstileSecret);
      form.set('response', trimmed);
      if (remoteIp) form.set('remoteip', remoteIp);

      try {
        const res = await fetch(verifyUrl, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
        });

        if (!res.ok) {
          this.markProviderDegraded();
          this.logger.warn(
            `[CAPTCHA_PROVIDER_FALLBACK] External CAPTCHA returned HTTP ${res.status}; activating local signed fallback challenge.`,
          );
          throw new BadRequestException({
            code: 'CAPTCHA_PROVIDER_DEGRADED',
            message:
              'External verification provider is temporarily unavailable. Please refresh and complete the fallback security check.',
          });
        }

        const data = (await res.json()) as { success?: boolean };
        if (data?.success === true) {
          this.providerDegradedUntil = 0;
          return;
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) {
          throw err;
        }
        this.markProviderDegraded();
        this.logger.warn(
          `[CAPTCHA_PROVIDER_FALLBACK] Turnstile verification unavailable (${err?.message ?? 'network error'}); activating signed local fallback challenge.`,
        );
        throw new BadRequestException({
          code: 'CAPTCHA_PROVIDER_DEGRADED',
          message:
            'External verification provider is temporarily unavailable. Please refresh and complete the fallback security check.',
        });
      }

      throw new BadRequestException({
        code: 'CAPTCHA_FAILED',
        message: 'CAPTCHA verification failed. Please try again.',
      });
    }

    // Built-in & fallback accessible signed challenge format: "<encoded>.<sig>:<answer>"
    const colonIdx = trimmed.lastIndexOf(':');
    if (colonIdx <= 0) {
      throw new BadRequestException({
        code: 'CAPTCHA_FAILED',
        message: 'CAPTCHA challenge format is invalid.',
      });
    }

    const challengeId = trimmed.slice(0, colonIdx);
    const answerRaw = trimmed.slice(colonIdx + 1).trim();
    const dotIdx = challengeId.indexOf('.');
    if (dotIdx <= 0) {
      throw new BadRequestException({
        code: 'CAPTCHA_FAILED',
        message: 'CAPTCHA challenge token is invalid.',
      });
    }

    const encoded = challengeId.slice(0, dotIdx);
    const providedSig = challengeId.slice(dotIdx + 1);
    const expectedSig = this.signPayload(encoded);

    const sigBufA = Buffer.from(providedSig, 'utf8');
    const sigBufB = Buffer.from(expectedSig, 'utf8');
    if (sigBufA.length !== sigBufB.length || !timingSafeEqual(sigBufA, sigBufB)) {
      throw new BadRequestException({
        code: 'CAPTCHA_FAILED',
        message: 'CAPTCHA signature verification failed.',
      });
    }

    let payload: ChallengePayload;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ChallengePayload;
    } catch {
      throw new BadRequestException({
        code: 'CAPTCHA_FAILED',
        message: 'CAPTCHA payload is malformed.',
      });
    }

    const now = Date.now();
    this.pruneUsedNonces(now);

    if (!payload.nonce || payload.exp < now) {
      throw new BadRequestException({
        code: 'CAPTCHA_FAILED',
        message: 'CAPTCHA challenge expired. Please refresh and try again.',
      });
    }

    if (this.usedNonces.has(payload.nonce)) {
      throw new BadRequestException({
        code: 'CAPTCHA_FAILED',
        message: 'CAPTCHA challenge has already been used.',
      });
    }

    const parsedAnswer = Number.parseInt(answerRaw, 10);
    if (!Number.isFinite(parsedAnswer) || parsedAnswer !== payload.expected) {
      throw new BadRequestException({
        code: 'CAPTCHA_FAILED',
        message: 'Incorrect CAPTCHA verification answer.',
      });
    }

    this.usedNonces.set(payload.nonce, payload.exp);
  }
}
