import type {
  GlAccountRecord,
  GlCostCentreMappingGroup,
  GlPayrollMappingRecord,
} from '@hrm/shared-types';
import {
  GL_COST_CENTRE_DEFAULT_SOURCE,
  GL_COST_CENTRE_SUPER_SOURCE,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { GlAccountSelect } from '@/components/accounting/GlAccountSelect';
import { accountOptionLabel } from '@/lib/accounting-display';

const thClass = 'text-left px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';

interface SourceRow {
  sourceKey: string;
  label: string;
  hint: string;
}

export function CostCentreOverridesEditor({
  group,
  earnings,
  accounts,
  draft,
  companyAccountFor,
  canEdit,
  onChange,
  onClearAll,
}: {
  group: GlCostCentreMappingGroup;
  earnings: GlPayrollMappingRecord[];
  accounts: GlAccountRecord[];
  draft: Record<string, string>;
  /** Company-wide account id for a source key, '' when unmapped */
  companyAccountFor: (sourceKey: string) => string;
  canEdit: boolean;
  onChange: (sourceKey: string, accountId: string) => void;
  onClearAll: () => void;
}) {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const hasExpenseAccounts = accounts.some(
    (account) => account.isActive && account.accountType === 'expense',
  );
  const defaultAccountId = draft[GL_COST_CENTRE_DEFAULT_SOURCE] ?? '';
  const overrideCount = Object.values(draft).filter(Boolean).length;

  const rows: SourceRow[] = [
    ...earnings.map((row) => ({
      sourceKey: `component:${row.payComponentId}`,
      label: row.payComponentName ?? 'Earning',
      hint: 'Earning',
    })),
    {
      sourceKey: GL_COST_CENTRE_SUPER_SOURCE,
      label: 'Employer superannuation expense',
      hint: 'Employer cost',
    },
  ];

  const resolved = (sourceKey: string): { accountId: string; via: string } => {
    if (draft[sourceKey]) return { accountId: draft[sourceKey], via: 'Override for this cost centre' };
    if (defaultAccountId) return { accountId: defaultAccountId, via: 'Cost-centre default' };
    const company = companyAccountFor(sourceKey);
    if (company) return { accountId: company, via: 'Company-wide mapping' };
    return { accountId: '', via: 'Not mapped' };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">
              {group.costCentreCode} · {group.costCentreName}
            </CardTitle>
            <p className="text-sm text-secondary mt-0.5">
              Wages and employer super for the {group.employeeCount} employee
              {group.employeeCount === 1 ? '' : 's'} in this cost centre post to the accounts below, and each line is
              tagged with {group.costCentreCode}. Deductions, net pay and super payable always use the company-wide
              mapping.
            </p>
          </div>
          {canEdit && overrideCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={onClearAll}>
              Clear overrides
            </Button>
          ) : null}
        </div>
        {!hasExpenseAccounts ? (
          <p className="text-sm text-warning-700 dark:text-warning-300 mt-2">
            There are no active expense accounts yet. Add one in the Chart of accounts tab first.
          </p>
        ) : null}
      </CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto border-t border-base">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                <th className={thClass}>Payroll source</th>
                <th className={thClass}>Account for this cost centre</th>
                <th className={thClass}>Posts to</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-base))]">
              <tr className="bg-accent-50/40 dark:bg-accent-950/10">
                <td className="px-4 py-3 align-top min-w-[200px]">
                  <div className="font-medium text-primary">All employee costs</div>
                  <div className="text-xs text-muted mt-0.5">Default for every row below without its own account</div>
                </td>
                <td className="px-4 py-3 align-top min-w-[260px]">
                  <GlAccountSelect
                    accounts={accounts}
                    types={['expense']}
                    value={defaultAccountId}
                    onChange={(id) => onChange(GL_COST_CENTRE_DEFAULT_SOURCE, id)}
                    emptyLabel="No default — use company mappings"
                    disabled={!canEdit}
                    ariaLabel={`Default account for ${group.costCentreCode}`}
                  />
                </td>
                <td className="px-4 py-3 align-top text-xs text-secondary min-w-[200px]">
                  {defaultAccountId
                    ? 'Used by rows below that are set to "Use default"'
                    : 'Rows below fall back to their company-wide mapping'}
                </td>
              </tr>
              {rows.map((row) => {
                const result = resolved(row.sourceKey);
                const account = accountById.get(result.accountId);
                return (
                  <tr key={row.sourceKey}>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-primary">{row.label}</div>
                      <div className="text-xs text-muted mt-0.5">{row.hint}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <GlAccountSelect
                        accounts={accounts}
                        types={['expense']}
                        value={draft[row.sourceKey] ?? ''}
                        onChange={(id) => onChange(row.sourceKey, id)}
                        emptyLabel={defaultAccountId ? 'Use default' : 'Use company mapping'}
                        disabled={!canEdit}
                        ariaLabel={`${row.label} account for ${group.costCentreCode}`}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      {account ? (
                        <div className="font-mono text-xs text-primary">{accountOptionLabel(account)}</div>
                      ) : (
                        <div className="text-xs font-medium text-warning-700 dark:text-warning-300">Not mapped</div>
                      )}
                      <div className="text-xs text-muted mt-0.5">{account ? result.via : 'Exports fail while a paid line is unmapped'}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
