export {
  CMS_LEGAL_PAGE_SLUGS,
  CMS_LOCALES,
  CMS_RESERVED_SLUGS,
  CMS_SYSTEM_PAGE_DEFS,
  CMS_SYSTEM_PAGE_SLUGS,
} from '@hrm/shared-types';

export const CMS_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CMS_RESERVED_SLUG_SET = new Set<string>([
  'admin',
  'api',
  'app',
  'platform',
  'login',
  'signup',
  'public',
  '_next',
]);

export const CMS_LEGAL_PAGE_SLUG_SET = new Set<string>([
  'terms',
  'privacy',
  'cookies',
  'dpa',
  'subprocessors',
]);
