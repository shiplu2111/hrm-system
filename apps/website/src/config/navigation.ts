import type { DictionaryKey, WebsiteDictionary } from '../i18n';

export type NavKey = DictionaryKey<WebsiteDictionary>;

export interface MegaMenuItem {
  titleKey: NavKey;
  descriptionKey: NavKey;
  href: string;
  badgeKey?: NavKey;
}

export interface MegaMenuGroup {
  headingKey: NavKey;
  items: MegaMenuItem[];
}

export interface FooterLinkItem {
  labelKey: NavKey;
  href: string;
  external?: boolean;
  requiresBlogPosts?: boolean;
}

export interface FooterColumn {
  id: string;
  headingKey: NavKey;
  links: FooterLinkItem[];
}

export const PRODUCT_MEGA_MENU: MegaMenuGroup[] = [
  {
    headingKey: 'nav.productMenu.overviewTitle',
    items: [
      {
        titleKey: 'nav.productMenu.overviewItems.featuresOverview.title',
        descriptionKey: 'nav.productMenu.overviewItems.featuresOverview.description',
        href: '/features',
      },
      {
        titleKey: 'nav.productMenu.overviewItems.payroll.title',
        descriptionKey: 'nav.productMenu.overviewItems.payroll.description',
        href: '/features/payroll',
      },
      {
        titleKey: 'nav.productMenu.overviewItems.attendance.title',
        descriptionKey: 'nav.productMenu.overviewItems.attendance.description',
        href: '/features/attendance',
      },
      {
        titleKey: 'nav.productMenu.overviewItems.leave.title',
        descriptionKey: 'nav.productMenu.overviewItems.leave.description',
        href: '/features/leave',
      },
    ],
  },
  {
    headingKey: 'nav.productMenu.platformTitle',
    items: [
      {
        titleKey: 'nav.productMenu.platformItems.selfService.title',
        descriptionKey: 'nav.productMenu.platformItems.selfService.description',
        href: '/features/self-service',
      },
      {
        titleKey: 'nav.productMenu.platformItems.reports.title',
        descriptionKey: 'nav.productMenu.platformItems.reports.description',
        href: '/features/reports',
      },
      {
        titleKey: 'nav.productMenu.platformItems.recruitment.title',
        descriptionKey: 'nav.productMenu.platformItems.recruitment.description',
        href: '/features/recruitment',
        badgeKey: 'nav.productMenu.platformItems.recruitment.badge',
      },
      {
        titleKey: 'nav.productMenu.platformItems.workflows.title',
        descriptionKey: 'nav.productMenu.platformItems.workflows.description',
        href: '/features/workflows',
        badgeKey: 'nav.productMenu.platformItems.workflows.badge',
      },
    ],
  },
];

export const SOLUTIONS_MEGA_MENU: MegaMenuGroup[] = [
  {
    headingKey: 'nav.solutionsMenu.countriesTitle',
    items: [
      {
        titleKey: 'nav.solutionsMenu.countriesItems.allCountries.title',
        descriptionKey: 'nav.solutionsMenu.countriesItems.allCountries.description',
        href: '/solutions/countries',
      },
      {
        titleKey: 'nav.solutionsMenu.countriesItems.complianceFramework.title',
        descriptionKey: 'nav.solutionsMenu.countriesItems.complianceFramework.description',
        href: '/help?category=country-compliance',
      },
    ],
  },
  {
    headingKey: 'nav.solutionsMenu.teamsTitle',
    items: [
      {
        titleKey: 'nav.solutionsMenu.teamsItems.smallBusiness.title',
        descriptionKey: 'nav.solutionsMenu.teamsItems.smallBusiness.description',
        href: '/solutions/small-business',
      },
      {
        titleKey: 'nav.solutionsMenu.teamsItems.growingTeams.title',
        descriptionKey: 'nav.solutionsMenu.teamsItems.growingTeams.description',
        href: '/solutions/growing-teams',
      },
      {
        titleKey: 'nav.solutionsMenu.teamsItems.multiBranch.title',
        descriptionKey: 'nav.solutionsMenu.teamsItems.multiBranch.description',
        href: '/solutions/multi-branch',
      },
      {
        titleKey: 'nav.solutionsMenu.teamsItems.shiftBased.title',
        descriptionKey: 'nav.solutionsMenu.teamsItems.shiftBased.description',
        href: '/solutions/shift-based',
      },
      {
        titleKey: 'nav.solutionsMenu.teamsItems.fieldWorkforce.title',
        descriptionKey: 'nav.solutionsMenu.teamsItems.fieldWorkforce.description',
        href: '/solutions/field-workforce',
      },
      {
        titleKey: 'nav.solutionsMenu.teamsItems.security.title',
        descriptionKey: 'nav.solutionsMenu.teamsItems.security.description',
        href: '/security',
      },
    ],
  },
];

export const PRIMARY_DIRECT_LINKS: FooterLinkItem[] = [
  { labelKey: 'nav.pricing', href: '/pricing' },
  { labelKey: 'nav.resources', href: '/help' },
  { labelKey: 'nav.company', href: '/about' },
];

export function buildFooterColumns(
  portalUrl: string,
  platformUrl: string,
  options: { hasBlogPosts?: boolean } = {},
): FooterColumn[] {
  const columns: FooterColumn[] = [
    {
      id: 'product',
      headingKey: 'footer.columns.product.heading',
      links: [
        { labelKey: 'footer.columns.product.links.overview', href: '/features' },
        { labelKey: 'footer.columns.product.links.payroll', href: '/features/payroll' },
        { labelKey: 'footer.columns.product.links.attendance', href: '/features/attendance' },
        { labelKey: 'footer.columns.product.links.leave', href: '/features/leave' },
        { labelKey: 'footer.columns.product.links.selfService', href: '/features/self-service' },
        { labelKey: 'footer.columns.product.links.pricing', href: '/pricing' },
      ],
    },
    {
      id: 'solutions',
      headingKey: 'footer.columns.solutions.heading',
      links: [
        { labelKey: 'footer.columns.solutions.links.countries', href: '/solutions/countries' },
        { labelKey: 'footer.columns.solutions.links.growingTeams', href: '/solutions/growing-teams' },
        { labelKey: 'footer.columns.solutions.links.fieldWorkforce', href: '/solutions/field-workforce' },
        { labelKey: 'footer.columns.solutions.links.security', href: '/security' },
        { labelKey: 'footer.columns.solutions.links.howItWorks', href: '/security#how-it-works' },
      ],
    },
    {
      id: 'resources',
      headingKey: 'footer.columns.resources.heading',
      links: [
        { labelKey: 'footer.columns.resources.links.helpCenter', href: '/help' },
        { labelKey: 'footer.columns.resources.links.blog', href: '/blog', requiresBlogPosts: true },
        { labelKey: 'footer.columns.resources.links.changelog', href: '/changelog' },
        { labelKey: 'footer.columns.resources.links.systemStatus', href: '/status' },
        { labelKey: 'footer.columns.resources.links.integrations', href: '/integrations' },
        { labelKey: 'footer.columns.resources.links.designSystem', href: '/components' },
        { labelKey: 'footer.columns.resources.links.bookDemo', href: '/demo' },
      ],
    },
    {
      id: 'company',
      headingKey: 'footer.columns.company.heading',
      links: [
        { labelKey: 'footer.columns.company.links.about', href: '/about' },
        { labelKey: 'footer.columns.company.links.careers', href: '/careers' },
        { labelKey: 'footer.columns.company.links.contact', href: '/contact' },
        { labelKey: 'footer.columns.company.links.clientPortal', href: `${portalUrl}/login`, external: true },
        { labelKey: 'footer.columns.company.links.superAdmin', href: platformUrl, external: true },
      ],
    },
  ];

  return columns.map((col) => ({
    ...col,
    links: col.links.filter((link) => !link.requiresBlogPosts || Boolean(options.hasBlogPosts)),
  }));
}

export const LEGAL_LINKS: FooterLinkItem[] = [
  { labelKey: 'footer.legal.terms', href: '/terms' },
  { labelKey: 'footer.legal.privacy', href: '/privacy' },
  { labelKey: 'footer.legal.cookies', href: '/cookies' },
  { labelKey: 'footer.legal.dpa', href: '/dpa' },
  { labelKey: 'footer.legal.subprocessors', href: '/subprocessors' },
  { labelKey: 'footer.legal.security', href: '/security' },
];
