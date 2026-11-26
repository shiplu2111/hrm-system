import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  assertSystemPageMutationAllowed,
  assertValidCmsLocale,
  assertValidCmsSlug,
  resolveLocalizedPageVersion,
} from './cms.utils';
import { CMS_RESERVED_SLUGS } from './cms.constants';

describe('CMS Data Model Rules & Validators', () => {
  describe('Slug uniqueness & reserved route protection', () => {
    it('accepts valid lowercase URL-safe kebab-case slugs', () => {
      expect(assertValidCmsSlug('home')).toBe('home');
      expect(assertValidCmsSlug('payroll-compliance-2026')).toBe('payroll-compliance-2026');
      expect(assertValidCmsSlug('guide1')).toBe('guide1');
    });

    it('rejects every reserved platform slug regardless of casing', () => {
      for (const reserved of CMS_RESERVED_SLUGS) {
        expect(() => assertValidCmsSlug(reserved)).toThrow(BadRequestException);
        expect(() => assertValidCmsSlug(reserved.toUpperCase())).toThrow(BadRequestException);
      }
    });

    it('rejects uppercase, spaces, underscores, leading/trailing hyphens, and slashes', () => {
      for (const invalid of [
        '',
        '   ',
        'AboutUs',
        'about us',
        'about_us',
        '-about',
        'about-',
        'about--us',
        'features/payroll',
        '_next',
      ]) {
        expect(() => assertValidCmsSlug(invalid)).toThrow(BadRequestException);
      }
    });
  });

  describe('System page protection (cannot be deleted, renamed, or unpublished)', () => {
    const systemPage = { kind: 'system' as const, slug: 'pricing', locked: true };
    const customPage = { kind: 'custom' as const, slug: 'campaign-q4', locked: false };

    it('blocks deleting, trashing, renaming, unlocking, or unpublishing system pages', () => {
      expect(() =>
        assertSystemPageMutationAllowed(systemPage, { isDelete: true }),
      ).toThrow(ForbiddenException);
      expect(() =>
        assertSystemPageMutationAllowed(systemPage, { slug: 'plans' }),
      ).toThrow(ForbiddenException);
      expect(() =>
        assertSystemPageMutationAllowed(systemPage, { status: 'unpublished' }),
      ).toThrow(ForbiddenException);
      expect(() =>
        assertSystemPageMutationAllowed(systemPage, { status: 'trashed' }),
      ).toThrow(ForbiddenException);
      expect(() =>
        assertSystemPageMutationAllowed(systemPage, { deletedAt: new Date() }),
      ).toThrow(ForbiddenException);
      expect(() =>
        assertSystemPageMutationAllowed(systemPage, { locked: false }),
      ).toThrow(ForbiddenException);
      expect(() =>
        assertSystemPageMutationAllowed(systemPage, { kind: 'custom' }),
      ).toThrow(ForbiddenException);
    });

    it('allows publishing/scheduling updates on system pages when slug & lock remain unchanged', () => {
      expect(() =>
        assertSystemPageMutationAllowed(systemPage, { slug: 'pricing', status: 'published' }),
      ).not.toThrow();
    });

    it('allows delete, rename, and unpublish on unlocked custom pages', () => {
      expect(() =>
        assertSystemPageMutationAllowed(customPage, { isDelete: true, status: 'trashed' }),
      ).not.toThrow();
      expect(() =>
        assertSystemPageMutationAllowed(customPage, { slug: 'new-campaign', status: 'unpublished' }),
      ).not.toThrow();
    });
  });

  describe('Two locales (en & bn) resolution with English fallback & translated-status flag', () => {
    const page = {
      id: '00000000-0000-4000-8000-000000000111',
      kind: 'system' as const,
      slug: 'terms',
      status: 'published' as const,
      locked: true,
      currentPublishedVersionId: 'ver-en-1',
    };

    const versionsById = new Map([
      [
        'ver-en-1',
        {
          id: 'ver-en-1',
          pageId: page.id,
          versionNumber: 1,
          locale: 'en' as const,
          title: 'Terms of Service',
          seoTitle: 'Terms of Service | CMSN-HR',
          seoDescription: 'Legal terms',
          canonicalPath: '/terms',
          noIndex: false,
          blocks: [{ id: 'b1', type: 'rich_text', props: { html: '<p>Terms</p>' } }],
          isTranslated: true,
          createdAt: new Date('2026-11-26T00:00:00Z'),
        },
      ],
      [
        'ver-bn-1',
        {
          id: 'ver-bn-1',
          pageId: page.id,
          versionNumber: 1,
          locale: 'bn' as const,
          title: 'সেবার শর্তাবলি',
          seoTitle: 'সেবার শর্তাবলি | CMSN-HR',
          seoDescription: 'আইনি শর্তাবলি',
          canonicalPath: '/bn/terms',
          noIndex: false,
          blocks: [{ id: 'b1', type: 'rich_text', props: { html: '<p>শর্তাবলি</p>' } }],
          isTranslated: true,
          createdAt: new Date('2026-11-26T01:00:00Z'),
        },
      ],
    ]);

    it('rejects unsupported locales', () => {
      expect(() => assertValidCmsLocale('fr')).toThrow(BadRequestException);
    });

    it('falls back to English when bn is untranslated and reports isTranslated=false, fallbackUsed=true', () => {
      const resolved = resolveLocalizedPageVersion({
        page,
        locales: [
          {
            locale: 'en',
            isTranslated: true,
            translationStatus: 'translated',
            currentPublishedVersionId: 'ver-en-1',
          },
          {
            locale: 'bn',
            isTranslated: false,
            translationStatus: 'untranslated',
            currentPublishedVersionId: null,
          },
        ],
        versionsById,
        requestedLocale: 'bn',
      });

      expect(resolved).not.toBeNull();
      expect(resolved?.requestedLocale).toBe('bn');
      expect(resolved?.resolvedLocale).toBe('en');
      expect(resolved?.fallbackUsed).toBe(true);
      expect(resolved?.isTranslated).toBe(false);
      expect(resolved?.translationStatus).toBe('untranslated');
      expect(resolved?.version.title).toBe('Terms of Service');
    });

    it('returns the Bengali version when bn is translated and published', () => {
      const resolved = resolveLocalizedPageVersion({
        page,
        locales: [
          {
            locale: 'en',
            isTranslated: true,
            translationStatus: 'translated',
            currentPublishedVersionId: 'ver-en-1',
          },
          {
            locale: 'bn',
            isTranslated: true,
            translationStatus: 'translated',
            currentPublishedVersionId: 'ver-bn-1',
          },
        ],
        versionsById,
        requestedLocale: 'bn',
      });

      expect(resolved).not.toBeNull();
      expect(resolved?.requestedLocale).toBe('bn');
      expect(resolved?.resolvedLocale).toBe('bn');
      expect(resolved?.fallbackUsed).toBe(false);
      expect(resolved?.isTranslated).toBe(true);
      expect(resolved?.translationStatus).toBe('translated');
      expect(resolved?.version.title).toBe('সেবার শর্তাবলি');
    });
  });
});
