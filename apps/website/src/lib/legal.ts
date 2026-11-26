import fs from 'node:fs';
import path from 'node:path';

export type LegalDocumentSlug = 'terms' | 'privacy' | 'cookies' | 'dpa';

export interface LegalDocument {
  slug: LegalDocumentSlug;
  title: string;
  version: string;
  effectiveDate: string;
  legalApproved: boolean;
  reviewedOn: string | null;
  draftNotice: string;
  summary: string;
  body: string;
}

const LEGAL_DIR = path.join(process.cwd(), 'src', 'content', 'legal');
const REQUIRED_SLUGS: readonly LegalDocumentSlug[] = ['terms', 'privacy', 'cookies'];

function stripQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseFrontmatter(source: string): { meta: Record<string, string>; body: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: source };
  }

  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const sepIndex = trimmed.indexOf(':');
    const eqIndex = trimmed.indexOf('=');
    const splitAt =
      sepIndex > 0 && (eqIndex < 0 || sepIndex < eqIndex) ? sepIndex : eqIndex;
    if (splitAt <= 0) continue;
    const key = trimmed.slice(0, splitAt).trim();
    const val = stripQuotes(trimmed.slice(splitAt + 1));
    meta[key] = val;
  }

  return { meta, body: match[2].trim() };
}

function isValidIsoDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isProductionLegalGateActive(): boolean {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV?.trim();
  if (appEnv === 'production') return true;
  if (appEnv === 'development' || appEnv === 'test') return false;
  return process.env.NODE_ENV === 'production';
}

export function validateLegalDocumentForProduction(doc: LegalDocument): string | null {
  if (!doc.legalApproved) {
    return `${doc.slug}.md is still marked draft (LEGAL_APPROVED=true required)`;
  }
  if (!isValidIsoDate(doc.reviewedOn)) {
    return `${doc.slug}.md is missing a valid reviewedOn date (YYYY-MM-DD required)`;
  }
  if (!doc.version.trim()) {
    return `${doc.slug}.md is missing version`;
  }
  if (!isValidIsoDate(doc.effectiveDate)) {
    return `${doc.slug}.md is missing a valid effectiveDate (YYYY-MM-DD required)`;
  }
  return null;
}

export function getLegalDocument(slug: LegalDocumentSlug): LegalDocument {
  const filePath = path.join(LEGAL_DIR, `${slug}.md`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { meta, body } = parseFrontmatter(raw);

  const doc: LegalDocument = {
    slug,
    title: meta.title || slug.toUpperCase(),
    version: meta.version || '2026-11',
    effectiveDate: meta.effectiveDate || '2026-11-25',
    legalApproved: meta.LEGAL_APPROVED?.toLowerCase() === 'true',
    reviewedOn: meta.reviewedOn?.trim() || null,
    draftNotice: meta.draftNotice || 'DRAFT, pending legal review',
    summary: meta.summary || '',
    body,
  };

  if (isProductionLegalGateActive()) {
    const err = validateLegalDocumentForProduction(doc);
    if (err) {
      throw new Error(`[LEGAL_GATE] Production build blocked: ${err}`);
    }
  }

  return doc;
}

export function getAllLegalDocuments(): LegalDocument[] {
  return REQUIRED_SLUGS.map((slug) => getLegalDocument(slug));
}
