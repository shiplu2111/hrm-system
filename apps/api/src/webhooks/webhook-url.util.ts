import { lookup } from 'dns/promises';
import { isIP } from 'net';

export const WEBHOOK_URL_MAX_LENGTH = 2048;

export class WebhookUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookUrlError';
  }
}

/** Only for self-hosted installs whose receivers live on the private network. */
export function privateWebhookTargetsAllowed(): boolean {
  return process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS === 'true';
}

function httpAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || privateWebhookTargetsAllowed();
}

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

function ipv4ToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inIpv4Range(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const PRIVATE_IPV4_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
];

/** Loopback, private, link-local, CGNAT, multicast and reserved addresses. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase();
  const version = isIP(ip);
  if (version === 4) {
    return PRIVATE_IPV4_RANGES.some(([base, bits]) => inIpv4Range(ip, base, bits));
  }
  if (version !== 6) {
    return false;
  }

  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) {
    return isPrivateAddress(mapped[1]);
  }
  if (ip === '::' || ip === '::1') {
    return true;
  }
  const firstHextet = parseInt(ip.split(':')[0] || '0', 16);
  return (
    (firstHextet & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (firstHextet & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (firstHextet & 0xff00) === 0xff00 // ff00::/8 multicast
  );
}

function hostIsBlockedName(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return (
    host === 'localhost' ||
    !host.includes('.') ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

/** Registration-time check; returns the normalised URL. */
export function assertValidWebhookUrl(raw: string): string {
  const value = raw.trim();
  if (value.length > WEBHOOK_URL_MAX_LENGTH) {
    throw new WebhookUrlError('Endpoint URL is too long.');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WebhookUrlError('Enter a full URL, starting with https://');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new WebhookUrlError('Endpoint URL must start with https://');
  }
  if (url.protocol === 'http:' && !httpAllowed()) {
    throw new WebhookUrlError('Endpoint URL must use https://');
  }
  if (url.username || url.password) {
    throw new WebhookUrlError(
      'Don’t put credentials in the URL. Verify requests with the signing secret instead.',
    );
  }
  if (url.hash) {
    throw new WebhookUrlError('Endpoint URL can’t contain a # fragment.');
  }

  if (!privateWebhookTargetsAllowed()) {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) ? isPrivateAddress(host) : hostIsBlockedName(host)) {
      throw new WebhookUrlError(
        'Endpoint must be reachable on the public internet. Local and private network addresses aren’t allowed.',
      );
    }
  }

  return url.toString();
}

/** Delivery-time check: the hostname must not resolve to a private address. */
export async function assertDeliverableWebhookUrl(raw: string): Promise<void> {
  const url = new URL(assertValidWebhookUrl(raw));
  if (privateWebhookTargetsAllowed()) {
    return;
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error(`Could not resolve ${host} (DNS lookup failed).`);
  }
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new WebhookUrlError(
      `${host} resolves to a private network address, so it was not called.`,
    );
  }
}
