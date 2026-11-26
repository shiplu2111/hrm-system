/**
 * Customers & Case Studies Data Module (Phase 2)
 *
 * Ground Rule: Keep `CASE_STUDIES` empty until at least one real,
 * customer-approved case study with verified outcomes exists.
 * While `getApprovedCaseStudies()` returns an empty list:
 * - `/customers` and `/customers/[slug]` emit `noindex, nofollow`
 * - Neither route is linked in site navigation or included in `sitemap.xml`
 */

export type CaseStudyStatus = 'draft' | 'approved';

export interface CaseStudyMetric {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
}

export interface CaseStudySection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

export interface CaseStudyQuote {
  readonly text: string;
  readonly attributionName: string;
  readonly attributionRole: string;
  readonly approved: boolean;
}

export interface CaseStudyArticle {
  readonly id: string;
  readonly slug: string;
  readonly status: CaseStudyStatus;
  readonly companyName: string;
  readonly industry: string;
  readonly companySize: string;
  readonly country: string;
  readonly headline: string;
  readonly summary: string;
  readonly publishedAt: string;
  readonly readTimeMinutes: number;
  readonly modulesUsed: readonly string[];
  readonly highlights: readonly CaseStudyMetric[];
  readonly challenge: CaseStudySection;
  readonly solution: CaseStudySection;
  readonly results: CaseStudySection & {
    readonly outcomes: readonly string[];
  };
  readonly quote?: CaseStudyQuote;
}

export const CASE_STUDIES: readonly CaseStudyArticle[] = [];

export function getApprovedCaseStudies(): readonly CaseStudyArticle[] {
  return CASE_STUDIES.filter((study) => study.status === 'approved');
}

export function hasApprovedCaseStudies(): boolean {
  return getApprovedCaseStudies().length > 0;
}

export function getApprovedCaseStudyBySlug(slug: string): CaseStudyArticle | undefined {
  return getApprovedCaseStudies().find((study) => study.slug === slug);
}
