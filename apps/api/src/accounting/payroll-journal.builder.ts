import { Decimal } from '@prisma/client/runtime/library';
import type {
  PayrollCalculationPreview,
  PayrollJournalLine,
  PayrollJournalPreview,
  PayrollJournalUnmappedItem,
} from '@hrm/shared-types';
import { GL_COST_CENTRE_DEFAULT_SOURCE } from '@hrm/shared-types';
import {
  type BuiltJournalResult,
  type JournalAggregateInput,
  type JournalCostCentre,
  type MappingLookup,
  type ResolvedGlMapping,
} from './accounting.constants';
import { formatMoney, parseMoney } from '../payroll/payroll.utils';

export function collectAggregatesFromPreview(
  preview: PayrollCalculationPreview,
  costCentre: JournalCostCentre | null = null,
): JournalAggregateInput[] {
  const items: JournalAggregateInput[] = [];

  for (const line of preview.earnings) {
    items.push({
      key: `component:${line.componentId}`,
      category: 'earning',
      sourceLabel: line.componentName,
      amount: line.amount,
      costCentre,
    });
  }

  for (const line of preview.deductions) {
    items.push({
      key: `component:${line.componentId}`,
      category: 'deduction',
      sourceLabel: line.componentName,
      amount: line.amount,
    });
  }

  items.push({
    key: 'system:net_pay_salary_payable',
    category: 'liability',
    sourceLabel: 'Net pay',
    amount: preview.netPay,
  });

  if (preview.superannuation) {
    const employerAmount = preview.superannuation.employerContribution;
    if (parseMoney(employerAmount).gt(0)) {
      items.push({
        key: 'system:employer_superannuation_expense',
        category: 'expense',
        sourceLabel: preview.superannuation.schemeName,
        amount: employerAmount,
        costCentre,
      });
      items.push({
        key: 'system:employer_superannuation_liability',
        category: 'liability',
        sourceLabel: `${preview.superannuation.schemeName} payable`,
        amount: employerAmount,
      });
    }
  }

  return items;
}

export function mergeAggregates(
  batches: JournalAggregateInput[],
): JournalAggregateInput[] {
  const merged = new Map<string, JournalAggregateInput>();

  for (const item of batches) {
    const mergeKey = `${item.key}|${item.costCentre?.id ?? ''}`;
    const existing = merged.get(mergeKey);
    if (!existing) {
      merged.set(mergeKey, { ...item });
      continue;
    }
    const total = parseMoney(existing.amount).plus(parseMoney(item.amount));
    merged.set(mergeKey, { ...existing, amount: formatMoney(total) });
  }

  return [...merged.values()];
}

/** Earnings and employer super expense are employee costs that can be split by cost centre. */
export function isEmployeeCostAggregate(aggregate: JournalAggregateInput): boolean {
  return aggregate.category === 'earning' || aggregate.category === 'expense';
}

function resolveCompanyMapping(
  aggregate: JournalAggregateInput,
  lookup: MappingLookup,
): ResolvedGlMapping | null {
  if (aggregate.key.startsWith('component:')) {
    const componentId = aggregate.key.slice('component:'.length);
    return lookup.byComponentId.get(componentId) ?? null;
  }
  if (aggregate.key.startsWith('system:')) {
    const systemKey = aggregate.key.slice('system:'.length);
    return lookup.bySystemKey.get(systemKey) ?? null;
  }
  return null;
}

/**
 * Cost-centre override for the exact source, then the cost centre's default account, then the
 * company-wide mapping. Overrides change the account only; the posting side comes from the
 * company mapping (debit when the source has none).
 */
export function resolveMappingForAggregate(
  aggregate: JournalAggregateInput,
  lookup: MappingLookup,
): ResolvedGlMapping | null {
  const companyMapping = resolveCompanyMapping(aggregate, lookup);
  if (aggregate.costCentre && isEmployeeCostAggregate(aggregate)) {
    const overrides = lookup.byCostCentre?.get(aggregate.costCentre.id);
    const override =
      overrides?.get(aggregate.key) ?? overrides?.get(GL_COST_CENTRE_DEFAULT_SOURCE);
    if (override) {
      return { ...override, postingSide: companyMapping?.postingSide ?? 'debit' };
    }
  }
  return companyMapping;
}

export function buildJournalFromAggregates(input: {
  aggregates: JournalAggregateInput[];
  lookup: MappingLookup;
  periodLabel: string;
}): BuiltJournalResult {
  const { aggregates, lookup, periodLabel } = input;
  const lineMap = new Map<string, BuiltJournalResult['lines'][number]>();
  const unmapped: BuiltJournalResult['unmapped'] = [];

  for (const aggregate of aggregates) {
    const amount = parseMoney(aggregate.amount);
    if (amount.isZero()) {
      continue;
    }

    const costCentre = isEmployeeCostAggregate(aggregate)
      ? (aggregate.costCentre ?? null)
      : null;
    const mapping = resolveMappingForAggregate(aggregate, lookup);
    if (!mapping) {
      unmapped.push({
        source: aggregate.sourceLabel,
        category: aggregate.category,
        amount: formatMoney(amount),
        costCentreCode: costCentre?.code ?? null,
      });
      continue;
    }

    const lineKey = `${mapping.glAccountCode}:${mapping.postingSide}:${aggregate.category}:${costCentre?.id ?? ''}`;
    const debit = mapping.postingSide === 'debit' ? amount : new Decimal(0);
    const credit = mapping.postingSide === 'credit' ? amount : new Decimal(0);

    const existing = lineMap.get(lineKey);
    if (existing) {
      lineMap.set(lineKey, {
        ...existing,
        debit: formatMoney(parseMoney(existing.debit).plus(debit)),
        credit: formatMoney(parseMoney(existing.credit).plus(credit)),
      });
      continue;
    }

    lineMap.set(lineKey, {
      glAccountCode: mapping.glAccountCode,
      glAccountName: mapping.glAccountName,
      description: costCentre
        ? `${periodLabel} payroll — ${aggregate.sourceLabel} (${costCentre.code})`
        : `${periodLabel} payroll — ${aggregate.sourceLabel}`,
      debit: formatMoney(debit),
      credit: formatMoney(credit),
      mappingSource: aggregate.sourceLabel,
      category: aggregate.category,
      costCentreCode: costCentre?.code ?? null,
      costCentreName: costCentre?.name ?? null,
    });
  }

  const lines = [...lineMap.values()].sort(
    (a, b) =>
      a.glAccountCode.localeCompare(b.glAccountCode) ||
      (a.costCentreCode ?? '').localeCompare(b.costCentreCode ?? ''),
  );

  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);
  for (const line of lines) {
    totalDebit = totalDebit.plus(parseMoney(line.debit));
    totalCredit = totalCredit.plus(parseMoney(line.credit));
  }

  return {
    lines,
    totalDebit: formatMoney(totalDebit),
    totalCredit: formatMoney(totalCredit),
    balanced: totalDebit.eq(totalCredit),
    unmapped,
  };
}

export function toJournalPreview(input: {
  payrollPeriodId: string;
  periodLabel: string;
  postingDate: string;
  runCount: number;
  referenceNumber: string;
  built: BuiltJournalResult;
}): PayrollJournalPreview {
  return {
    payrollPeriodId: input.payrollPeriodId,
    periodLabel: input.periodLabel,
    postingDate: input.postingDate,
    runCount: input.runCount,
    referenceNumber: input.referenceNumber,
    lines: input.built.lines as PayrollJournalLine[],
    totalDebit: input.built.totalDebit,
    totalCredit: input.built.totalCredit,
    balanced: input.built.balanced,
    unmapped: input.built.unmapped as PayrollJournalUnmappedItem[],
  };
}

export function journalToCsv(
  journal: PayrollJournalPreview,
  referenceNumber: string,
): string {
  const header =
    'Posting Date,Account Code,Account Name,Description,Debit,Credit,Reference,Cost Centre';
  const rows = journal.lines.map((line) =>
    [
      journal.postingDate,
      csvEscape(line.glAccountCode),
      csvEscape(line.glAccountName),
      csvEscape(line.description),
      line.debit,
      line.credit,
      csvEscape(referenceNumber),
      csvEscape(line.costCentreCode ?? ''),
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
