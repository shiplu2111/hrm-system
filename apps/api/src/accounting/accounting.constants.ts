import type { GlSystemMappingKey } from '@hrm/shared-types';

export const GL_SYSTEM_KEYS = {
  NET_PAY: 'net_pay_salary_payable' as GlSystemMappingKey,
  EMPLOYER_SUPER_EXPENSE: 'employer_superannuation_expense' as GlSystemMappingKey,
  EMPLOYER_SUPER_LIABILITY: 'employer_superannuation_liability' as GlSystemMappingKey,
};

export type JournalAggregateCategory =
  | 'earning'
  | 'deduction'
  | 'expense'
  | 'liability';

export interface JournalCostCentre {
  id: string;
  code: string;
  name: string;
}

export interface JournalAggregateInput {
  /** `component:<payComponentId>` or `system:<GlSystemMappingKey>` */
  key: string;
  category: JournalAggregateCategory;
  sourceLabel: string;
  amount: string;
  /** Only employee-cost aggregates (earnings, employer super expense) carry a cost centre. */
  costCentre?: JournalCostCentre | null;
}

export interface GlAccountRef {
  glAccountCode: string;
  glAccountName: string;
}

export interface ResolvedGlMapping extends GlAccountRef {
  postingSide: 'debit' | 'credit';
}

export interface MappingLookup {
  byComponentId: Map<string, ResolvedGlMapping>;
  bySystemKey: Map<string, ResolvedGlMapping>;
  /** costCentreId → sourceKey (`default`, `component:<id>`, `system:…`) → override account */
  byCostCentre?: Map<string, Map<string, GlAccountRef>>;
}

export interface BuiltJournalLine {
  glAccountCode: string;
  glAccountName: string;
  description: string;
  debit: string;
  credit: string;
  mappingSource: string;
  category: JournalAggregateCategory;
  costCentreCode?: string | null;
  costCentreName?: string | null;
}

export interface BuiltJournalResult {
  lines: BuiltJournalLine[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
  unmapped: Array<{
    source: string;
    category: JournalAggregateCategory;
    amount: string;
    costCentreCode?: string | null;
  }>;
}
