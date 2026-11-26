import type { CmsBlockNode } from '@hrm/shared-types';
import { apiClient } from '@/api/client';
import type { PublicCountryView, PublicPlanView } from '@/api/types';

export interface ResolvedCmsDynamicData {
  plans: PublicPlanView[];
  countries: PublicCountryView[];
}

function collectDynamicWidgetKeys(
  blocks: readonly CmsBlockNode[],
  keys: Set<string>,
): void {
  for (const block of blocks) {
    if (block.type === 'dynamic_block' && typeof block.props.widget === 'string') {
      keys.add(block.props.widget);
    }
    if (block.type === 'columns') {
      for (const column of block.props.columns ?? []) {
        collectDynamicWidgetKeys(column.blocks ?? [], keys);
      }
    }
  }
}

/**
 * Loads live SaaS pricing plans and supported country compliance datasets only
 * when a CMS page actually renders matching `dynamic_block` widgets.
 */
export async function resolveDynamicBlockData(
  blocks: readonly CmsBlockNode[],
): Promise<ResolvedCmsDynamicData> {
  const widgets = new Set<string>();
  collectDynamicWidgetKeys(blocks, widgets);

  const needsPlans =
    widgets.has('pricing_table') || widgets.has('plan_comparison');
  const needsCountries = widgets.has('country_list');

  const [plans, countries] = await Promise.all([
    needsPlans ? apiClient.plans.list({ revalidate: 60 }).catch(() => []) : Promise.resolve([]),
    needsCountries
      ? apiClient.countries.list({ revalidate: 60 }).catch(() => [])
      : Promise.resolve([]),
  ]);

  return {
    plans,
    countries,
  };
}
