import type { ContractorJournalPreview } from '@hrm/shared-types';
import {
  type BuiltJournalResult,
  type MappingLookup,
  type ResolvedGlMapping,
} from '../accounting/accounting.constants';
import { formatMoney, parseMoney } from '../payroll/payroll.utils';

export interface PaidContractorInvoiceItem {
  invoiceId: string;
  invoiceNumber: string;
  contractorName: string;
  amount: string;
}

function resolveContractorExpense(lookup: MappingLookup): ResolvedGlMapping | null {
  return lookup.bySystemKey.get('contractor_expense') ?? null;
}

function resolveContractorPayable(lookup: MappingLookup): ResolvedGlMapping | null {
  return lookup.bySystemKey.get('contractor_payable') ?? null;
}

export function buildContractorJournal(input: {
  items: PaidContractorInvoiceItem[];
  lookup: MappingLookup;
  batchReference: string;
  postingDate: string;
}): BuiltJournalResult {
  const { items, lookup, batchReference } = input;
  const expenseMapping = resolveContractorExpense(lookup);
  const payableMapping = resolveContractorPayable(lookup);
  const lines: BuiltJournalResult['lines'] = [];
  const unmapped: BuiltJournalResult['unmapped'] = [];

  let totalDebit = parseMoney('0');
  let totalCredit = parseMoney('0');

  for (const item of items) {
    const amount = parseMoney(item.amount);
    if (amount.isZero()) continue;

    if (!expenseMapping) {
      unmapped.push({
        source: `${item.contractorName} — ${item.invoiceNumber}`,
        category: 'expense',
        amount: formatMoney(amount),
      });
      continue;
    }

    const debit = expenseMapping.postingSide === 'debit' ? amount : parseMoney('0');
    const credit = expenseMapping.postingSide === 'credit' ? amount : parseMoney('0');

    lines.push({
      glAccountCode: expenseMapping.glAccountCode,
      glAccountName: expenseMapping.glAccountName,
      description: `${batchReference} — ${item.contractorName} (${item.invoiceNumber})`,
      debit: formatMoney(debit),
      credit: formatMoney(credit),
      mappingSource: item.invoiceNumber,
      category: 'expense',
    });
    totalDebit = totalDebit.plus(debit);
    totalCredit = totalCredit.plus(credit);
  }

  const batchTotal = items.reduce(
    (sum, item) => sum.plus(parseMoney(item.amount)),
    parseMoney('0'),
  );

  if (batchTotal.gt(0)) {
    if (!payableMapping) {
      unmapped.push({
        source: 'Contractor payments payable',
        category: 'liability',
        amount: formatMoney(batchTotal),
      });
    } else {
      const debit =
        payableMapping.postingSide === 'debit' ? batchTotal : parseMoney('0');
      const credit =
        payableMapping.postingSide === 'credit' ? batchTotal : parseMoney('0');

      lines.push({
        glAccountCode: payableMapping.glAccountCode,
        glAccountName: payableMapping.glAccountName,
        description: `${batchReference} — contractor payments`,
        debit: formatMoney(debit),
        credit: formatMoney(credit),
        mappingSource: 'Contractor payments payable',
        category: 'liability',
      });
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
    }
  }

  lines.sort((a, b) => a.glAccountCode.localeCompare(b.glAccountCode));

  return {
    lines,
    totalDebit: formatMoney(totalDebit),
    totalCredit: formatMoney(totalCredit),
    balanced: totalDebit.eq(totalCredit),
    unmapped,
  };
}

export function toContractorJournalPreview(input: {
  contractorPaymentBatchId: string;
  batchReference: string;
  postingDate: string;
  referenceNumber: string;
  built: BuiltJournalResult;
}): ContractorJournalPreview {
  return {
    contractorPaymentBatchId: input.contractorPaymentBatchId,
    batchReference: input.batchReference,
    periodLabel: input.batchReference,
    postingDate: input.postingDate,
    invoiceCount: input.built.lines.filter((line) => line.category === 'expense').length,
    referenceNumber: input.referenceNumber,
    lines: input.built.lines,
    totalDebit: input.built.totalDebit,
    totalCredit: input.built.totalCredit,
    balanced: input.built.balanced,
    unmapped: input.built.unmapped,
  };
}

export function contractorJournalToCsv(
  journal: ContractorJournalPreview,
): string {
  const header =
    'Posting Date,Account Code,Account Name,Description,Debit,Credit,Reference';
  const rows = journal.lines.map((line) =>
    [
      journal.postingDate,
      csvEscape(line.glAccountCode),
      csvEscape(line.glAccountName),
      csvEscape(line.description),
      line.debit,
      line.credit,
      csvEscape(journal.referenceNumber),
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
