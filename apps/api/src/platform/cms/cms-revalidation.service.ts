import { Injectable, Logger } from '@nestjs/common';

export type CmsRevalidateScope =
  | 'pricing'
  | 'countries'
  | 'help'
  | 'cms-pages'
  | 'cms-menus'
  | 'cms-settings'
  | 'cms-posts'
  | 'cms-changelog'
  | 'cms-careers'
  | 'cms-faqs'
  | 'cms-redirects'
  | 'all';

export interface TriggerCmsRevalidatePayload {
  scopes: CmsRevalidateScope[];
  slugs?: string[];
  tags?: string[];
  paths?: string[];
}

/**
 * Triggers on-demand ISR/CDN + fallback cache invalidation on `apps/website`
 * immediately when CMS pages, menus, settings, posts, changelog, careers, FAQs,
 * or redirects change.
 */
@Injectable()
export class CmsRevalidationService {
  private readonly logger = new Logger(CmsRevalidationService.name);

  private getTargetUrl(): string {
    const base =
      process.env.WEBSITE_INTERNAL_URL ||
      process.env.WEBSITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000';
    return `${base.replace(/\/+$/, '')}/api/revalidate`;
  }

  async trigger(payload: TriggerCmsRevalidatePayload): Promise<boolean> {
    const secret = process.env.REVALIDATE_SECRET?.trim();
    if (!secret) {
      return false;
    }

    const url = this.getTargetUrl();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': secret,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2500),
      });

      if (!res.ok) {
        this.logger.warn(
          `Website revalidation returned HTTP ${res.status} for scopes=[${payload.scopes.join(',')}]`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(
        `Website revalidation skipped (unreachable ${url}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }
}
