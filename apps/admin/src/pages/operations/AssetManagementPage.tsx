import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  History,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import {
  ASSET_CATEGORY_LABELS,
  type AssetCategory,
  type CompanyAssetRecord,
  type EmployeeAssetAssignmentRecord,
} from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { CompanySelector } from '@/components/org/CompanySelector';
import { AssignAssetModal } from '@/components/assets/AssignAssetModal';
import { ReturnAssetModal, type ReturnableAsset } from '@/components/assets/ReturnAssetModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable, DataTableBody, DataTableHead } from '@/components/ui/DataTable';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Toggle';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { createCompanyAsset, listAssetAssignments, listCompanyAssets } from '@/lib/assets-api';
import {
  ASSET_STATUS_META,
  formatAssetDate,
  formatAssetValue,
  warrantyState,
} from '@/lib/assets-display';
import { getEmployee } from '@/lib/employees-api';
import { ApiError } from '@/lib/tenant-api-client';

type StatusTab = 'all' | 'assigned' | 'available' | 'in_repair' | 'retired';

const CATEGORIES = Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[];

function isStatusTab(value: string | null): value is StatusTab {
  return value === 'all' || value === 'assigned' || value === 'available' || value === 'in_repair' || value === 'retired';
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

function toReturnable(asset: CompanyAssetRecord): ReturnableAsset {
  return {
    id: asset.id,
    name: asset.name,
    assetTag: asset.assetTag,
    holderName: asset.assignedEmployeeName,
    assignedAt: asset.assignedAt,
    conditionOnAssign: asset.conditionOnAssign,
  };
}

const EMPTY_NEW_ASSET = {
  name: '',
  assetTag: '',
  category: 'laptop' as AssetCategory,
  serialNumber: '',
  purchaseDate: '',
  warrantyExpiryDate: '',
  purchaseValue: '',
  currency: '',
  notes: '',
};

export function AssetManagementPage() {
  const { companyId } = useCompany();
  const { openEmployee } = useNav();
  const canEdit = usePermission('employee', 'edit');
  const [params, setParams] = useSearchParams();

  const statusParam = params.get('status');
  const tab: StatusTab = isStatusTab(statusParam) ? statusParam : 'all';
  const employeeFilter = params.get('employee');
  const selectedAssetId = params.get('asset');

  const [assets, setAssets] = useState<CompanyAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<AssetCategory | ''>('');
  const [employeeName, setEmployeeName] = useState<string | null>(null);

  const [history, setHistory] = useState<EmployeeAssetAssignmentRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [assignTarget, setAssignTarget] = useState<{ asset: CompanyAssetRecord | null } | null>(null);
  const [returnTarget, setReturnTarget] = useState<CompanyAssetRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newAsset, setNewAsset] = useState(EMPTY_NEW_ASSET);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      setAssets(await listCompanyAssets(companyId));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load assets'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!employeeFilter) {
      setEmployeeName(null);
      return;
    }
    const holder = assets.find((asset) => asset.assignedEmployeeId === employeeFilter);
    if (holder?.assignedEmployeeName) {
      setEmployeeName(holder.assignedEmployeeName);
      return;
    }
    let cancelled = false;
    getEmployee(employeeFilter)
      .then((emp) => !cancelled && setEmployeeName(emp.fullName))
      .catch(() => !cancelled && setEmployeeName('Selected employee'));
    return () => {
      cancelled = true;
    };
  }, [employeeFilter, assets]);

  const selectedAsset = useMemo(
    () => (selectedAssetId ? assets.find((asset) => asset.id === selectedAssetId) ?? null : null),
    [assets, selectedAssetId],
  );

  const loadHistory = useCallback(
    async (assetId: string) => {
      if (!companyId) return;
      setHistoryLoading(true);
      try {
        setHistory(await listAssetAssignments(companyId, { assetId }));
      } catch (err) {
        setError(errorMessage(err, 'Failed to load asset history'));
      } finally {
        setHistoryLoading(false);
      }
    },
    [companyId],
  );

  useEffect(() => {
    if (selectedAssetId) void loadHistory(selectedAssetId);
    else setHistory([]);
  }, [selectedAssetId, loadHistory]);

  const afterChange = async (message: string, updates?: string[]) => {
    await load();
    if (selectedAssetId) await loadHistory(selectedAssetId);
    setError(null);
    setNotice([message, ...(updates ?? [])].join(' · '));
  };

  const scoped = useMemo(
    () =>
      assets.filter(
        (asset) =>
          (!employeeFilter || asset.assignedEmployeeId === employeeFilter) &&
          (!category || asset.category === category),
      ),
    [assets, employeeFilter, category],
  );

  const counts = useMemo(
    () => ({
      all: scoped.length,
      assigned: scoped.filter((a) => a.status === 'assigned').length,
      available: scoped.filter((a) => a.status === 'available').length,
      in_repair: scoped.filter((a) => a.status === 'in_repair').length,
      retired: scoped.filter((a) => a.status === 'retired').length,
    }),
    [scoped],
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return scoped.filter(
      (asset) =>
        (tab === 'all' || asset.status === tab) &&
        (!term ||
          [asset.name, asset.assetTag, asset.serialNumber ?? '', asset.assignedEmployeeName ?? '']
            .some((value) => value.toLowerCase().includes(term))),
    );
  }, [scoped, tab, search]);

  const warrantyAttention = assets.filter((asset) => {
    const state = warrantyState(asset.warrantyExpiryDate);
    return asset.status !== 'retired' && (state === 'expired' || state === 'expiring');
  }).length;

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'available', label: 'Available' },
    ...(counts.in_repair > 0 ? [{ key: 'in_repair' as const, label: 'In repair' }] : []),
    ...(counts.retired > 0 ? [{ key: 'retired' as const, label: 'Retired' }] : []),
  ];

  const handleCreate = async () => {
    if (!companyId) return;
    const value = newAsset.purchaseValue.trim();
    if (value && !/^\d+(\.\d{1,2})?$/.test(value)) {
      setCreateError('Purchase value must be a number with up to 2 decimals.');
      return;
    }
    if (newAsset.purchaseDate && newAsset.warrantyExpiryDate && newAsset.warrantyExpiryDate < newAsset.purchaseDate) {
      setCreateError('Warranty expiry cannot be before the purchase date.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createCompanyAsset(companyId, {
        name: newAsset.name.trim(),
        assetTag: newAsset.assetTag.trim(),
        category: newAsset.category,
        serialNumber: newAsset.serialNumber.trim() || undefined,
        purchaseDate: newAsset.purchaseDate || undefined,
        warrantyExpiryDate: newAsset.warrantyExpiryDate || undefined,
        purchaseValue: value ? Number(value) : undefined,
        currency: newAsset.currency.trim().toUpperCase() || undefined,
        notes: newAsset.notes.trim() || undefined,
      });
      setCreateOpen(false);
      setNewAsset(EMPTY_NEW_ASSET);
      await afterChange(`${created.name} (${created.assetTag}) added to the register.`);
    } catch (err) {
      setCreateError(errorMessage(err, 'Failed to create asset'));
    } finally {
      setCreating(false);
    }
  };

  if (!companyId) {
    return (
      <div className="p-4 lg:p-6">
        <CompanySelector />
        <div className="mt-6 rounded-xl border border-dashed border-strong px-6 py-12 text-center text-sm text-secondary">
          Select a company to view its asset register.
        </div>
      </div>
    );
  }

  const banners = (
    <>
      {error ? (
        <div className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-success-700 dark:text-success-400 bg-success-50 dark:bg-success-950/30 border border-success-200 dark:border-success-800 rounded-lg px-4 py-2"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-muted hover:text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </>
  );

  const modals = (
    <>
      <AssignAssetModal
        open={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        companyId={companyId}
        asset={assignTarget?.asset ?? null}
        onAssigned={(assignment) =>
          afterChange(`${assignment.assetName} assigned to ${assignment.employeeName}.`, assignment.checklistUpdates)
        }
      />
      <ReturnAssetModal
        open={returnTarget !== null}
        onClose={() => setReturnTarget(null)}
        asset={returnTarget ? toReturnable(returnTarget) : null}
        onReturned={(assignment) =>
          afterChange(`${assignment.assetName} returned by ${assignment.employeeName}.`, assignment.checklistUpdates)
        }
      />
    </>
  );

  if (selectedAssetId) {
    if (loading && !selectedAsset) {
      return (
        <div className="flex items-center justify-center py-16 text-secondary">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading asset…
        </div>
      );
    }
    if (!selectedAsset) {
      return (
        <div className="p-8 text-center text-sm space-y-4">
          <p className="text-secondary">This asset is not in the selected company's register.</p>
          <Button variant="secondary" onClick={() => updateParams({ asset: null })}>
            Back to asset register
          </Button>
        </div>
      );
    }
    const status = ASSET_STATUS_META[selectedAsset.status];
    const warranty = warrantyState(selectedAsset.warrantyExpiryDate);
    return (
      <div className="mx-auto max-w-[1200px] space-y-5 p-4 lg:p-6">
        <button
          type="button"
          onClick={() => updateParams({ asset: null })}
          className="inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-accent-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to asset register
        </button>
        {banners}

        <Card>
          <CardBody className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400">
                <Package className="h-7 w-7" />
              </div>
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-primary">{selectedAsset.name}</h1>
                  <Badge tone={status.tone} dot>
                    {status.label}
                  </Badge>
                </div>
                <p className="font-mono text-xs text-secondary">
                  {selectedAsset.assetTag}
                  {selectedAsset.serialNumber ? ` · S/N ${selectedAsset.serialNumber}` : ''}
                </p>
              </div>
            </div>
            {canEdit ? (
              <div className="flex gap-2">
                {selectedAsset.status === 'available' ? (
                  <Button onClick={() => setAssignTarget({ asset: selectedAsset })}>
                    <UserRound className="h-4 w-4" /> Assign
                  </Button>
                ) : null}
                {selectedAsset.status === 'assigned' ? (
                  <Button variant="secondary" onClick={() => setReturnTarget(selectedAsset)}>
                    <RotateCcw className="h-4 w-4" /> Return
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardBody>
        </Card>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  <History className="h-4 w-4 text-muted" /> Assignment history
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              {historyLoading ? (
                <div className="flex items-center text-sm text-secondary">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-secondary">Never assigned.</p>
              ) : (
                <ol className="space-y-4">
                  {history.map((event) => (
                    <li key={event.id} className="flex gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          event.status === 'active'
                            ? 'bg-accent-50 text-accent-600 dark:bg-accent-950/40'
                            : 'bg-[rgb(var(--bg-muted))] text-muted'
                        }`}
                      >
                        {event.status === 'active' ? <UserRound className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="text-sm font-semibold text-primary hover:text-accent-600"
                            onClick={() => openEmployee(event.employeeId)}
                          >
                            {event.employeeName}
                          </button>
                          {event.status === 'active' ? <Badge tone="accent">Current holder</Badge> : null}
                          {event.onboardingTaskId ? <Badge tone="neutral">Onboarding</Badge> : null}
                          {event.offboardingTaskId ? <Badge tone="neutral">Offboarding</Badge> : null}
                        </div>
                        <div className="mt-0.5 text-xs text-secondary">
                          Assigned {formatAssetDate(event.assignedAt)}
                          {event.conditionOnAssign ? ` (${event.conditionOnAssign})` : ''}
                          {event.returnedAt
                            ? ` · Returned ${formatAssetDate(event.returnedAt)}${
                                event.conditionOnReturn ? ` (${event.conditionOnReturn})` : ''
                              }`
                            : ''}
                        </div>
                        {event.notes ? <p className="mt-0.5 text-xs text-muted">{event.notes}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="space-y-3 text-sm">
                {[
                  ['Category', ASSET_CATEGORY_LABELS[selectedAsset.category]],
                  ['Purchased', formatAssetDate(selectedAsset.purchaseDate)],
                  ['Purchase value', formatAssetValue(selectedAsset.purchaseValue, selectedAsset.currency)],
                  [
                    'Warranty until',
                    `${formatAssetDate(selectedAsset.warrantyExpiryDate)}${
                      warranty === 'expired' ? ' (expired)' : warranty === 'expiring' ? ' (expiring soon)' : ''
                    }`,
                  ],
                  ['Held by', selectedAsset.assignedEmployeeName ?? '—'],
                  ['Notes', selectedAsset.notes ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-base pb-3 last:border-0 last:pb-0">
                    <dt className="text-secondary">{label}</dt>
                    <dd className="text-right font-medium text-primary">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        </div>
        {modals}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-bold text-primary">Asset Register</h1>
          <p className="mt-0.5 text-sm text-secondary">
            Company equipment, who holds it, and its condition at hand-over and return
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompanySelector />
          {canEdit ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setCreateError(null);
                  setNewAsset({ ...EMPTY_NEW_ASSET, currency: assets[0]?.currency ?? 'AUD' });
                  setCreateOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add asset
              </Button>
              <Button onClick={() => setAssignTarget({ asset: null })}>
                <UserRound className="h-4 w-4" /> Assign asset
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {banners}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total assets', value: assets.length, icon: Package, color: 'text-accent-600 bg-accent-50 dark:bg-accent-950/40' },
          { label: 'Assigned', value: assets.filter((a) => a.status === 'assigned').length, icon: UserRound, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40' },
          { label: 'Available', value: assets.filter((a) => a.status === 'available').length, icon: CheckCircle2, color: 'text-success-600 bg-success-50 dark:bg-success-950/40' },
          { label: 'Warranty expired or due in 60 days', value: warrantyAttention, icon: CalendarDays, color: 'text-warning-600 bg-warning-50 dark:bg-warning-950/40' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardBody className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-primary">{loading ? '—' : value}</div>
                <div className="text-xs text-secondary">{label}</div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-b border-base lg:flex-row lg:items-end lg:justify-between">
        <div className="flex gap-1 overflow-x-auto overflow-y-hidden scrollbar-thin">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => updateParams({ status: key === 'all' ? null : key })}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                tab === key
                  ? 'border-accent-600 text-accent-600'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              {label} <span className="text-xs text-muted">({counts[key]})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 pb-2 sm:flex-row">
          <Select
            className="sm:w-40"
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as AssetCategory | '')}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {ASSET_CATEGORY_LABELS[key]}
              </option>
            ))}
          </Select>
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-[9px] h-4 w-4 text-muted" />
            <Input
              className="pl-9"
              value={search}
              placeholder="Search name, tag, serial, holder"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {employeeFilter ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-secondary">Held by</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-base bg-[rgb(var(--bg-muted))] px-3 py-1 font-medium text-primary">
            {employeeName ?? '…'}
            <button
              type="button"
              aria-label="Clear employee filter"
              className="text-muted hover:text-primary"
              onClick={() => updateParams({ employee: null })}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-secondary">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading assets…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-strong px-6 py-12 text-center text-sm text-secondary">
          {assets.length === 0
            ? 'The register is empty. Add the first asset to start tracking assignments.'
            : employeeFilter && scoped.length === 0
              ? `${employeeName ?? 'This employee'} holds no company assets.`
              : 'No assets match these filters.'}
        </div>
      ) : (
        <Card>
          <CardBody className="p-0">
            <DataTable>
              <DataTableHead>
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Asset</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase hidden md:table-cell">
                    Category
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Status</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Held by</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase hidden lg:table-cell">
                    Warranty
                  </th>
                  <th className="w-32" />
                </tr>
              </DataTableHead>
              <DataTableBody>
                {rows.map((asset) => {
                  const status = ASSET_STATUS_META[asset.status];
                  const warranty = warrantyState(asset.warrantyExpiryDate);
                  return (
                    <tr
                      key={asset.id}
                      className="hover:bg-[rgb(var(--bg-hover))] cursor-pointer"
                      onClick={() => updateParams({ asset: asset.id })}
                    >
                      <td className="px-5 py-3">
                        <div className="text-sm font-semibold text-primary">{asset.name}</div>
                        <div className="font-mono text-[11px] text-muted">
                          {asset.assetTag}
                          {asset.serialNumber ? ` · ${asset.serialNumber}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-secondary hidden md:table-cell">
                        {ASSET_CATEGORY_LABELS[asset.category]}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={status.tone} dot>
                          {status.label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        {asset.assignedEmployeeName ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={asset.assignedEmployeeName} size="sm" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-primary truncate">{asset.assignedEmployeeName}</div>
                              <div className="text-xs text-muted truncate">
                                Since {formatAssetDate(asset.assignedAt)}
                                {asset.conditionOnAssign ? ` · ${asset.conditionOnAssign}` : ''}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm hidden lg:table-cell">
                        <span
                          className={
                            warranty === 'expired'
                              ? 'text-error-600'
                              : warranty === 'expiring'
                                ? 'text-warning-700'
                                : 'text-secondary'
                          }
                        >
                          {formatAssetDate(asset.warrantyExpiryDate)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && asset.status === 'available' ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssignTarget({ asset });
                              }}
                            >
                              Assign
                            </Button>
                          ) : null}
                          {canEdit && asset.status === 'assigned' ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReturnTarget(asset);
                              }}
                            >
                              Return
                            </Button>
                          ) : null}
                          <ChevronRight className="h-4 w-4 text-muted" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </CardBody>
        </Card>
      )}

      {modals}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add asset to register"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={creating || !newAsset.name.trim() || !newAsset.assetTag.trim()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add asset
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {createError ? (
            <div className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{createError}</span>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-name">Name *</Label>
              <Input
                id="new-name"
                maxLength={200}
                value={newAsset.name}
                placeholder='MacBook Pro 14"'
                onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="new-tag">Asset tag *</Label>
              <Input
                id="new-tag"
                maxLength={60}
                value={newAsset.assetTag}
                placeholder="AST-LAP-1050"
                onChange={(e) => setNewAsset({ ...newAsset, assetTag: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-category">Category</Label>
              <Select
                id="new-category"
                value={newAsset.category}
                onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value as AssetCategory })}
              >
                {CATEGORIES.map((key) => (
                  <option key={key} value={key}>
                    {ASSET_CATEGORY_LABELS[key]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="new-serial">Serial number</Label>
              <Input
                id="new-serial"
                maxLength={120}
                value={newAsset.serialNumber}
                onChange={(e) => setNewAsset({ ...newAsset, serialNumber: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-purchased">Purchase date</Label>
              <Input
                id="new-purchased"
                type="date"
                value={newAsset.purchaseDate}
                onChange={(e) => setNewAsset({ ...newAsset, purchaseDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="new-warranty">Warranty expiry</Label>
              <Input
                id="new-warranty"
                type="date"
                min={newAsset.purchaseDate || undefined}
                value={newAsset.warrantyExpiryDate}
                onChange={(e) => setNewAsset({ ...newAsset, warrantyExpiryDate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr,7rem]">
            <div>
              <Label htmlFor="new-value">Purchase value</Label>
              <Input
                id="new-value"
                inputMode="decimal"
                value={newAsset.purchaseValue}
                placeholder="0.00"
                onChange={(e) => setNewAsset({ ...newAsset, purchaseValue: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="new-currency">Currency</Label>
              <Input
                id="new-currency"
                maxLength={3}
                value={newAsset.currency}
                onChange={(e) => setNewAsset({ ...newAsset, currency: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="new-notes">Notes</Label>
            <Textarea
              id="new-notes"
              rows={2}
              maxLength={1000}
              value={newAsset.notes}
              onChange={(e) => setNewAsset({ ...newAsset, notes: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
