import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { getDictionary } from '../../website/src/i18n';
import { bn as rawBn } from '../../website/src/i18n/dictionaries/bn';
import { CAREER_OPENINGS } from '../../website/src/data/careers';
import {
  buildWebsiteCmsImportPlan,
  executeWebsiteCmsImport,
  type WebsiteImportLegalDocSource,
} from '../src/platform/cms/cms-website-importer.service';

const LEGAL_SLUGS = ['terms', 'privacy', 'cookies', 'dpa'] as const;

function stripQuotes(raw: string): string {
  const t = raw.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function loadLegalDocsFromWebsite(): WebsiteImportLegalDocSource[] {
  const legalDir = path.resolve(__dirname, '../../website/src/content/legal');
  return LEGAL_SLUGS.map((slug) => {
    const raw = fs.readFileSync(path.join(legalDir, `${slug}.md`), 'utf-8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    const meta: Record<string, string> = {};
    let bodyMarkdown = raw;

    if (match) {
      bodyMarkdown = match[2].trim();
      for (const line of match[1].split(/\r\n|\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx <= 0) continue;
        const k = trimmed.slice(0, colonIdx).trim();
        const v = stripQuotes(trimmed.slice(colonIdx + 1));
        meta[k] = v;
      }
    }

    return {
      slug,
      title: meta.title || slug.toUpperCase(),
      version: meta.version || '2026-11',
      effectiveDate: meta.effectiveDate || '2026-11-25',
      // Force false unless legal review is completed inside CMS Stage F
      legalApproved: meta.LEGAL_APPROVED?.toLowerCase() === 'true',
      reviewedOn: meta.reviewedOn || null,
      draftNotice: meta.draftNotice || 'DRAFT, pending legal review',
      summary: meta.summary || '',
      bodyMarkdown,
    };
  });
}

function printReport(report: Awaited<ReturnType<typeof executeWebsiteCmsImport>>): void {
  const header =
    report.mode === 'dry-run'
      ? '=== CMS WEBSITE IMPORT DRY-RUN (No database writes executed) ==='
      : '=== CMS WEBSITE IMPORT APPLIED ===';
  console.log(`\n${header}\n`);
  console.log('Summary:');
  console.log(`  Pages evaluated                  : ${report.summary.pagesTotal}`);
  console.log(`  New system pages to create/created: ${report.summary.pagesCreated}`);
  console.log(`  Locale versions to create/created : ${report.summary.versionsCreated}`);
  console.log(`  Locale versions skipped (same hash): ${report.summary.versionsSkippedUnchanged}`);
  console.log(`  Legal drafts marked pending review: ${report.summary.legalDraftsMarkedPendingReview}`);
  console.log(`  FAQs to create or update          : ${report.summary.faqsCreatedOrUpdated}`);
  console.log(`  FAQs skipped (unchanged)          : ${report.summary.faqsSkippedUnchanged}`);
  console.log(`  Careers imported / skipped        : ${report.summary.careersImported} / ${report.summary.careersSkipped}`);

  console.log('\nPages Plan:');
  for (const p of report.pages) {
    const locSummary =
      p.localesToImport.length > 0
        ? p.localesToImport
            .map(
              (l) =>
                `${l.locale}(blocks=${l.blocksCount}, ${l.translationStatus}, pub=${l.publishImmediately})`,
            )
            .join(', ')
        : 'none (all locales up-to-date)';
    const legalTag = p.isLegal ? ` [LEGAL approval=${p.targetApprovalStatus}]` : '';
    console.log(
      `  - ${p.slug.padEnd(26)} action=${p.action.padEnd(22)} status=${p.targetPageStatus}${legalTag} -> ${locSummary}`,
    );
  }

  console.log('\nFAQs Plan:');
  for (const f of report.faqs) {
    console.log(`  - [${f.action.toUpperCase()}] (${f.pageSlug}) ${f.questionEn}`);
  }
  console.log('');
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const mode: 'dry-run' | 'apply' = args.has('--apply') ? 'apply' : 'dry-run';

  const prisma = new PrismaClient();
  try {
    const owner = await prisma.platformUser.findUnique({
      where: { email: 'platform.owner@cmsnbd.com' },
      select: { id: true, email: true },
    });

    const plan = buildWebsiteCmsImportPlan({
      en: getDictionary('en'),
      bn: getDictionary('bn'),
      rawBn: rawBn as Record<string, unknown>,
      legalDocs: loadLegalDocsFromWebsite(),
      careers: CAREER_OPENINGS.map((c) => ({
        slug: c.slug,
        department: c.department,
        workMode: c.workMode,
        location: c.location,
        employmentType: c.employmentType,
        title: c.title,
        summary: c.summary,
        postedAt: c.postedAt,
      })),
    });

    const report = await executeWebsiteCmsImport(prisma, plan, {
      mode,
      actorId: owner?.id ?? null,
      actorEmail: owner?.email ?? 'website-import',
    });

    printReport(report);

    if (mode === 'dry-run') {
      console.log('Dry-run complete. Re-run with `--apply` to persist changes into Postgres.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('CMS website import failed:', err);
  process.exit(1);
});
