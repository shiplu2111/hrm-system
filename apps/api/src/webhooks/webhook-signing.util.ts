import { createHmac, timingSafeEqual } from 'crypto';

export const WEBHOOK_SIGNATURE_HEADER = 'x-hrm-signature';
export const WEBHOOK_EVENT_HEADER = 'x-hrm-event-type';
export const WEBHOOK_SCHEMA_HEADER = 'x-hrm-schema-version';
export const WEBHOOK_DELIVERY_HEADER = 'x-hrm-delivery-id';

/** Stripe-style signed payload: t=timestamp,v1=hmac_sha256(secret, "{t}.{body}") */
export function signWebhookBody(
  secret: string,
  timestamp: number,
  body: string,
): string {
  const signedContent = `${timestamp}.${body}`;
  const digest = createHmac('sha256', secret).update(signedContent).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

export function verifyWebhookSignature(
  secret: string,
  signatureHeader: string,
  body: string,
  toleranceSeconds = 300,
): boolean {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key, value];
    }),
  ) as { t?: string; v1?: string };

  if (!parts.t || !parts.v1) {
    return false;
  }

  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > toleranceSeconds) {
    return false;
  }

  const expected = signWebhookBody(secret, timestamp, body);
  const expectedSig = expected.split('v1=')[1] ?? '';
  const actualSig = parts.v1;

  if (expectedSig.length !== actualSig.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expectedSig), Buffer.from(actualSig));
}
