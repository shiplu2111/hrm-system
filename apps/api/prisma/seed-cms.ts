import { PrismaClient } from '@prisma/client';
import { CMS_SYSTEM_PAGE_DEFS } from '@hrm/shared-types';

/**
 * Seeds fixed platform-level CMS system pages, immutable v1 snapshots,
 * locale metadata (en + bn with fallback flags), menus, redirects,
 * blog taxonomy/authors, starter FAQs, and site settings.
 *
 * Strictly idempotent and safe against immutable `cms_page_versions`
 * and `cms_pages` system-lock triggers.
 */
export async function seedPlatformCms(client: PrismaClient): Promise<void> {
  const owner = await client.platformUser.findUnique({
    where: { email: 'platform.owner@cmsnbd.com' },
    select: { id: true, firstName: true, lastName: true },
  });
  const authorName = owner ? `${owner.firstName} ${owner.lastName}` : 'Platform Owner';

  const seededPageBySlug = new Map<string, string>();
  const now = new Date();

  const legalSlugs = new Set(['terms', 'privacy', 'cookies', 'dpa', 'subprocessors']);

  for (const def of CMS_SYSTEM_PAGE_DEFS) {
    const isLegal = legalSlugs.has(def.slug);
    let page = await client.cmsPage.findUnique({ where: { slug: def.slug } });
    if (!page) {
      page = await client.cmsPage.create({
        data: {
          kind: 'system',
          slug: def.slug,
          status: 'published',
          locked: true,
          requiresApproval: isLegal,
          publishedAt: now,
        },
      });
    } else if (isLegal && !page.requiresApproval) {
      page = await client.cmsPage.update({
        where: { id: page.id },
        data: { requiresApproval: true },
      });
    }
    seededPageBySlug.set(def.slug, page.id);

    // Immutable v1 English snapshot (create once only; never mutate)
    let enV1 = await client.cmsPageVersion.findUnique({
      where: {
        pageId_locale_versionNumber: {
          pageId: page.id,
          locale: 'en',
          versionNumber: 1,
        },
      },
    });
    if (!enV1) {
      enV1 = await client.cmsPageVersion.create({
        data: {
          pageId: page.id,
          versionNumber: 1,
          locale: 'en',
          title: def.titleEn,
          seoTitle: `${def.titleEn} | CMSN-HR`,
          seoDescription: `${def.titleEn} — Multi-tenant HR, Attendance & Payroll SaaS Platform.`,
          canonicalPath: def.canonicalPath,
          noIndex: def.slug === 'customers',
          blocks: [],
          isTranslated: true,
          authorId: owner?.id ?? null,
          authorName,
          changeNote: 'Initial seeded system page snapshot (en)',
        },
      });
    }

    // Immutable v1 Bengali snapshot when locale is translated
    let bnV1 = await client.cmsPageVersion.findUnique({
      where: {
        pageId_locale_versionNumber: {
          pageId: page.id,
          locale: 'bn',
          versionNumber: 1,
        },
      },
    });
    if (!bnV1 && def.bnTranslated) {
      bnV1 = await client.cmsPageVersion.create({
        data: {
          pageId: page.id,
          versionNumber: 1,
          locale: 'bn',
          title: def.titleBn,
          seoTitle: `${def.titleBn} | CMSN-HR`,
          seoDescription: `${def.titleBn} — মাল্টি-টেন্যান্ট এইচআর, উপস্থিতি ও পেরোল SaaS প্ল্যাটফর্ম।`,
          canonicalPath: def.canonicalPath === '/' ? '/bn' : `/bn${def.canonicalPath}`,
          noIndex: false,
          blocks: [],
          isTranslated: true,
          authorId: owner?.id ?? null,
          authorName,
          changeNote: 'Initial seeded system page snapshot (bn)',
        },
      });
    }

    await client.cmsPageLocale.upsert({
      where: { pageId_locale: { pageId: page.id, locale: 'en' } },
      create: {
        pageId: page.id,
        locale: 'en',
        isTranslated: true,
        translationStatus: 'translated',
        currentDraftVersionId: enV1.id,
        currentPublishedVersionId: enV1.id,
      },
      update: {},
    });

    await client.cmsPageLocale.upsert({
      where: { pageId_locale: { pageId: page.id, locale: 'bn' } },
      create: {
        pageId: page.id,
        locale: 'bn',
        isTranslated: def.bnTranslated,
        translationStatus: def.bnTranslated ? 'translated' : 'untranslated',
        currentDraftVersionId: bnV1?.id ?? null,
        currentPublishedVersionId: bnV1?.id ?? null,
      },
      update: {},
    });

    if (!page.currentPublishedVersionId) {
      await client.cmsPage.update({
        where: { id: page.id },
        data: { currentPublishedVersionId: enV1.id },
      });
    }
  }

  // Default header and footer menus
  const headerMenu = await client.cmsMenu.upsert({
    where: { slug: 'main-header' },
    create: { slug: 'main-header', name: 'Primary Header Navigation', location: 'header', isActive: true },
    update: { name: 'Primary Header Navigation', location: 'header', isActive: true },
  });

  const existingHeaderItems = await client.cmsMenuItem.count({ where: { menuId: headerMenu.id } });
  if (existingHeaderItems === 0) {
    await client.cmsMenuItem.createMany({
      data: [
        {
          menuId: headerMenu.id,
          labelEn: 'Features',
          labelBn: 'ফিচারসমূহ',
          targetPageId: seededPageBySlug.get('features') ?? null,
          href: '/features',
          sortOrder: 1,
        },
        {
          menuId: headerMenu.id,
          labelEn: 'Solutions',
          labelBn: 'সমাধান',
          targetPageId: seededPageBySlug.get('solutions') ?? null,
          href: '/solutions',
          sortOrder: 2,
        },
        {
          menuId: headerMenu.id,
          labelEn: 'Pricing',
          labelBn: 'মূল্য তালিকা',
          targetPageId: seededPageBySlug.get('pricing') ?? null,
          href: '/pricing',
          sortOrder: 3,
        },
        {
          menuId: headerMenu.id,
          labelEn: 'Help Center',
          labelBn: 'সহায়তা কেন্দ্র',
          targetPageId: seededPageBySlug.get('help') ?? null,
          href: '/help',
          sortOrder: 4,
        },
      ],
    });
  }

  // Default redirects matching website next.config.ts
  const starterRedirects = [
    { sourcePath: '/updates', destinationUrl: '/changelog' },
    { sourcePath: '/countries', destinationUrl: '/solutions/countries' },
    { sourcePath: '/help-center', destinationUrl: '/help' },
    { sourcePath: '/contact-sales', destinationUrl: '/contact?topic=sales' },
    { sourcePath: '/start-trial', destinationUrl: '/signup' },
    { sourcePath: '/book-demo', destinationUrl: '/demo' },
  ];
  for (const r of starterRedirects) {
    await client.cmsRedirect.upsert({
      where: { sourcePath: r.sourcePath },
      create: {
        sourcePath: r.sourcePath,
        destinationUrl: r.destinationUrl,
        redirectType: 'permanent_308',
        isActive: true,
        note: 'Default canonical marketing redirect',
        createdById: owner?.id ?? null,
      },
      update: {},
    });
  }

  // Default blog taxonomy & platform editorial author (0 posts seeded — blog stays hidden until published)
  await client.cmsPostCategory.upsert({
    where: { slug: 'payroll-compliance' },
    create: {
      slug: 'payroll-compliance',
      nameEn: 'Payroll & Statutory Compliance',
      nameBn: 'পেরোল ও বিধিবদ্ধ কমপ্লায়েন্স',
      sortOrder: 1,
    },
    update: {},
  });

  await client.cmsPostCategory.upsert({
    where: { slug: 'product-engineering' },
    create: {
      slug: 'product-engineering',
      nameEn: 'Product & Engineering',
      nameBn: 'প্রোডাক্ট ও ইঞ্জিনিয়ারিং',
      sortOrder: 2,
    },
    update: {},
  });

  await client.cmsAuthor.upsert({
    where: { slug: 'platform-team' },
    create: {
      slug: 'platform-team',
      displayName: authorName,
      displayNameBn: 'প্ল্যাটফর্ম টিম',
      roleTitle: 'Editorial & Compliance Team',
      roleTitleBn: 'সম্পাদনা ও কমপ্লায়েন্স দল',
      platformUserId: owner?.id ?? null,
      isActive: true,
    },
    update: {},
  });

  // Starter site settings (platform-level)
  const defaultSettings = [
    {
      key: 'locale.config',
      description: 'Supported CMS locales and fallback configuration',
      valueJson: { supportedLocales: ['en', 'bn'], defaultLocale: 'en', fallbackLocale: 'en' },
    },
    {
      key: 'seo.defaults',
      description: 'Default website SEO template and social attribution',
      valueJson: { titleTemplate: '%s | CMSN-HR', defaultRobotsIndex: false },
    },
  ];
  for (const s of defaultSettings) {
    await client.cmsSiteSetting.upsert({
      where: { key: s.key },
      create: {
        key: s.key,
        valueJson: s.valueJson,
        description: s.description,
        isPublic: true,
        updatedById: owner?.id ?? null,
        updatedByName: authorName,
      },
      update: {},
    });
  }

  const faqCount = await client.cmsFaq.count();
  if (faqCount === 0) {
    await client.cmsFaq.create({
      data: {
        category: 'pricing',
        pageSlug: 'pricing',
        questionEn: 'Do finalized payroll runs stay locked if tax rules change?',
        answerEn:
          'Yes. Payroll runs resolve rules active on the pay-period date and lock upon finalization. Future rule versions never mutate historical finalized payroll rows.',
        questionBn: 'বিধিবদ্ধ করের নিয়ম পরিবর্তন হলে পূর্বের অনুমোদিত পেরোল কি বদলে যায়?',
        answerBn:
          'না। পেরোল নির্দিষ্ট পে-পিরিয়ডের কার্যকর নিয়ম অনুযায়ী হিসাব হয় এবং চূড়ান্ত হওয়ার পর লক থাকে।',
        isBnTranslated: true,
        sortOrder: 1,
        isPublished: true,
      },
    });
  }
}
