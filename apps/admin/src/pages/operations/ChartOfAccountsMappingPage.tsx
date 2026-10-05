import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  Building2,
  Check,
  History,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  Power,
  X,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type {
  GlAccountRecord,
  GlContractorMappingRecord,
  GlContractorSystemMappingKey,
  GlCostCentreMappingGroup,
  GlPayrollMappingRecord,
  GlSystemMappingKey,
} from '@hrm/shared-types';
import { GL_CONTRACTOR_MAPPING_LABELS } from '@hrm/shared-types';
import { CostCentreOverridesEditor } from '@/components/accounting/CostCentreOverridesEditor';
import { GlAccountFormModal } from '@/components/accounting/GlAccountFormModal';
import { GlAccountSelect } from '@/components/accounting/GlAccountSelect';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { SummaryTile } from '@/components/ui/SummaryTile';
import { pathForPage } from '@/config/routes';
import {
  listCostCentreMappings,
  listGlAccounts,
  listGlContractorMappings,
  listGlPayrollMappings,
  replaceCostCentreMappings,
  saveGlContractorMappings,
  saveGlPayrollMappings,
  updateGlAccount,
} from '@/lib/accounting-api';
import {
  GL_ACCOUNT_TYPE_LABELS,
  accountTypeHint,
  expectedAccountType,
  mappingGroup,
  mappingKey,
  mappingSourceLabel,
  type MappingGroup,
} from '@/lib/accounting-display';
import { ApiError } from '@/lib/tenant-api-client';

const thClass = 'text-left px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';

type Tab = 'components' | 'cost-centres' | 'accounts' | 'contractor';
type Draft = Record<string, string>;

const GROUP_TITLES: Record<MappingGroup, string> = {
  earning: 'Earnings',
  deduction: 'Deductions',
  system: 'System lines',
};

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function payrollDraft(rows: GlPayrollMappingRecord[]): Draft {
  return Object.fromEntries(
    rows.filter((row) => row.glAccountId).map((row) => [mappingKey(row), row.glAccountId]),
  );
}

function contractorDraft(rows: GlContractorMappingRecord[]): Draft {
  return Object.fromEntries(
    rows.filter((row) => row.glAccountId).map((row) => [row.systemKey, row.glAccountId]),
  );
}

function costCentreDraft(group: GlCostCentreMappingGroup): Draft {
  return Object.fromEntries(group.overrides.map((row) => [row.sourceKey, row.glAccountId]));
}

function sameDraft(a: Draft = {}, b: Draft = {}): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] || '') === (b[key] || ''));
}

function MappingContent({ companyId }: { companyId: string }) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canEdit = can('payroll', 'edit');
  const canCreateAccount = can('payroll', 'create');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('components');

  const [accounts, setAccounts] = useState<GlAccountRecord[]>([]);
  const [mappings, setMappings] = useState<GlPayrollMappingRecord[]>([]);
  const [contractorMappings, setContractorMappings] = useState<GlContractorMappingRecord[]>([]);
  const [groups, setGroups] = useState<GlCostCentreMappingGroup[]>([]);

  const [savedPayroll, setSavedPayroll] = useState<Draft>({});
  const [draftPayroll, setDraftPayroll] = useState<Draft>({});
  const [savedContractor, setSavedContractor] = useState<Draft>({});
  const [draftContractor, setDraftContractor] = useState<Draft>({});
  const [savedCostCentres, setSavedCostCentres] = useState<Record<string, Draft>>({});
  const [draftCostCentres, setDraftCostCentres] = useState<Record<string, Draft>>({});
  const [selectedCostCentreId, setSelectedCostCentreId] = useState<string | null>(null);

  const [onlyUnmapped, setOnlyUnmapped] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accountModal, setAccountModal] = useState<{ account: GlAccountRecord | null } | null>(null);
  const [deactivating, setDeactivating] = useState<GlAccountRecord | null>(null);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [accountRows, mappingRows, contractorRows, groupRows] = await Promise.all([
        listGlAccounts(companyId, { includeInactive: true }),
        listGlPayrollMappings(companyId),
        listGlContractorMappings(companyId),
        listCostCentreMappings(companyId),
      ]);
      setAccounts(accountRows);
      setMappings(mappingRows);
      setContractorMappings(contractorRows);
      setGroups(groupRows);
      const payroll = payrollDraft(mappingRows);
      setSavedPayroll(payroll);
      setDraftPayroll(payroll);
      const contractor = contractorDraft(contractorRows);
      setSavedContractor(contractor);
      setDraftContractor(contractor);
      const centres = Object.fromEntries(groupRows.map((g) => [g.costCentreId, costCentreDraft(g)]));
      setSavedCostCentres(centres);
      setDraftCostCentres(centres);
      setSelectedCostCentreId((current) =>
        current && groupRows.some((g) => g.costCentreId === current)
          ? current
          : (groupRows[0]?.costCentreId ?? null),
      );
    } catch (err) {
      setError(errorText(err, 'Failed to load the chart of accounts'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const reloadAccounts = async () => {
    setAccounts(await listGlAccounts(companyId, { includeInactive: true }));
  };

  const payrollChanges = mappings.filter(
    (row) => (draftPayroll[mappingKey(row)] || '') !== (savedPayroll[mappingKey(row)] || ''),
  );
  const contractorChanges = contractorMappings.filter(
    (row) => (draftContractor[row.systemKey] || '') !== (savedContractor[row.systemKey] || ''),
  );
  const changedCostCentres = groups.filter(
    (g) => !sameDraft(draftCostCentres[g.costCentreId], savedCostCentres[g.costCentreId]),
  );
  const dirtyCount = payrollChanges.length + contractorChanges.length + changedCostCentres.length;

  useEffect(() => {
    if (dirtyCount === 0) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyCount]);

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const activeAccounts = accounts.filter((a) => a.isActive);
  const unmappedSaved = mappings.filter((row) => !savedPayroll[mappingKey(row)]);
  const mappedCount = mappings.length - unmappedSaved.length;
  const costCentresWithOverrides = groups.filter((g) => g.overrides.length > 0).length;
  const earnings = mappings.filter((row) => mappingGroup(row) === 'earning');
  const selectedGroup = groups.find((g) => g.costCentreId === selectedCostCentreId) ?? null;

  const discard = () => {
    setDraftPayroll(savedPayroll);
    setDraftContractor(savedContractor);
    setDraftCostCentres(savedCostCentres);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (payrollChanges.length > 0) {
        const upserts = payrollChanges
          .filter((row) => draftPayroll[mappingKey(row)])
          .map((row) => ({
            payComponentId: row.payComponentId ?? undefined,
            systemKey: (row.systemKey ?? undefined) as GlSystemMappingKey | undefined,
            postingSide: row.postingSide,
            glAccountId: draftPayroll[mappingKey(row)],
          }));
        const removals = payrollChanges
          .filter((row) => !draftPayroll[mappingKey(row)])
          .map((row) => ({
            payComponentId: row.payComponentId ?? undefined,
            systemKey: (row.systemKey ?? undefined) as GlSystemMappingKey | undefined,
          }));
        const updated = await saveGlPayrollMappings(companyId, upserts, removals);
        setMappings(updated);
        const next = payrollDraft(updated);
        setSavedPayroll(next);
        setDraftPayroll(next);
      }
      if (contractorChanges.length > 0) {
        const updated = await saveGlContractorMappings(
          companyId,
          contractorMappings
            .filter((row) => draftContractor[row.systemKey])
            .map((row) => ({
              systemKey: row.systemKey as GlContractorSystemMappingKey,
              postingSide: row.postingSide,
              glAccountId: draftContractor[row.systemKey],
            })),
        );
        setContractorMappings(updated);
        const next = contractorDraft(updated);
        setSavedContractor(next);
        setDraftContractor(next);
      }
      for (const group of changedCostCentres) {
        const draft = draftCostCentres[group.costCentreId] ?? {};
        const updated = await replaceCostCentreMappings(
          companyId,
          group.costCentreId,
          Object.entries(draft)
            .filter(([, accountId]) => accountId)
            .map(([sourceKey, glAccountId]) => ({ sourceKey, glAccountId })),
        );
        setGroups((current) =>
          current.map((g) => (g.costCentreId === updated.costCentreId ? updated : g)),
        );
        const next = costCentreDraft(updated);
        setSavedCostCentres((current) => ({ ...current, [updated.costCentreId]: next }));
        setDraftCostCentres((current) => ({ ...current, [updated.costCentreId]: next }));
      }
      await reloadAccounts();
      setNotice(
        'Mappings saved. Journal previews and new exports use them straight away; past exports keep the accounts they were exported with.',
      );
    } catch (err) {
      setError(errorText(err, 'Could not save the mappings'));
    } finally {
      setSaving(false);
    }
  };

  const setAccountActive = async (account: GlAccountRecord, isActive: boolean) => {
    await updateGlAccount(account.id, { isActive });
    await reloadAccounts();
    setNotice(`${account.code} · ${account.name} is ${isActive ? 'active again' : 'inactive'}.`);
  };

  const reactivate = async (account: GlAccountRecord) => {
    setBusyAccountId(account.id);
    setError(null);
    setNotice(null);
    try {
      await setAccountActive(account, true);
    } catch (err) {
      setError(errorText(err, 'Could not reactivate the account'));
    } finally {
      setBusyAccountId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading chart of accounts…
      </div>
    );
  }

  const visibleAccounts = accounts.filter((a) => showInactive || a.isActive);
  const inactiveCount = accounts.length - activeAccounts.length;
  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'components', label: 'Pay components & system lines', count: mappings.length },
    { id: 'cost-centres', label: 'Cost centres', count: groups.length },
    { id: 'accounts', label: 'Chart of accounts', count: activeAccounts.length },
    { id: 'contractor', label: 'Contractor payments', count: contractorMappings.length },
  ];

  return (
    <div className={`px-4 pt-4 lg:px-6 lg:pt-6 space-y-5 max-w-[1400px] mx-auto ${canEdit && dirtyCount > 0 ? 'pb-0' : 'pb-4 lg:pb-6'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Chart of Accounts Mapping</h1>
          <p className="text-sm text-secondary mt-0.5">
            Choose the GL account each pay component, system line and cost centre posts to when a payroll journal is
            exported or synced.
          </p>
        </div>
        <Button
          variant="secondary"
          className="shrink-0 whitespace-nowrap"
          onClick={() => navigate(pathForPage('accounting-exports'))}
        >
          <History className="h-4 w-4" /> Export &amp; sync status
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-4 py-3 text-sm text-success-700 dark:text-success-300">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          icon={<BookOpen className="h-5 w-5" />}
          tone={unmappedSaved.length > 0 ? 'warning' : 'success'}
          value={`${mappedCount} of ${mappings.length}`}
          label="Payroll sources mapped"
          hint={
            unmappedSaved.length > 0
              ? `${unmappedSaved.length} still need an account`
              : 'Every pay component and system line has an account'
          }
          onClick={
            unmappedSaved.length > 0
              ? () => {
                  setTab('components');
                  setOnlyUnmapped(true);
                }
              : undefined
          }
        />
        <SummaryTile
          icon={<Building2 className="h-5 w-5" />}
          tone="accent"
          value={`${costCentresWithOverrides} of ${groups.length}`}
          label="Cost centres with their own accounts"
          hint="Others use the company-wide mapping"
          onClick={() => setTab('cost-centres')}
        />
        <SummaryTile
          icon={<Landmark className="h-5 w-5" />}
          tone="neutral"
          value={String(activeAccounts.length)}
          label="Active GL accounts"
          hint={inactiveCount > 0 ? `${inactiveCount} inactive` : 'In this company’s chart of accounts'}
          onClick={() => setTab('accounts')}
        />
      </div>

      {unmappedSaved.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-900 dark:bg-warning-950/30 dark:text-warning-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Not mapped yet: {unmappedSaved.map(mappingSourceLabel).join(', ')}. A journal export fails when a payroll
            period pays an unmapped line. Payroll itself is never blocked.
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Mapping sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
              tab === item.id
                ? 'bg-accent-600 text-white'
                : 'surface border border-base text-secondary hover:text-primary hover:border-strong'
            }`}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className={`text-xs ${tab === item.id ? 'text-white/80' : 'text-muted'}`}>{item.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'components' ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Company-wide mapping</CardTitle>
                <p className="text-sm text-secondary mt-0.5">
                  Used for every employee, unless their cost centre has its own account for wages or employer super.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-secondary whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={onlyUnmapped}
                  onChange={(event) => setOnlyUnmapped(event.target.checked)}
                  className="h-4 w-4 rounded border-base"
                />
                Only unmapped
              </label>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {mappings.length === 0 ? (
              <div className="px-5 py-6 text-sm text-secondary border-t border-base">
                No pay components yet. Add them under Payroll → Salary Components.
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-base">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                      <th className={thClass}>Payroll source</th>
                      <th className={thClass}>Posts as</th>
                      <th className={thClass}>GL account</th>
                      <th className={thClass}>Status</th>
                    </tr>
                  </thead>
                  {(['earning', 'deduction', 'system'] as MappingGroup[]).map((groupKey) => {
                    const rows = mappings.filter(
                      (row) =>
                        mappingGroup(row) === groupKey &&
                        (!onlyUnmapped || !draftPayroll[mappingKey(row)] || !savedPayroll[mappingKey(row)]),
                    );
                    if (rows.length === 0) return null;
                    return (
                      <tbody key={groupKey} className="divide-y divide-[rgb(var(--border-base))]">
                        <tr className="bg-[rgb(var(--bg-muted))]/50">
                          <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-secondary">
                            {GROUP_TITLES[groupKey]}
                          </td>
                        </tr>
                        {rows.map((row) => {
                          const key = mappingKey(row);
                          const value = draftPayroll[key] ?? '';
                          const changed = (value || '') !== (savedPayroll[key] || '');
                          const hint = accountTypeHint(row, accountById.get(value));
                          return (
                            <tr key={key}>
                              <td className="px-4 py-3 align-top min-w-[220px]">
                                <div className="font-medium text-primary">{mappingSourceLabel(row)}</div>
                                <div className="text-xs text-muted mt-0.5">
                                  {row.systemKey ? 'Calculated by payroll' : 'Pay component'}
                                </div>
                              </td>
                              <td className="px-4 py-3 align-top whitespace-nowrap">
                                <Badge tone={row.postingSide === 'debit' ? 'success' : 'warning'}>
                                  {row.postingSide === 'debit' ? 'Debit' : 'Credit'}
                                </Badge>
                                <div className="text-xs text-muted mt-1">
                                  usually {GL_ACCOUNT_TYPE_LABELS[expectedAccountType(row)].toLowerCase()}
                                </div>
                              </td>
                              <td className="px-4 py-3 align-top min-w-[300px]">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1">
                                    <GlAccountSelect
                                      accounts={accounts}
                                      value={value}
                                      onChange={(id) => setDraftPayroll((d) => ({ ...d, [key]: id }))}
                                      emptyLabel="Not mapped"
                                      disabled={!canEdit}
                                      ariaLabel={`GL account for ${mappingSourceLabel(row)}`}
                                    />
                                  </div>
                                  {canEdit && value ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="Clear mapping"
                                      aria-label={`Clear mapping for ${mappingSourceLabel(row)}`}
                                      onClick={() => setDraftPayroll((d) => ({ ...d, [key]: '' }))}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </div>
                                {hint ? (
                                  <p className="text-xs text-warning-700 dark:text-warning-300 mt-1">{hint}</p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 align-top whitespace-nowrap">
                                {changed ? (
                                  <StatusPill tone="accent">Unsaved</StatusPill>
                                ) : value ? (
                                  <StatusPill tone="success">Mapped</StatusPill>
                                ) : (
                                  <StatusPill tone="warning">Not mapped</StatusPill>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    );
                  })}
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      {tab === 'cost-centres' ? (
        groups.length === 0 ? (
          <Card>
            <EmptyState
              compact
              icon={Building2}
              title="No cost centres yet"
              description="Create cost centres and assign employees to them to split wages and employer super across GL accounts."
              action={{
                label: 'Go to cost centres',
                onClick: () => navigate(pathForPage('org-cost-centres')),
              }}
            />
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <Card className="h-fit">
              <CardBody className="p-2">
                <ul className="space-y-1" aria-label="Cost centres">
                  {groups.map((g) => {
                    const draftCount = Object.values(draftCostCentres[g.costCentreId] ?? {}).filter(Boolean).length;
                    const dirty = changedCostCentres.some((c) => c.costCentreId === g.costCentreId);
                    const active = g.costCentreId === selectedCostCentreId;
                    return (
                      <li key={g.costCentreId}>
                        <button
                          type="button"
                          onClick={() => setSelectedCostCentreId(g.costCentreId)}
                          aria-current={active}
                          className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                            active
                              ? 'bg-accent-50 text-accent-800 dark:bg-accent-950/40 dark:text-accent-200'
                              : 'hover:bg-[rgb(var(--bg-hover))]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-primary truncate">
                              {g.costCentreCode} · {g.costCentreName}
                            </span>
                            {dirty ? (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-accent-500" title="Unsaved changes" />
                            ) : null}
                          </div>
                          <div className="text-xs text-muted mt-0.5">
                            {g.employeeCount} employee{g.employeeCount === 1 ? '' : 's'} ·{' '}
                            {draftCount === 0
                              ? 'company mapping'
                              : `${draftCount} account${draftCount === 1 ? '' : 's'} set`}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
            {selectedGroup ? (
              <CostCentreOverridesEditor
                group={selectedGroup}
                earnings={earnings}
                accounts={accounts}
                draft={draftCostCentres[selectedGroup.costCentreId] ?? {}}
                companyAccountFor={(sourceKey) => draftPayroll[sourceKey] ?? ''}
                canEdit={canEdit}
                onChange={(sourceKey, accountId) =>
                  setDraftCostCentres((current) => ({
                    ...current,
                    [selectedGroup.costCentreId]: {
                      ...(current[selectedGroup.costCentreId] ?? {}),
                      [sourceKey]: accountId,
                    },
                  }))
                }
                onClearAll={() =>
                  setDraftCostCentres((current) => ({ ...current, [selectedGroup.costCentreId]: {} }))
                }
              />
            ) : null}
          </div>
        )
      ) : null}

      {tab === 'accounts' ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Chart of accounts</CardTitle>
                <p className="text-sm text-secondary mt-0.5">
                  Accounts payroll can post to. Codes should match your accounting software.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {inactiveCount > 0 ? (
                  <label className="inline-flex items-center gap-2 text-sm text-secondary whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={showInactive}
                      onChange={(event) => setShowInactive(event.target.checked)}
                      className="h-4 w-4 rounded border-base"
                    />
                    Show inactive ({inactiveCount})
                  </label>
                ) : null}
                {canCreateAccount ? (
                  <Button onClick={() => setAccountModal({ account: null })}>
                    <Plus className="h-4 w-4" /> Add account
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {visibleAccounts.length === 0 ? (
              <div className="px-5 py-6 text-sm text-secondary border-t border-base">No GL accounts yet.</div>
            ) : (
              <div className="overflow-x-auto border-t border-base">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                      <th className={thClass}>Code</th>
                      <th className={thClass}>Name</th>
                      <th className={thClass}>Type</th>
                      <th className={thClass}>Used by</th>
                      <th className={thClass}>Status</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--border-base))]">
                    {visibleAccounts.map((account) => {
                      const uses = account.mappingCount ?? 0;
                      return (
                        <tr key={account.id} className={account.isActive ? undefined : 'opacity-60'}>
                          <td className="px-4 py-3 font-mono text-xs font-medium text-primary">{account.code}</td>
                          <td className="px-4 py-3 text-primary">{account.name}</td>
                          <td className="px-4 py-3 text-secondary">{GL_ACCOUNT_TYPE_LABELS[account.accountType]}</td>
                          <td className="px-4 py-3 text-secondary">
                            {uses === 0 ? 'Not mapped' : `${uses} mapping${uses === 1 ? '' : 's'}`}
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill tone={account.isActive ? 'success' : 'neutral'}>
                              {account.isActive ? 'Active' : 'Inactive'}
                            </StatusPill>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {canEdit ? (
                              <div className="inline-flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Edit"
                                  aria-label={`Edit ${account.code}`}
                                  onClick={() => setAccountModal({ account })}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={busyAccountId === account.id || (account.isActive && uses > 0)}
                                  title={
                                    account.isActive
                                      ? uses > 0
                                        ? 'Map its sources to another account before deactivating'
                                        : 'Deactivate'
                                      : 'Reactivate'
                                  }
                                  aria-label={`${account.isActive ? 'Deactivate' : 'Reactivate'} ${account.code}`}
                                  onClick={() =>
                                    account.isActive ? setDeactivating(account) : void reactivate(account)
                                  }
                                >
                                  {busyAccountId === account.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Power className={`h-4 w-4 ${account.isActive ? 'text-success-600' : ''}`} />
                                  )}
                                </Button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      {tab === 'contractor' ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contractor payment mapping</CardTitle>
            <p className="text-sm text-secondary mt-0.5">
              Paid contractor batches export to these accounts, separately from payroll journals.
            </p>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto border-t border-base">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className={thClass}>Source</th>
                    <th className={thClass}>Posts as</th>
                    <th className={thClass}>GL account</th>
                    <th className={thClass}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {contractorMappings.map((row) => {
                    const value = draftContractor[row.systemKey] ?? '';
                    const changed = value !== (savedContractor[row.systemKey] ?? '');
                    return (
                      <tr key={row.systemKey}>
                        <td className="px-4 py-3 font-medium text-primary">
                          {GL_CONTRACTOR_MAPPING_LABELS[row.systemKey]}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={row.postingSide === 'debit' ? 'success' : 'warning'}>
                            {row.postingSide === 'debit' ? 'Debit' : 'Credit'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 min-w-[300px]">
                          <GlAccountSelect
                            accounts={accounts}
                            value={value}
                            allowEmpty={!savedContractor[row.systemKey]}
                            onChange={(id) => setDraftContractor((d) => ({ ...d, [row.systemKey]: id }))}
                            emptyLabel="Not mapped"
                            disabled={!canEdit}
                            ariaLabel={`GL account for ${GL_CONTRACTOR_MAPPING_LABELS[row.systemKey]}`}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {changed ? (
                            <StatusPill tone="accent">Unsaved</StatusPill>
                          ) : value ? (
                            <StatusPill tone="success">Mapped</StatusPill>
                          ) : (
                            <StatusPill tone="warning">Not mapped</StatusPill>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {canEdit && dirtyCount > 0 ? (
        <div className="sticky bottom-0 z-30 -mx-4 lg:-mx-6 border-t border-base surface shadow-elevated">
          <div className="flex items-center justify-between gap-3 py-3 pl-4 pr-20 lg:pl-6">
            <div className="text-sm text-secondary">
              {dirtyCount} unsaved change{dirtyCount === 1 ? '' : 's'}
              {changedCostCentres.length > 0
                ? ` (including ${changedCostCentres.map((g) => g.costCentreCode).join(', ')})`
                : ''}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={discard} disabled={saving}>
                Discard
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <GlAccountFormModal
        open={accountModal !== null}
        companyId={companyId}
        account={accountModal?.account ?? null}
        onClose={() => setAccountModal(null)}
        onSaved={(account, created) => {
          setAccountModal(null);
          setNotice(created ? `${account.code} · ${account.name} added.` : `${account.code} · ${account.name} saved.`);
          void reloadAccounts();
          if (!created) {
            void listGlPayrollMappings(companyId).then(setMappings);
          }
        }}
      />
      <ConfirmDialog
        open={deactivating !== null}
        title={`Deactivate ${deactivating?.code ?? ''}?`}
        confirmLabel="Deactivate"
        tone="primary"
        description="It will no longer be offered when mapping. Past exports that used it are unchanged, and you can reactivate it later."
        onConfirm={async () => {
          if (!deactivating) return;
          await setAccountActive(deactivating, false);
          setDeactivating(null);
        }}
        onClose={() => setDeactivating(null)}
      />
    </div>
  );
}

export function ChartOfAccountsMappingPage() {
  return (
    <OrgPageState>
      {(companyId) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <MappingContent companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}
