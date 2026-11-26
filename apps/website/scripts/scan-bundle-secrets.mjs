import fs from 'node:fs';
import path from 'node:path';

const WEBSITE_ROOT = path.resolve(import.meta.dirname, '..');
const NEXT_STATIC_DIR = path.join(WEBSITE_ROOT, '.next', 'static');
const SRC_DIR = path.join(WEBSITE_ROOT, 'src');

const FORBIDDEN_SECRET_IDENTIFIERS = [
  'FIELD_ENCRYPTION_KEY',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'TURNSTILE_SECRET_KEY',
  'SIGNUP_CAPTCHA_SECRET',
  'DATABASE_URL',
  'POSTGRES_PASSWORD',
  'REDIS_URL',
  'AWS_SECRET_ACCESS_KEY',
  'STRIPE_SECRET_KEY',
  'PLAUSIBLE_API_HOST',
  'PRODUCTION_DEPLOY_WEBHOOK_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const FORBIDDEN_SECRET_PATTERNS = [
  { name: 'PEM private key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Stripe secret key', regex: /\bsk_live_[A-Za-z0-9]{16,}/ },
  { name: 'GitHub PAT', regex: /\bghp_[A-Za-z0-9]{20,}/ },
  { name: 'Postgres connection URI with credentials', regex: /\bpostgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i },
  { name: 'Redis connection URI with credentials', regex: /\brediss?:\/\/:[^@\s]+@/i },
];

function walkFiles(dir, extFilter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, extFilter, out);
    } else if (!extFilter || extFilter.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function scanClientSourceForSecretEnvRefs() {
  const srcFiles = walkFiles(SRC_DIR, /\.(ts|tsx|js|jsx|mjs)$/);
  const violations = [];

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const isClientModule = content.includes("'use client'") || content.includes('"use client"');
    if (!isClientModule) continue;

    for (const secretName of FORBIDDEN_SECRET_IDENTIFIERS) {
      if (content.includes(secretName)) {
        violations.push(`${path.relative(WEBSITE_ROOT, file)}: references forbidden secret "${secretName}"`);
      }
    }

    const envAccessMatches = content.match(/process\.env\.([A-Z0-9_]+)/g) ?? [];
    for (const match of envAccessMatches) {
      const envKey = match.replace('process.env.', '');
      if (envKey !== 'NODE_ENV' && !envKey.startsWith('NEXT_PUBLIC_')) {
        violations.push(
          `${path.relative(WEBSITE_ROOT, file)}: client component accesses non-public env "${envKey}"`,
        );
      }
    }
  }

  return violations;
}

function scanBuiltClientChunksForSecrets() {
  if (!fs.existsSync(NEXT_STATIC_DIR)) {
    throw new Error(
      `Missing ${NEXT_STATIC_DIR}. Run "npm run build -w @hrm/website" before security:scan.`,
    );
  }

  const staticFiles = walkFiles(NEXT_STATIC_DIR, /\.(js|css|json|txt)$/);
  const violations = [];

  for (const file of staticFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const secretName of FORBIDDEN_SECRET_IDENTIFIERS) {
      if (content.includes(secretName)) {
        violations.push(`${path.relative(WEBSITE_ROOT, file)}: contains forbidden identifier "${secretName}"`);
      }
    }
    for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
      if (pattern.regex.test(content)) {
        violations.push(`${path.relative(WEBSITE_ROOT, file)}: matched ${pattern.name}`);
      }
    }
  }

  return { fileCount: staticFiles.length, violations };
}

function main() {
  const srcViolations = scanClientSourceForSecretEnvRefs();
  const { fileCount, violations: bundleViolations } = scanBuiltClientChunksForSecrets();
  const allViolations = [...srcViolations, ...bundleViolations];

  if (allViolations.length > 0) {
    console.error('[security:scan] Secret leakage violations found:');
    for (const v of allViolations) {
      console.error(`  ✗ ${v}`);
    }
    process.exit(1);
  }

  console.log(
    `[security:scan] Scanned ${fileCount} static client assets and client components: 0 secrets or private env leaks found.`,
  );
}

main();
