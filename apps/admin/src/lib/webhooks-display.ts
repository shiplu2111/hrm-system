import {
  WEBHOOK_EVENT_CATALOG,
  WEBHOOK_TEST_EVENT,
  type WebhookDeliveryEventType,
  type WebhookDeliveryRecord,
  type WebhookDeliveryState,
} from '@hrm/shared-types';
import type { StatusPillTone } from '@/components/ui/StatusPill';

export const DELIVERY_STATE_DISPLAY: Record<
  WebhookDeliveryState,
  { label: string; tone: StatusPillTone }
> = {
  pending: { label: 'Queued', tone: 'neutral' },
  sending: { label: 'Sending', tone: 'accent' },
  retrying: { label: 'Retrying', tone: 'warning' },
  delivered: { label: 'Delivered', tone: 'success' },
  failed: { label: 'Failed', tone: 'error' },
};

export const DELIVERY_STATE_FILTERS: Array<{ value: WebhookDeliveryState | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'retrying', label: 'Retrying' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Queued' },
  { value: 'sending', label: 'Sending' },
];

export function eventLabel(eventType: WebhookDeliveryEventType): string {
  if (eventType === WEBHOOK_TEST_EVENT) return 'Test event';
  return WEBHOOK_EVENT_CATALOG[eventType]?.label ?? eventType;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(value: string | null, now = Date.now()): string {
  if (!value) return '—';
  const diff = new Date(value).getTime() - now;
  const minutes = Math.round(Math.abs(diff) / 60_000);
  const future = diff > 0;
  if (minutes < 1) return future ? 'in a few seconds' : 'just now';
  let unit: string;
  if (minutes < 60) unit = `${minutes} min`;
  else if (minutes < 60 * 24) unit = `${Math.round(minutes / 60)} h`;
  else unit = `${Math.round(minutes / (60 * 24))} d`;
  return future ? `in ${unit}` : `${unit} ago`;
}

export function formatDelay(ms: number): string {
  const minutes = ms / 60_000;
  return minutes < 60 ? `${minutes} min` : `${minutes / 60} h`;
}

/** One line under the status pill explaining where the delivery is in its retry cycle. */
export function retryDetail(delivery: WebhookDeliveryRecord, now = Date.now()): string | null {
  const attempt = `attempt ${delivery.attempts} of ${delivery.maxAttempts}`;
  switch (delivery.state) {
    case 'retrying':
      return delivery.nextAttemptAt
        ? `${capitalise(attempt)} failed · next try ${formatRelative(delivery.nextAttemptAt, now)}`
        : `${capitalise(attempt)} failed`;
    case 'sending':
      return capitalise(attempt);
    case 'failed':
      return delivery.attempts > 0
        ? `Gave up after ${delivery.attempts} attempt${delivery.attempts === 1 ? '' : 's'}`
        : 'Not sent';
    case 'delivered':
      return delivery.attempts > 1 ? `Delivered on attempt ${delivery.attempts}` : null;
    default:
      return null;
  }
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export type VerificationLanguage = 'node' | 'php' | 'laravel' | 'custom';

/** Must stay in sync with signWebhookBody in apps/api/src/webhooks/webhook-signing.util.ts. */
export const SIGNATURE_TEST_VECTOR = {
  secret: 'whsec_test',
  timestamp: '1700000000',
  body: '{"type":"webhook.test"}',
  signature: 'cf7d053522b08300fae293c3bcbf4e183d4a9538620c18dc9a46d063337936fa',
};

export const VERIFICATION_EXAMPLES: Array<{ id: VerificationLanguage; label: string; code: string }> = [
  {
    id: 'node',
    label: 'Node.js',
    code: `import crypto from 'node:crypto';

// rawBody: the request body exactly as received (string or Buffer),
// e.g. express.raw({ type: 'application/json' })
function verify(rawBody, signatureHeader, secret) {
  const parts = Object.fromEntries(
    (signatureHeader ?? '').split(',').map((p) => p.split(/=(.*)/s).slice(0, 2)),
  );
  const age = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (!parts.t || !parts.v1 || age > 300) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${parts.t}.\${rawBody}\`)
    .digest('hex');
  return (
    expected.length === parts.v1.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))
  );
}

// verify(req.body, req.headers['x-hrm-signature'], process.env.HRM_WEBHOOK_SECRET)`,
  },
  {
    id: 'php',
    label: 'PHP',
    code: `<?php
// Read the raw body before anything parses it.
$rawBody = file_get_contents('php://input');
$header  = $_SERVER['HTTP_X_HRM_SIGNATURE'] ?? '';
$secret  = getenv('HRM_WEBHOOK_SECRET');

function hrm_verify_signature(string $rawBody, string $header, string $secret, int $tolerance = 300): bool
{
    $parts = [];
    foreach (explode(',', $header) as $pair) {
        [$key, $value] = array_pad(explode('=', trim($pair), 2), 2, '');
        $parts[$key] = $value;
    }
    if (empty($parts['t']) || empty($parts['v1'])) {
        return false;
    }
    if (abs(time() - (int) $parts['t']) > $tolerance) {
        return false; // too old (or clock skew): possible replay
    }
    $expected = hash_hmac('sha256', $parts['t'] . '.' . $rawBody, $secret);
    return hash_equals($expected, $parts['v1']);
}

if (!hrm_verify_signature($rawBody, $header, $secret)) {
    http_response_code(401);
    exit;
}

$event      = json_decode($rawBody, true);
$deliveryId = $_SERVER['HTTP_X_HRM_DELIVERY_ID'] ?? null; // same on every retry
// Skip if $deliveryId was already processed, queue the work, then answer fast.
http_response_code(200);`,
  },
  {
    id: 'laravel',
    label: 'Laravel',
    code: `<?php
// routes/api.php — exclude this route from CSRF; don't let middleware rewrite the body.
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Route;

Route::post('/webhooks/cmsn-hr', function (Request $request) {
    $rawBody = $request->getContent();
    $header  = (string) $request->header('X-HRM-Signature', '');
    $secret  = config('services.cmsn_hr.webhook_secret');

    parse_str(str_replace(',', '&', $header), $parts);
    $t  = $parts['t'] ?? '';
    $v1 = $parts['v1'] ?? '';

    $expected = hash_hmac('sha256', $t . '.' . $rawBody, $secret);
    if ($t === '' || abs(time() - (int) $t) > 300 || !hash_equals($expected, $v1)) {
        abort(401);
    }

    $deliveryId = $request->header('X-HRM-Delivery-Id'); // dedupe on this
    // dispatch(new HandleHrmWebhook($request->json()->all(), $deliveryId));
    return response()->noContent(); // 204 = delivered
});`,
  },
  {
    id: 'custom',
    label: 'Custom / other',
    code: `Works in any language with HMAC-SHA256:

1. Read the raw request body as bytes, before any JSON parsing or re-encoding.
2. Split the X-HRM-Signature header on "," and each part on the first "=":
     t  = Unix timestamp in seconds
     v1 = signature, lowercase hex
3. Reject if |now - t| > 300 seconds (replay protection).
4. signed_payload = t + "." + raw_body
5. expected = hex( HMAC_SHA256(key = secret, message = signed_payload) )
   The key is the whole secret string, including "whsec_", as UTF-8 bytes.
6. Compare expected and v1 with a constant-time comparison.
   Not equal → respond 401 and ignore the request.
7. Respond with any 2xx within 15 seconds. Do slow work afterwards (queue it).
   Use X-HRM-Delivery-Id to skip duplicates: retries reuse the same ID.

Test vector (check your code produces this):
  secret = ${SIGNATURE_TEST_VECTOR.secret}
  t      = ${SIGNATURE_TEST_VECTOR.timestamp}
  body   = ${SIGNATURE_TEST_VECTOR.body}
  v1     = ${SIGNATURE_TEST_VECTOR.signature}
  header = X-HRM-Signature: t=${SIGNATURE_TEST_VECTOR.timestamp},v1=${SIGNATURE_TEST_VECTOR.signature}`,
  },
];
