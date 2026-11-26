import {
  buildWebsiteCmsImportPlan,
  executeWebsiteCmsImport,
  markdownToSanitizedHtml,
  type WebsiteImportSourceBundle,
} from './cms-website-importer.service';

function makeSampleBundle(): WebsiteImportSourceBundle {
  const en = {
    meta: {
      defaultTitle: 'CMSN-HR En Title',
      description: 'En description',
      notFoundTitle: 'Not Found 404',
      notFoundDescription: 'Page missing',
    },
    home: {
      hero: {
        title: 'Run country-compliant payroll',
        subtitle: 'Hero subtitle',
        primaryCta: 'Start free trial',
        secondaryCta: 'Book a demo',
      },
      differentiators: {
        title: 'Four Pillars',
        subtitle: 'Built in',
        countryCore: { title: 'Country Rules', description: 'Tax & leave', badge: '01' },
        offlineAttendance: { title: 'Offline Mobile', description: 'UUID sync', badge: '02' },
        payrollEngine: { title: 'Dynamic Payroll', description: 'Simulations', badge: '03' },
        auditTrail: { title: 'Audit Trail', description: 'Locked runs', badge: '04' },
      },
      modules: {
        title: 'Modules',
        subtitle: 'Live vs Phase 2',
        groups: [{ id: 'hris', title: 'Core HRIS', description: 'Profiles', badge: 'Live', refs: '§03' }],
      },
      howItWorks: {
        title: 'How It Works',
        subtitle: '3 Steps',
        steps: [{ number: '01', title: 'Configure', description: 'Select country', refs: '§02' }],
      },
      telemetry: { title: 'Telemetry', subtitle: 'Health check' },
      faq: {
        title: 'Home FAQ',
        subtitle: 'Answers',
        items: [{ id: 'q1', question: 'How does rule resolver work?', answer: 'Hierarchy order.' }],
      },
      cta: {
        title: 'Ready?',
        description: 'Try it',
        primaryButton: 'Start free trial',
        secondaryButton: 'Book a demo',
      },
    },
    features: {
      overview: {
        metaTitle: 'Features',
        metaDescription: 'Features desc',
        title: 'Every Module Built Around Compliance',
        subtitle: 'Start with core HR, attendance, leave, and payroll.',
        liveGroupHeading: 'Live',
        liveGroupSubtitle: 'Phase 1',
        upcomingGroupHeading: 'Upcoming',
        upcomingGroupSubtitle: 'Phase 2',
        cta: {
          title: 'Try features',
          description: 'Desc',
          primaryLabel: 'Start',
          secondaryLabel: 'Demo',
        },
      },
      pages: {
        payroll: {
          slug: 'payroll',
          title: 'Payroll',
          headline: 'Deterministic Payroll',
          summary: 'Summary',
          phaseStatus: 'live',
          phaseBadge: 'Live',
          moduleRefs: '§18',
          whoItIsFor: { heading: 'For finance', audience: 'Teams', outcomes: ['Accurate net pay'] },
          blocks: [{ id: 'b1', title: 'Tax Engine', description: 'Tax brackets', phaseLabel: 'Live', bullets: ['Slabs'] }],
          cta: { title: 'CTA', description: 'Desc', primaryLabel: 'Start', secondaryLabel: 'Demo' },
        },
      },
    },
    solutions: {
      overview: {
        metaTitle: 'Solutions',
        metaDescription: 'Desc',
        title: 'Solutions Title',
        subtitle: 'Sub',
        sizeHeading: 'By Size',
        sizeSubtitle: 'Sub',
        workforceHeading: 'By Workforce',
        workforceSubtitle: 'Sub',
        countryBannerTitle: 'Countries',
        countryBannerDesc: 'Explore',
        countryBannerCta: 'View Countries',
      },
      segments: {
        'small-business': {
          slug: 'small-business',
          category: 'company_size',
          categoryLabel: 'Size',
          title: 'Small Business',
          eyebrow: 'SB',
          headline: 'Replace Spreadsheets',
          summary: 'Summary',
          whoItIsFor: { heading: 'Owners', description: 'Lean teams', highlights: ['Fast setup'] },
          capabilities: [{ id: 'c1', title: 'CSV Import', description: 'Bulk import', bullets: ['Validated'], moduleRefs: '§37' }],
          cta: { title: 'CTA', description: 'Desc', primaryLabel: 'Start', secondaryLabel: 'Demo' },
        },
      },
    },
    countries: {
      index: {
        metaTitle: 'Countries',
        metaDescription: 'Countries desc',
        eyebrow: 'Global',
        title: 'Supported Countries',
        subtitle: 'Live list',
        selectorLabel: 'Pick country',
      },
    },
    pricing: {
      metaTitle: 'Pricing',
      metaDescription: 'Pricing desc',
      eyebrow: 'Transparent',
      title: 'Predictable Pricing',
      subtitle: 'Choose currency',
      controls: { annualBadge: 'Annual available' },
      calculator: { title: 'Estimator', subtitle: 'Estimate seats', disclaimer: 'Estimate only' },
      matrix: { title: 'Compare plans', subtitle: 'Features' },
      faq: {
        title: 'Pricing FAQ',
        subtitle: 'Billing answers',
        items: [{ id: 'pq1', question: 'Do you require a card?', answer: 'No card needed for trial.' }],
      },
      cta: { heading: 'Start', body: 'Body', primaryCta: 'Trial', secondaryCta: 'Sales' },
    },
    security: {
      metaTitle: 'Security',
      metaDescription: 'Sec desc',
      title: 'Security & Trust',
      subtitle: 'Implemented controls',
      lastReviewedLabel: 'Reviewed:',
      lastReviewedDate: '2026-11-25',
      noFakeBadgesNote: 'No fake badges.',
      howItWorks: {
        title: 'Architecture',
        subtitle: 'Sub',
        steps: [{ step: '01', title: 'JWT', description: 'Scoped' }],
      },
      controlsSection: {
        title: 'Controls',
        subtitle: '8 controls',
        controls: [{ id: 'iso', title: 'Isolation', summary: 'Scoped', details: ['By tenant_id'] }],
      },
      supportFlow: {
        title: 'Support Consent',
        subtitle: 'Sub',
        steps: [{ label: '1. Request', detail: 'Owner approves' }],
      },
      cta: { title: 'Trust CTA', description: 'Desc', primaryCta: 'Start', secondaryCta: 'Demo' },
    },
    company: {
      about: {
        metaTitle: 'About',
        metaDescription: 'About desc',
        title: 'About Us',
        subtitle: 'Mission',
        mission: { title: 'Mission', description: 'Desc', highlights: [{ label: 'Core', value: 'Multi-tenant' }] },
        story: { title: 'Story', paragraphs: ['Paragraph one.'] },
        principles: { title: 'Principles', description: 'Desc', items: [{ id: 'p1', title: 'Config', description: 'No hardcoding' }] },
        team: {
          title: 'Team',
          placeholderNotice: 'Pending verification',
          rolePendingBadge: '[PENDING]',
          slots: [{ id: 's1', name: '[NAME PENDING]', role: '[ROLE PENDING]', bio: '[BIO PENDING]' }],
        },
        cta: { heading: 'About CTA', body: 'Body', primaryCta: 'Start', secondaryCta: 'Demo' },
      },
      careers: {
        metaTitle: 'Careers',
        metaDescription: 'Careers desc',
        title: 'Build reliable HR software',
        subtitle: 'Sub',
        openings: {
          title: 'Current openings',
          description: 'Loaded from feed',
          empty: { title: 'No open roles', body: 'Reach out anytime.' },
        },
        culture: { title: 'Culture', description: 'Desc', items: [{ id: 'c1', title: 'Tests', description: 'Deterministic' }] },
        cta: { heading: 'Careers CTA', body: 'Body', primaryCta: 'Trial', secondaryCta: 'Contact' },
      },
    },
    leads: {
      contact: {
        metaTitle: 'Contact',
        metaDescription: 'Contact desc',
        title: 'How can we help?',
        subtitle: 'Choose a topic',
        topicHeading: 'Topics',
        topics: [{ id: 'sales', label: 'Talk to Sales', shortDescription: 'Enterprise' }],
        forms: { salesHeading: 'Sales Form', salesSubtitle: 'Sub' },
        supportGuidance: { title: 'Support', body: 'Use portal', reasons: ['Help Center'] },
        confirmation: { salesTitle: 'Received', body: 'Thank you' },
      },
      demo: {
        metaTitle: 'Book Demo',
        metaDescription: 'Demo desc',
        title: 'Guided Demo',
        subtitle: 'See payroll rules',
        highlights: ['Rule resolver'],
        form: { heading: 'Request demo' },
        thankYou: {
          title: 'Thank you',
          bodyDefault: 'Received request',
          schedulerHeading: 'Scheduler',
          schedulerPendingNotice: 'Coming soon',
          viewPricingCta: 'Pricing',
          exploreFeaturesCta: 'Features',
        },
      },
    },
    help: {
      metaTitle: 'Help Center',
      metaDescription: 'Help desc',
      title: 'How can we help?',
      subtitle: 'Search guides',
      categoriesHeading: 'Topics',
      categoriesSubtitle: 'Organized',
      popularHeading: 'Popular',
      popularSubtitle: 'Top guides',
      articlePage: {
        existingCustomerTitle: 'Workspace help',
        existingCustomerBody: 'Sign in for support',
        logInCta: 'Log in',
        existingCustomerCta: 'Support options',
      },
    },
    errors: {
      notFound: {
        title: 'Page Not Found',
        description: 'Missing route',
        primaryCta: 'Back home',
        helpfulHeading: 'Helpful links',
        links: { home: 'Home', telemetry: 'Status', login: 'Log in' },
      },
    },
    integrations: { meta: { title: 'Integrations', description: 'Int desc' }, hero: { title: 'Integrations', subtitle: 'Live drivers' } },
    changelog: { metaTitle: 'Changelog', metaDescription: 'Changelog desc', title: 'Updates', subtitle: 'Releases', shippedNote: 'Shipped only' },
    status: { meta: { title: 'Status', description: 'Status desc' }, hero: { title: 'System Status', subtitle: 'Uptime' }, components: { subtitle: '90 days' } },
    blog: { metaTitle: 'Blog', metaDescription: 'Blog desc', title: 'Blog', subtitle: 'Engineering', emptyTitle: 'No posts yet' },
    customers: { index: { metaTitle: 'Customers', metaDescription: 'Cust desc', title: 'Customer Stories', empty: { title: 'None yet' } } },
    legal: {
      badges: { draftBannerTitle: 'DRAFT, pending legal review' },
      subprocessors: {
        title: 'Subprocessors',
        subtitle: 'Active providers',
        tableTitle: 'Active list',
        unconfiguredTitle: 'Unconfigured',
        subscribeDescription: 'Subscribe',
      },
    },
  };

  const bn = JSON.parse(JSON.stringify(en));
  bn.meta.defaultTitle = 'CMSN-HR বাংলা শিরোনাম';
  bn.home.hero.title = 'দেশভিত্তিক পেরোল চালান';
  bn.home.faq.items[0] = { id: 'q1', question: 'রুলে কীভাবে কাজ করে?', answer: 'স্তরক্রমে।' };
  bn.pricing.metaTitle = 'মূল্য তালিকা';
  bn.pricing.faq.items[0] = { id: 'pq1', question: 'কার্ড লাগে কি?', answer: 'না।' };
  bn.errors.notFound.title = 'পৃষ্ঠাটি পাওয়া যায়নি';

  return {
    en,
    bn,
    rawBn: {
      home: bn.home,
      pricing: bn.pricing,
      features: { pages: { payroll: bn.features.pages.payroll } },
      solutions: { segments: { 'small-business': bn.solutions.segments['small-business'] } },
      security: bn.security,
      company: bn.company,
      errors: bn.errors,
    },
    legalDocs: [
      {
        slug: 'terms',
        title: 'Terms of Service',
        version: '2026-11',
        effectiveDate: '2026-11-25',
        legalApproved: false,
        reviewedOn: null,
        draftNotice: 'DRAFT, pending legal review',
        summary: 'Draft terms',
        bodyMarkdown: '## Scope\n\n- Clause 1\n\n<script>alert(1)</script>',
      },
      {
        slug: 'privacy',
        title: 'Privacy Policy',
        version: '2026-11',
        effectiveDate: '2026-11-25',
        legalApproved: false,
        reviewedOn: null,
        draftNotice: 'DRAFT, pending legal review',
        summary: 'Draft privacy',
        bodyMarkdown: '## Privacy\n\nMinimal collection.',
      },
    ],
    careers: [],
  };
}

describe('Website -> CMS Importer', () => {
  function makeMockPrisma() {
    const pages = new Map<string, any>();
    const locales: any[] = [];
    const versions: any[] = [];
    const faqs: any[] = [];
    const careers: any[] = [];
    const auditLogs: any[] = [];
    let seq = 1;
    const id = () => `00000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`;

    const db: any = {
      cmsPage: {
        findMany: jest.fn(async () =>
          Array.from(pages.values()).map((p) => ({
            ...p,
            locales: locales.filter((l) => l.pageId === p.id),
            versions: versions.filter((v) => v.pageId === p.id).sort((a, b) => b.versionNumber - a.versionNumber),
          })),
        ),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: id(), deletedAt: null, createdAt: new Date(), updatedAt: new Date(), ...data };
          pages.set(row.id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = { ...pages.get(where.id), ...data, updatedAt: new Date() };
          pages.set(where.id, row);
          return row;
        }),
      },
      cmsPageVersion: {
        findFirst: jest.fn(async ({ where }: any) => {
          const m = versions
            .filter((v) => v.pageId === where.pageId && v.locale === where.locale)
            .sort((a, b) => b.versionNumber - a.versionNumber);
          return m[0] ?? null;
        }),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: id(), createdAt: new Date(), ...data };
          versions.push(row);
          return row;
        }),
      },
      cmsPageLocale: {
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const idx = locales.findIndex(
            (l) => l.pageId === where.pageId_locale.pageId && l.locale === where.pageId_locale.locale,
          );
          if (idx >= 0) {
            locales[idx] = { ...locales[idx], ...update };
            return locales[idx];
          }
          const created = { id: id(), ...create };
          locales.push(created);
          return created;
        }),
      },
      cmsFaq: {
        findMany: jest.fn(async () => [...faqs]),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: id(), ...data };
          faqs.push(row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const idx = faqs.findIndex((f) => f.id === where.id);
          faqs[idx] = { ...faqs[idx], ...data };
          return faqs[idx];
        }),
      },
      cmsCareer: {
        findMany: jest.fn(async () => [...careers]),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: id(), ...data };
          careers.push(row);
          return row;
        }),
      },
      platformAuditLog: {
        create: jest.fn(async ({ data }: any) => {
          auditLogs.push(data);
          return data;
        }),
      },
      $transaction: async (fn: (tx: any) => Promise<any>) => fn(db),
    };

    return { db, pages, locales, versions, faqs, auditLogs };
  }

  it('sanitizes markdown HTML, excludes hardcoded pricing numbers, and marks legal pages pending_approval', () => {
    const plan = buildWebsiteCmsImportPlan(makeSampleBundle());

    const pricing = plan.pages.find((p) => p.slug === 'pricing')!;
    expect(pricing.targetPageStatus).toBe('published');
    expect(
      pricing.locales[0].blocks.some(
        (b) => b.type === 'dynamic_block' && b.props.widget === 'pricing_table',
      ),
    ).toBe(true);

    const terms = plan.pages.find((p) => p.slug === 'terms')!;
    expect(terms.isLegal).toBe(true);
    expect(terms.targetPageStatus).toBe('draft');
    expect(terms.requiresApproval).toBe(true);
    expect(terms.targetApprovalStatus).toBe('pending_approval');
    expect(terms.targetPublished).toBe(false);
    expect(terms.locales[0].noIndex).toBe(true);
    // XSS payload stripped during markdown conversion
    const bodyHtml = (terms.locales[0].blocks[1] as any).props.html;
    expect(bodyHtml).not.toContain('<script>');
    const imgEscaped = markdownToSanitizedHtml('Hello <img src=x onerror=alert(1)>');
    expect(imgEscaped).not.toContain('<img');
    expect(imgEscaped).toContain('&lt;img');
  });

  it('dry-run performs zero writes, apply persists once, and repeat apply is 100% idempotent', async () => {
    const plan = buildWebsiteCmsImportPlan(makeSampleBundle());
    const { db, pages, versions, faqs, auditLogs } = makeMockPrisma();

    // 1. Dry-run reports creations without touching DB
    const dryReport = await executeWebsiteCmsImport(db, plan, { mode: 'dry-run' });
    expect(dryReport.mode).toBe('dry-run');
    expect(dryReport.summary.pagesCreated).toBe(plan.pages.length);
    expect(dryReport.summary.versionsCreated).toBeGreaterThan(0);
    expect(dryReport.summary.legalDraftsMarkedPendingReview).toBe(3); // terms, privacy, subprocessors
    expect(pages.size).toBe(0);
    expect(versions.length).toBe(0);
    expect(faqs.length).toBe(0);

    // 2. First apply imports system pages, legal drafts (not approved/published), and FAQs
    const apply1 = await executeWebsiteCmsImport(db, plan, {
      mode: 'apply',
      actorId: 'owner-1',
      actorEmail: 'platform.owner@cmsnbd.com',
    });
    expect(apply1.summary.pagesCreated).toBe(plan.pages.length);
    expect(pages.size).toBe(plan.pages.length);
    expect(faqs.length).toBe(2);
    expect(auditLogs.length).toBe(plan.pages.length);

    const termsRow = Array.from(pages.values()).find((p) => p.slug === 'terms');
    expect(termsRow.status).toBe('draft');
    expect(termsRow.requiresApproval).toBe(true);
    expect(termsRow.approvalStatus).toBe('pending_approval');
    expect(termsRow.currentPublishedVersionId).toBeNull();
    expect(termsRow.approvedById).toBeNull();

    const homeRow = Array.from(pages.values()).find((p) => p.slug === 'home');
    expect(homeRow.status).toBe('published');
    expect(homeRow.currentPublishedVersionId).toBeTruthy();

    // 3. Second run (repeatability): creates 0 pages, 0 versions, 0 FAQs
    const countAfterFirst = versions.length;
    const apply2 = await executeWebsiteCmsImport(db, plan, {
      mode: 'apply',
      actorId: 'owner-1',
      actorEmail: 'platform.owner@cmsnbd.com',
    });
    expect(apply2.summary.pagesCreated).toBe(0);
    expect(apply2.summary.versionsCreated).toBe(0);
    expect(apply2.summary.versionsSkippedUnchanged).toBeGreaterThan(0);
    expect(apply2.summary.faqsCreatedOrUpdated).toBe(0);
    expect(apply2.summary.faqsSkippedUnchanged).toBe(2);
    expect(versions.length).toBe(countAfterFirst);
  });
});
