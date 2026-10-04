import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, AlertTriangle, BellRing, FileText, Loader2, Plus, Search, X } from 'lucide-react';
import type {
  EmploymentContractDisplayStatus,
  EmploymentContractRecord,
  EmploymentContractType,
} from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/EmptyState';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { ContractStatusBadge, ContractTypeBadge } from '@/components/contracts/ContractBadges';
import { ContractCreateModal } from '@/components/contracts/ContractCreateModal';
import { useNav } from '@/context/NavContext';
import { CONTRACT_TYPE_LABELS, listEmploymentContracts } from '@/lib/contracts-api';
import {
  daysUntil,
  endsWithin,
  formatContractDate,
  formatContractPay,
  relativeDays,
} from '@/lib/contract-form';
import { ApiError } from '@/lib/tenant-api-client';

type StatusFilter =
  | 'all'
  | 'active'
  | 'expiring_soon'
  | 'pending_approval'
  | 'draft'
  | 'expired'
  | 'terminated';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'expiring_soon', label: 'Expiring soon' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'draft', label: 'Draft' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
];

/** "Active" includes contracts that are active but close to their end date. */
const STATUS_MATCH: Record<Exclude<StatusFilter, 'all'>, EmploymentContractDisplayStatus[]> = {
  active: ['active', 'expiring_soon'],
  expiring_soon: ['expiring_soon'],
  pending_approval: ['pending_approval'],
  draft: ['draft'],
  expired: ['expired'],
  terminated: ['terminated'],
};

const ENDING_OPTIONS = [
  { value: '', label: 'Any end date' },
  { value: '30', label: 'Expiring within 30 days' },
  { value: '60', label: 'Expiring within 60 days' },
  { value: '90', label: 'Expiring within 90 days' },
];

function readStatus(value: string | null): StatusFilter {
  return STATUS_OPTIONS.some((o) => o.value === value) ? (value as StatusFilter) : 'all';
}

function readType(value: string | null): EmploymentContractType | '' {
  return value && value in CONTRACT_TYPE_LABELS ? (value as EmploymentContractType) : '';
}

function readEnding(value: string | null): number | null {
  return ENDING_OPTIONS.some((o) => o.value && o.value === value) ? Number(value) : null;
}

function EndDateCell({ contract }: { contract: EmploymentContractRecord }) {
  if (!contract.endDate) return <span className="text-muted">Open-ended</span>;
  const remaining = daysUntil(contract.endDate);
  const live = contract.status === 'active';
  return (
    <div>
      <div className="text-secondary">{formatContractDate(contract.endDate)}</div>
      {live && remaining !== null && remaining <= 90 ? (
        <div className={`text-xs ${remaining < 0 ? 'text-error-600' : contract.displayStatus === 'expiring_soon' ? 'text-warning-600' : 'text-muted'}`}>
          {remaining < 0 ? 'Ended' : 'Ends'} {relativeDays(remaining)}
        </div>
      ) : null}
    </div>
  );
}

function ContractsContent({ companyId }: { companyId: string }) {
  const { openContract, navigate } = useNav();
  const canCreate = usePermission('employee', 'create');
  const [params, setParams] = useSearchParams();
  const [contracts, setContracts] = useState<EmploymentContractRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const status = readStatus(params.get('status'));
  const type = readType(params.get('type'));
  const ending = readEnding(params.get('ending'));

  const setFilter = (key: 'status' | 'type' | 'ending', value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value && value !== 'all') next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setContracts(await listEmploymentContracts(companyId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load contracts');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      if (q && !`${c.employeeName ?? ''} ${c.employeeNumber ?? ''}`.toLowerCase().includes(q)) return false;
      if (status !== 'all' && !STATUS_MATCH[status].includes(c.displayStatus)) return false;
      if (type && c.contractType !== type) return false;
      if (ending !== null && !endsWithin(c, ending)) return false;
      return true;
    });
  }, [contracts, search, status, type, ending]);

  const counts = useMemo(
    () => ({
      active: contracts.filter((c) => STATUS_MATCH.active.includes(c.displayStatus)).length,
      expiring: contracts.filter((c) => c.displayStatus === 'expiring_soon').length,
      pending: contracts.filter((c) => c.displayStatus === 'pending_approval').length,
      draft: contracts.filter((c) => c.displayStatus === 'draft').length,
    }),
    [contracts],
  );

  const filtersActive = status !== 'all' || type !== '' || ending !== null || search.trim() !== '';
  const clearFilters = () => {
    setSearch('');
    setParams(new URLSearchParams(), { replace: true });
  };

  const summary: { label: string; value: number; onClick: () => void; active: boolean; tone?: string }[] = [
    {
      label: 'Active',
      value: counts.active,
      onClick: () => setFilter('status', status === 'active' ? 'all' : 'active'),
      active: status === 'active' && ending === null,
    },
    {
      label: 'Expiring soon',
      value: counts.expiring,
      onClick: () => setFilter('status', status === 'expiring_soon' ? 'all' : 'expiring_soon'),
      active: status === 'expiring_soon',
      tone: counts.expiring > 0 ? 'text-warning-600' : undefined,
    },
    {
      label: 'Pending approval',
      value: counts.pending,
      onClick: () => setFilter('status', status === 'pending_approval' ? 'all' : 'pending_approval'),
      active: status === 'pending_approval',
    },
    {
      label: 'Drafts',
      value: counts.draft,
      onClick: () => setFilter('status', status === 'draft' ? 'all' : 'draft'),
      active: status === 'draft',
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Employment Contracts</h1>
          <p className="text-sm text-secondary mt-0.5">
            Contract terms, renewals and signed documents for every employee.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <Button variant="secondary" onClick={() => navigate('emp-contract-expiry')}>
            <BellRing className="h-4 w-4" /> Expiry alerts
          </Button>
          {canCreate ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New contract
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div className="flex items-start gap-2 text-sm text-warning-800 dark:text-warning-300 bg-warning-50 dark:bg-warning-950/30 border border-warning-200 dark:border-warning-800 rounded-lg px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-3 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            aria-pressed={item.active}
            className={`text-left rounded-xl border px-4 py-3 transition-colors surface ${
              item.active
                ? 'border-accent-500 ring-2 ring-accent-500/20'
                : 'border-base hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            <div className={`text-2xl font-semibold ${item.tone ?? 'text-primary'}`}>
              {loading ? '–' : item.value}
            </div>
            <div className="text-xs text-secondary mt-0.5">{item.label}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardBody className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by employee name or number…"
              aria-label="Search contracts"
              className="pl-9"
            />
          </div>
          <Select
            aria-label="Status"
            value={status}
            onChange={(e) => setFilter('status', e.target.value)}
            className="lg:w-44 h-9"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Contract type"
            value={type}
            onChange={(e) => setFilter('type', e.target.value)}
            className="lg:w-40 h-9"
          >
            <option value="">All types</option>
            {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="End date"
            value={ending === null ? '' : String(ending)}
            onChange={(e) => setFilter('ending', e.target.value)}
            className="lg:w-52 h-9"
          >
            {ENDING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          {filtersActive ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" /> Clear
            </Button>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={contracts.length === 0 ? 'No contracts yet' : 'No contracts match these filters'}
              description={
                contracts.length === 0
                  ? 'Create a contract here or from an employee’s profile.'
                  : 'Try a different status, type or end-date range.'
              }
              action={
                contracts.length === 0
                  ? canCreate
                    ? { label: 'New contract', onClick: () => setCreateOpen(true) }
                    : undefined
                  : { label: 'Clear filters', onClick: clearFilters }
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Employee</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Type</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">Start</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">End</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">Pay</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => openContract(c.id)}
                      className="hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            openContract(c.id);
                          }}
                        >
                          <div className="font-medium text-primary">{c.employeeName ?? '—'}</div>
                          <div className="text-xs text-muted">{c.employeeNumber ?? c.employeeId.slice(0, 8)}</div>
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <ContractTypeBadge type={c.contractType} />
                      </td>
                      <td className="px-5 py-3 text-secondary hidden md:table-cell">{formatContractDate(c.startDate)}</td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <EndDateCell contract={c} />
                      </td>
                      <td className="px-5 py-3 text-secondary hidden lg:table-cell">{formatContractPay(c)}</td>
                      <td className="px-5 py-3">
                        <ContractStatusBadge status={c.displayStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-2.5 text-xs text-muted border-t border-base">
                Showing {filtered.length} of {contracts.length} contracts
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <ContractCreateModal
        open={createOpen}
        companyId={companyId}
        onClose={() => setCreateOpen(false)}
        onCreated={(created, warning) => {
          setCreateOpen(false);
          if (warning) {
            setNotice(warning);
            void load();
          } else {
            openContract(created.id);
          }
        }}
      />
    </div>
  );
}

export function ContractsPage() {
  return (
    <OrgPageState>
      {(companyId) => <ContractsContent companyId={companyId} />}
    </OrgPageState>
  );
}
