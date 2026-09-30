import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import type {
  PayComponentCalculationType,
  PayComponentRecord,
  PayComponentType,
  UpdatePayComponentRequest,
} from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { DataTable, DataTableBody, DataTableHead, SortableHeader, type SortDirection } from '@/components/ui/DataTable';
import { Dropdown, DropdownDivider, DropdownItem } from '@/components/ui/Dropdown';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgErrorBanner, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { PayComponentFormModal } from '@/components/payroll/PayComponentFormModal';
import {
  draftFromComponent,
  draftToRequest,
  parseFormulaText,
  safeDescribeFormula,
  type PayComponentDraft,
} from '@/lib/pay-component-draft';
import { PayrollReviewDialog } from '@/components/payroll/PayrollReviewDialog';
import { useCompany } from '@/context/CompanyContext';
import { createPayComponent, deletePayComponent, listPayComponents, updatePayComponent } from '@/lib/payroll-api';
import {
  componentTypeLabel,
  describeComponentRule,
  formatRate,
  payrollCopy,
} from '@/lib/payroll-copy';
import { downloadCsvFile } from '@/lib/csv';
import { ApiError } from '@/lib/tenant-api-client';

type TypeFilter = 'all' | PayComponentType;
type SortKey = 'name' | 'type' | 'calculationType' | 'employees';

type ReviewState =
  | { mode: 'create'; draft: PayComponentDraft }
  | { mode: 'edit'; draft: PayComponentDraft; component: PayComponentRecord }
  | { mode: 'delete'; component: PayComponentRecord };

const copy = payrollCopy.components;

export function SalaryComponentsPage() {
  const { companyId, loading: companyLoading, error: companyError, refresh: refreshCompanies } = useCompany();
  const { can } = usePermissions();
  const canCreate = can('payroll', 'create');
  const canEdit = can('payroll', 'edit');
  const canDelete = can('payroll', 'delete');

  const [components, setComponents] = useState<PayComponentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [calcFilter, setCalcFilter] = useState<'all' | PayComponentCalculationType>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDirection }>({ key: 'type', dir: 'asc' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PayComponentRecord | null>(null);
  const [draft, setDraft] = useState<PayComponentDraft>(() => draftFromComponent(null, 'earning'));
  const [review, setReview] = useState<ReviewState | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      setComponents(await listPayComponents(companyId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const counts = useMemo(
    () => ({
      earning: components.filter((c) => c.type === 'earning').length,
      deduction: components.filter((c) => c.type === 'deduction').length,
      inUse: components.filter((c) => (c.usage?.activeEmployeeCount ?? 0) > 0).length,
    }),
    [components],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = components.filter(
      (c) =>
        (typeFilter === 'all' || c.type === typeFilter) &&
        (calcFilter === 'all' || c.calculationType === calcFilter) &&
        (!q || c.name.toLowerCase().includes(q) || describeComponentRule(c).toLowerCase().includes(q)),
    );
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sort.key === 'employees') {
        cmp = (a.usage?.activeEmployeeCount ?? 0) - (b.usage?.activeEmployeeCount ?? 0);
      } else if (sort.key !== 'name') {
        cmp = a[sort.key].localeCompare(b[sort.key]);
      }
      return (cmp || a.name.localeCompare(b.name)) * dir;
    });
  }, [components, typeFilter, calcFilter, search, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));

  const openCreate = () => {
    setEditing(null);
    setDraft(draftFromComponent(null, typeFilter === 'deduction' ? 'deduction' : 'earning'));
    setFormOpen(true);
  };

  const openEdit = (component: PayComponentRecord) => {
    setEditing(component);
    setDraft(draftFromComponent(component, component.type));
    setFormOpen(true);
  };

  const handleReview = (next: PayComponentDraft) => {
    setDraft(next);
    setFormOpen(false);
    setReview(editing ? { mode: 'edit', draft: next, component: editing } : { mode: 'create', draft: next });
  };

  const backToForm = () => {
    setReview(null);
    setFormOpen(true);
  };

  const confirmReview = async () => {
    if (!companyId || !review) return;
    if (review.mode === 'create') {
      const created = await createPayComponent(companyId, draftToRequest(review.draft));
      setNotice(copy.saved(created.name));
    } else if (review.mode === 'edit') {
      const updated = await updatePayComponent(companyId, review.component.id, buildUpdate(review.component, review.draft));
      setNotice(copy.saved(updated.name));
    } else {
      await deletePayComponent(companyId, review.component.id);
      setNotice(copy.deleted(review.component.name));
    }
    setReview(null);
    await load();
  };

  const exportCsv = () => {
    downloadCsvFile(
      'pay-components.csv',
      [copy.colName, copy.colType, copy.colCalc, copy.colRule, 'Active employees', 'Assignment rows'],
      filtered.map((c) => [
        c.name,
        componentTypeLabel(c.type),
        payrollCopy.calcType[c.calculationType],
        describeComponentRule(c),
        c.usage?.activeEmployeeCount ?? 0,
        c.usage?.assignmentCount ?? 0,
      ]),
    );
  };

  if (companyLoading) return <PageLoadingState />;
  if (companyError) return <PageErrorState error={companyError} onRetry={() => void refreshCompanies()} />;

  const filtersActive = typeFilter !== 'all' || calcFilter !== 'all' || search.trim() !== '';

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{payrollCopy.common.eyebrow}</p>
          <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
          <p className="text-sm text-secondary mt-0.5 max-w-2xl">{copy.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          {canCreate ? (
            <Button variant="primary" onClick={openCreate} disabled={!companyId}>
              <Plus className="h-4 w-4" /> {copy.create}
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-success-700 dark:text-success-300 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg px-4 py-2.5"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} tone="success" value={counts.earning} label={copy.statEarnings} loading={loading} />
        <StatCard icon={TrendingDown} tone="warning" value={counts.deduction} label={copy.statDeductions} loading={loading} />
        <StatCard
          icon={Users}
          tone="accent"
          value={counts.inUse}
          label={copy.statInUse}
          hint={copy.statInUseHint}
          loading={loading}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-4 border-b border-base">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-1 rounded-lg border border-base surface gap-1" role="tablist">
              {(['all', 'earning', 'deduction'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === key}
                  onClick={() => setTypeFilter(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    typeFilter === key ? 'bg-accent-600 text-white shadow-sm' : 'text-secondary hover:text-primary'
                  }`}
                >
                  {key === 'all'
                    ? `${payrollCopy.common.all} (${components.length})`
                    : key === 'earning'
                      ? `${payrollCopy.common.earnings} (${counts.earning})`
                      : `${payrollCopy.common.deductions} (${counts.deduction})`}
                </button>
              ))}
            </div>
            <div className="w-44">
              <Select
                aria-label={copy.filterCalc}
                value={calcFilter}
                onChange={(e) => setCalcFilter(e.target.value as typeof calcFilter)}
                className="h-9 py-1"
              >
                <option value="all">{copy.anyCalc}</option>
                {(['fixed', 'percentage', 'formula'] as const).map((calc) => (
                  <option key={calc} value={calc}>
                    {payrollCopy.calcType[calc]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchPlaceholder}
                className="pl-9 h-9"
              />
            </div>
            <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> {payrollCopy.common.exportCsv}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="p-5">
            <OrgErrorBanner message={error} onRetry={() => void load()} />
          </div>
        ) : loading ? (
          <OrgTableSkeleton columns={5} rows={6} />
        ) : components.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={copy.emptyTitle}
            description={copy.emptyDescription}
            action={canCreate ? { label: copy.emptyAction, onClick: openCreate, icon: Plus } : undefined}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            compact
            icon={Search}
            title={copy.noMatchTitle}
            description={copy.noMatchDescription}
            action={
              filtersActive
                ? {
                    label: copy.clearFilters,
                    variant: 'secondary',
                    onClick: () => {
                      setTypeFilter('all');
                      setCalcFilter('all');
                      setSearch('');
                    },
                  }
                : undefined
            }
          />
        ) : (
          <DataTable className="max-h-[65vh] overflow-y-auto">
            <DataTableHead>
              <tr>
                <th className="text-left px-5 py-3">
                  <SortableHeader label={copy.colName} active={sort.key === 'name'} direction={sort.dir} onSort={() => toggleSort('name')} />
                </th>
                <th className="text-left px-5 py-3">
                  <SortableHeader label={copy.colType} active={sort.key === 'type'} direction={sort.dir} onSort={() => toggleSort('type')} />
                </th>
                <th className="text-left px-5 py-3">
                  <SortableHeader
                    label={copy.colCalc}
                    active={sort.key === 'calculationType'}
                    direction={sort.dir}
                    onSort={() => toggleSort('calculationType')}
                  />
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wide hidden lg:table-cell">
                  {copy.colRule}
                </th>
                <th className="text-right px-5 py-3">
                  <SortableHeader
                    label={copy.colEmployees}
                    active={sort.key === 'employees'}
                    direction={sort.dir}
                    onSort={() => toggleSort('employees')}
                  />
                </th>
                <th className="px-5 py-3 w-12">
                  <span className="sr-only">{payrollCopy.common.actions}</span>
                </th>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {filtered.map((component) => {
                const rows = component.usage?.assignmentCount ?? 0;
                const active = component.usage?.activeEmployeeCount ?? 0;
                return (
                  <tr key={component.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-primary">{component.name}</div>
                      <div className="text-xs text-secondary mt-0.5 lg:hidden line-clamp-1">
                        {describeComponentRule(component)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill tone={component.type === 'earning' ? 'success' : 'warning'}>
                        {componentTypeLabel(component.type)}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3.5 text-secondary">{payrollCopy.calcType[component.calculationType]}</td>
                    <td className="px-5 py-3.5 text-secondary hidden lg:table-cell max-w-md">
                      <span className="line-clamp-2">{describeComponentRule(component)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      <span className={active > 0 ? 'text-primary font-medium' : 'text-muted'}>{active}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {canEdit || canDelete ? (
                        <Dropdown
                          width="w-64"
                          trigger={
                            <button
                              type="button"
                              aria-label={`${payrollCopy.common.actions}: ${component.name}`}
                              className="text-muted hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-muted))] transition-colors"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          }
                        >
                          {canEdit ? (
                            <DropdownItem icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(component)}>
                              {payrollCopy.componentForm.editTitle}
                            </DropdownItem>
                          ) : null}
                          {canDelete ? (
                            <>
                              {canEdit ? <DropdownDivider /> : null}
                              <DropdownItem
                                icon={<Trash2 className="h-4 w-4" />}
                                onClick={() => setReview({ mode: 'delete', component })}
                                disabled={rows > 0}
                                description={rows > 0 ? copy.deleteBlocked(rows) : undefined}
                              >
                                {payrollCopy.componentReview.confirmDelete}
                              </DropdownItem>
                            </>
                          ) : null}
                        </Dropdown>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </DataTableBody>
          </DataTable>
        )}
      </Card>

      <PayComponentFormModal
        open={formOpen}
        editing={editing}
        initialDraft={draft}
        existing={components}
        onClose={() => setFormOpen(false)}
        onReview={handleReview}
      />

      <PayrollReviewDialog
        open={review !== null}
        title={
          review?.mode === 'delete'
            ? payrollCopy.componentReview.deleteTitle
            : review?.mode === 'edit'
              ? payrollCopy.componentReview.editTitle
              : payrollCopy.componentReview.createTitle
        }
        tone={review?.mode === 'delete' ? 'danger' : 'primary'}
        confirmDisabled={review?.mode === 'edit' && componentChanges(review.component, review.draft).length === 0}
        confirmLabel={
          review?.mode === 'delete'
            ? payrollCopy.componentReview.confirmDelete
            : review?.mode === 'edit'
              ? payrollCopy.componentReview.confirmSave
              : payrollCopy.componentReview.confirmCreate
        }
        onBack={review && review.mode !== 'delete' ? backToForm : undefined}
        onClose={() => setReview(null)}
        onConfirm={confirmReview}
      >
        {review ? <ComponentReviewBody review={review} /> : null}
      </PayrollReviewDialog>
    </div>
  );
}

function buildUpdate(component: PayComponentRecord, draft: PayComponentDraft): UpdatePayComponentRequest {
  const request = draftToRequest(draft);
  const update: UpdatePayComponentRequest = {};
  if (request.name !== component.name) update.name = request.name;
  if (request.calculationType !== component.calculationType) update.calculationType = request.calculationType;
  if (request.calculationType !== 'fixed') update.formula = request.formula;
  return update;
}

interface FieldRow {
  field: string;
  current: string;
  next: string;
}

function summarizeDraft(draft: PayComponentDraft): FieldRow[] {
  const form = payrollCopy.componentForm;
  const rows: FieldRow[] = [
    { field: form.name, current: '', next: draft.name.trim() },
    { field: form.type, current: '', next: componentTypeLabel(draft.type) },
    { field: form.calculation, current: '', next: payrollCopy.calcType[draft.calculationType] },
  ];
  if (draft.calculationType === 'percentage') {
    rows.push({ field: form.base, current: '', next: draft.base === 'gross' ? form.baseGross : form.baseBasic });
    rows.push({
      field: form.defaultRate,
      current: '',
      next: draft.defaultRate.trim() ? `${formatRate(Number(draft.defaultRate))}%` : payrollCopy.common.none,
    });
  }
  if (draft.calculationType === 'formula') {
    const rule = parseFormulaText(draft.formulaText).rule;
    rows.push({ field: form.formulaReads, current: '', next: (rule && safeDescribeFormula(rule)) ?? payrollCopy.common.none });
  }
  return rows;
}

function componentChanges(component: PayComponentRecord, draft: PayComponentDraft): FieldRow[] {
  const currentRows = summarizeDraft(draftFromComponent(component, component.type));
  const nextRows = summarizeDraft(draft);
  const fields = Array.from(new Set([...currentRows, ...nextRows].map((row) => row.field)));
  return fields
    .map((field) => ({
      field,
      current: currentRows.find((r) => r.field === field)?.next ?? payrollCopy.common.none,
      next: nextRows.find((r) => r.field === field)?.next ?? payrollCopy.common.none,
    }))
    .filter((row) => row.current !== row.next);
}

function ComponentReviewBody({ review }: { review: ReviewState }) {
  const reviewCopy = payrollCopy.componentReview;

  if (review.mode === 'delete') {
    return <p className="text-sm text-secondary">{reviewCopy.deleteBody(review.component.name)}</p>;
  }

  const nextRows = summarizeDraft(review.draft);

  if (review.mode === 'create') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-secondary">{reviewCopy.createIntro}</p>
        <dl className="rounded-lg border border-base divide-y divide-[rgb(var(--border-base))] text-sm">
          {nextRows.map((row) => (
            <div key={row.field} className="flex gap-4 px-4 py-2.5">
              <dt className="w-40 shrink-0 text-secondary">{row.field}</dt>
              <dd className="text-primary font-medium break-words min-w-0">{row.next}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-secondary">{reviewCopy.createImpact}</p>
      </div>
    );
  }

  const changes = componentChanges(review.component, review.draft);
  const affected = review.component.usage?.activeEmployeeCount ?? 0;

  return (
    <div className="space-y-3">
      {changes.length === 0 ? (
        <p className="text-sm text-secondary">{reviewCopy.noChanges}</p>
      ) : (
        <div className="rounded-lg border border-base overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--bg-muted))] text-xs text-secondary">
              <tr>
                <th className="text-left font-medium px-4 py-2">{reviewCopy.field}</th>
                <th className="text-left font-medium px-4 py-2">{reviewCopy.current}</th>
                <th className="text-left font-medium px-4 py-2">{reviewCopy.next}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-base))]">
              {changes.map((row) => (
                <tr key={row.field}>
                  <td className="px-4 py-2.5 text-secondary">{row.field}</td>
                  <td className="px-4 py-2.5 text-secondary line-through decoration-error-400/60 break-words">{row.current}</td>
                  <td className="px-4 py-2.5 text-primary font-medium break-words">{row.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div
        className={`rounded-lg px-4 py-3 text-sm ${
          affected > 0
            ? 'bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 text-warning-800 dark:text-warning-200'
            : 'bg-[rgb(var(--bg-muted))] text-secondary'
        }`}
      >
        <p className="font-medium">{reviewCopy.editImpact(affected)}</p>
        <p className="mt-0.5 opacity-90">{reviewCopy.finalizedNote}</p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  tone,
  value,
  label,
  hint,
  loading,
}: {
  icon: typeof Users;
  tone: 'success' | 'warning' | 'accent';
  value: number;
  label: string;
  hint?: string;
  loading: boolean;
}) {
  const tones = {
    success: 'bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400',
    warning: 'bg-warning-50 dark:bg-warning-950/40 text-warning-600 dark:text-warning-400',
    accent: 'bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400',
  };
  return (
    <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
      <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-primary tabular-nums">{loading ? '–' : value}</div>
        <div className="text-xs text-secondary">
          {label}
          {hint ? <span className="text-muted"> · {hint}</span> : null}
        </div>
      </div>
    </div>
  );
}
