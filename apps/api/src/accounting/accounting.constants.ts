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

export interface JournalAggregateInput {
  key: string;
  category: JournalAggregateCategory;
  sourceLabel: string;
  amount: string;
}

export interface ResolvedGlMapping {
  glAccountCode: string;
  glAccountName: string;
  postingSide: 'debit' | 'credit';
}

export interface MappingLookup {
  byComponentId: Map<string, ResolvedGlMapping>;
  bySystemKey: Map<string, ResolvedGlMapping>;
}

export interface BuiltJournalLine {
  glAccountCode: string;
  glAccountName: string;
  description: string;
  debit: string;
  credit: string;
  mappingSource: string;
  category: JournalAggregateCategory;
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
  }>;
}
