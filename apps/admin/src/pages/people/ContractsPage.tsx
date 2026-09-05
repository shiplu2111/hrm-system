import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  AlertTriangle,
  FileText,
  Upload,
  Check,
  Loader2,
} from 'lucide-react';
import type {
  EmploymentContractDisplayStatus,
  EmploymentContractRecord,
  EmploymentContractType,
  PayFrequency,
} from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { useNav } from '@/context/NavContext';
import { listEmployees } from '@/lib/employees-api';
import {
  CONTRACT_TYPE_LABELS,
  DISPLAY_STATUS_LABELS,
  createEmploymentContract,
  listEmploymentContracts,
  uploadContractDocument,
  type CreateEmploymentContractInput,
} from '@/lib/contracts-api';
import { ApiError } from '@/lib/tenant-api-client';

const statusTone: Record<
  EmploymentContractDisplayStatus,
  'success' | 'warning' | 'error' | 'neutral'
> = {
  active: 'success',
  expiring_soon: 'warning',
  expired: 'error',
  draft: 'neutral',
  pending_approval: 'warning',
  terminated: 'neutral',
};

const typeTone: Record<
  EmploymentContractType,
  'accent' | 'success' | 'warning' | 'info'
> = {
  permanent: 'accent',
  fixed_term: 'warning',
  casual: 'info',
  project_based: 'info',
};

const DISPLAY_FILTER: { value: string; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'expiring_soon', label: 'Expiring Soon' },
  { value: 'expired', label: 'Expired' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'terminated', label: 'Terminated' },
];

const emptyForm = {
  employeeId: '',
  contractType: 'permanent' as EmploymentContractType,
  startDate: '',
  endDate: '',
  probationEndDate: '',
  workingHoursPerWeek: '40',
  payRate: '',
  payFrequency: 'monthly' as PayFrequency,
  currency: 'AUD',
  leaveEntitlementDays: '25',
  overtimeType: 'multiplier_after_weekly_hours',
  overtimeThreshold: '40',
  overtimeMultiplier: '1.5',
  noticePeriodDays: '30',
  employerNoticeDays: '30',
  terminationConditions: '',
  activate: false,
  docLabel: 'Signed Contract',
  docFile: null as File | null,
};

function formatPayDisplay(contract: EmploymentContractRecord): string {
  if (contract.payRate == null) return '—';
  const formatted = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: contract.currency,
    maximumFractionDigits: 2,
  }).format(contract.payRate);
  const suffix: Record<string, string> = {
    hourly: '/hr',
    weekly: '/wk',
    biweekly: '/fortnight',
    monthly: '/mo',
    annual: '/yr',
  };
  return contract.payFrequency
    ? `${formatted}${suffix[contract.payFrequency] ?? ''}`
    : formatted;
}

function ContractsContent({ companyId }: { companyId: string }) {
  const { openContract } = useNav();
  const [contracts, setContracts] = useState<EmploymentContractRecord[]>([]);
  const [employees, setEmployees] = useState<
    { id: string; fullName: string; employeeNumber: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contractRows, employeeRows] = await Promise.all([
        listEmploymentContracts(companyId),
        listEmployees(companyId),
      ]);
      setContracts(contractRows);
      setEmployees(
        employeeRows.map((e) => ({
          id: e.id,
          fullName: e.fullName,
          employeeNumber: e.employeeNumber,
        })),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      const name = c.employeeName?.toLowerCase() ?? '';
      if (search && !name.includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && c.displayStatus !== statusFilter) return false;
      return true;
    });
  }, [contracts, search, statusFilter]);

  const expiringCount = contracts.filter(
    (c) => c.displayStatus === 'expiring_soon',
  ).length;

  const handleCreate = async () => {
    if (!form.employeeId || !form.startDate) return;
    setSaving(true);
    setError(null);
    try {
      const input: CreateEmploymentContractInput = {
        employeeId: form.employeeId,
        contractType: form.contractType,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        probationEndDate: form.probationEndDate || undefined,
        workingHoursPerWeek: form.workingHoursPerWeek
          ? Number(form.workingHoursPerWeek)
          : undefined,
        payRate: form.payRate ? Number(form.payRate) : undefined,
        payFrequency: form.payFrequency,
        currency: form.currency,
        leaveEntitlementDays: form.leaveEntitlementDays
          ? Number(form.leaveEntitlementDays)
          : undefined,
        noticePeriodDays: form.noticePeriodDays
          ? Number(form.noticePeriodDays)
          : undefined,
        employerNoticeDays: form.employerNoticeDays
          ? Number(form.employerNoticeDays)
          : undefined,
        terminationConditions: form.terminationConditions || undefined,
        activate: form.activate,
      };

      if (form.overtimeType !== 'none') {
        input.overtimeRule = {
          type: form.overtimeType as
            | 'multiplier_after_weekly_hours'
            | 'multiplier_after_daily_hours',
          thresholdHours: Number(form.overtimeThreshold) || undefined,
          multiplier: Number(form.overtimeMultiplier) || undefined,
        };
      } else {
        input.overtimeRule = { type: 'none' };
      }

      const created = await createEmploymentContract(companyId, input);

      if (form.docFile) {
        await uploadContractDocument(
          created.id,
          form.docLabel.trim() || 'Contract Document',
          form.docFile,
        );
      }

      setCreateOpen(false);
      setForm(emptyForm);
      await load();
      openContract(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create contract');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Contract Management</h1>
          <p className="text-sm text-secondary mt-0.5">
            {filtered.length} contracts · {expiringCount} expiring soon
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create Contract
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <Card>
        <CardBody className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by employee name..."
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-auto h-9"
          >
            {DISPLAY_FILTER.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">
                    Start Date
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">
                    End Date
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">
                    Pay Rate
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="w-12 px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-secondary">
                      No contracts found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => openContract(c.id)}
                      className="hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                          </div>
                          <div>
                            <div className="font-medium text-primary">
                              {c.employeeName ?? '—'}
                            </div>
                            <div className="text-xs text-muted">
                              {c.employeeNumber ?? c.employeeId.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={typeTone[c.contractType]}>
                          {CONTRACT_TYPE_LABELS[c.contractType]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-secondary hidden md:table-cell">
                        {c.startDate}
                      </td>
                      <td className="px-5 py-3 text-secondary hidden md:table-cell">
                        {c.endDate ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-secondary hidden lg:table-cell">
                        {formatPayDisplay(c)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {c.displayStatus === 'expiring_soon' && (
                            <AlertTriangle className="h-3.5 w-3.5 text-warning-500" />
                          )}
                          <Badge tone={statusTone[c.displayStatus]} dot>
                            {DISPLAY_STATUS_LABELS[c.displayStatus]}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={createOpen}
        onClose={() => !saving && setCreateOpen(false)}
        title="Create Contract"
        description="Define a new employment contract"
        size="xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleCreate()}
              disabled={saving || !form.employeeId || !form.startDate}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Create Contract
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Contract Basics
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Employee</Label>
                <Select
                  value={form.employeeId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, employeeId: e.target.value }))
                  }
                >
                  <option value="">Select employee...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.employeeNumber})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Contract Type</Label>
                <Select
                  value={form.contractType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      contractType: e.target.value as EmploymentContractType,
                    }))
                  }
                >
                  {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>End Date (if applicable)</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Probation
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Probation End Date</Label>
                <Input
                  type="date"
                  value={form.probationEndDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, probationEndDate: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Compensation & Working Hours
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pay Rate</Label>
                <Input
                  placeholder="e.g. 85000"
                  value={form.payRate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, payRate: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Pay Frequency</Label>
                <Select
                  value={form.payFrequency}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      payFrequency: e.target.value as PayFrequency,
                    }))
                  }
                >
                  <option value="monthly">Monthly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="weekly">Weekly</option>
                  <option value="hourly">Hourly</option>
                  <option value="annual">Annual</option>
                </Select>
              </div>
              <div>
                <Label>Working Hours / Week</Label>
                <Input
                  type="number"
                  value={form.workingHoursPerWeek}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, workingHoursPerWeek: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Leave Entitlement (days/year)</Label>
                <Input
                  type="number"
                  value={form.leaveEntitlementDays}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      leaveEntitlementDays: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Overtime Rule</Label>
                <Select
                  value={form.overtimeType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, overtimeType: e.target.value }))
                  }
                >
                  <option value="multiplier_after_weekly_hours">
                    1.5x after weekly hours
                  </option>
                  <option value="multiplier_after_daily_hours">
                    1.5x after daily hours
                  </option>
                  <option value="none">No OT</option>
                </Select>
              </div>
              <div>
                <Label>Notice Period (days)</Label>
                <Input
                  type="number"
                  value={form.noticePeriodDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, noticePeriodDays: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Termination Rules
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Termination Notice — Employer (days)</Label>
                <Input
                  type="number"
                  value={form.employerNoticeDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, employerNoticeDays: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Termination Conditions</Label>
                <Textarea
                  rows={3}
                  placeholder="Conditions under which contract may be terminated..."
                  value={form.terminationConditions}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      terminationConditions: e.target.value,
                    }))
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={form.activate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, activate: e.target.checked }))
                  }
                />
                Activate immediately (otherwise save as draft)
              </label>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Contract Document (optional)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Document Label</Label>
                <Input
                  value={form.docLabel}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, docLabel: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>File</Label>
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      docFile: e.target.files?.[0] ?? null,
                    }))
                  }
                />
              </div>
            </div>
            {!form.docFile && (
              <p className="text-xs text-muted mt-2 flex items-center gap-1">
                <Upload className="h-3.5 w-3.5" />
                Upload signed contract PDF after creation from the detail page.
              </p>
            )}
          </div>
        </div>
      </Modal>
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
