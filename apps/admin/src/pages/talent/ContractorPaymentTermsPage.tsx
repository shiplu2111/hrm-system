import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Layers,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type {
  ContractorContractRecord,
  ContractorPaymentStructure,
  ContractorPaymentTerms,
  ContractorRecord,
  GlContractorMappingRecord,
} from '@hrm/shared-types';
import { ContractorContractModal } from '@/components/contractors/ContractorContractModal';
import { ContractorPaymentTermsModal } from '@/components/contractors/ContractorPaymentTermsModal';
import { NonEmployeeApBanner } from '@/components/contractors/NonEmployeeApBanner';
import {
  AP_LEDGER_CARD_CLASS,
  AP_PRIMARY_BUTTON_CLASS,
  CONTRACTOR_KIND_BADGE_CLASSES,
  formatContractorDate,
  formatContractorMoney,
  sumMoneyStrings,
} from '@/components/contractors/contractor-ui.utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Form';
import { pathForPage } from '@/config/routes';
import { useCompany } from '@/context/CompanyContext';
import { listGlContractorMappings } from '@/lib/accounting-api';
import {
  BILLING_FREQUENCY_LABELS,
  CONTRACTOR_KIND_LABELS,
  CONTRACTOR_PAYMENT_STRUCTURE_LABELS,
  listContractorContracts,
  listContractors,
  PAYMENT_TERMS_DAYS,
  PAYMENT_TERMS_LABELS,
} from '@/lib/contractors-api';
import { listEmployees } from '@/lib/employees-api';
import { ApiError } from '@/lib/tenant-api-client';

type StructureFilter = 'all' | ContractorPaymentStructure;

const STRUCTURE_BADGE_CLASS: Record<ContractorPaymentStructure, string> = {
  fixed_project_fee:
    'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-300',
  milestone:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  hourly_invoice:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
};

const CONTRACT_STATUS_TONE: Record<
  ContractorContractRecord['status'],
  'success' | 'warning' | 'error' | 'neutral'
> = {
  active: 'success',
  draft: 'neutral',
  expired: 'error',
  terminated: 'error',
};

export function ContractorPaymentTermsPage() {
  const routerNavigate = useNavigate();
  const { companyId } = useCompany();
  const { can } = usePermissions();
  const canCreate = can('contractors', 'create');
  const canEdit = can('contractors', 'edit');
  const canViewPayrollGl = can('payroll', 'view');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [contractors, setContractors] = useState<ContractorRecord[]>([]);
  const [contracts, setContracts] = useState<ContractorContractRecord[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [glMappings, setGlMappings] = useState<GlContractorMappingRecord[]>([]);

  const [search, setSearch] = useState('');
  const [structureFilter, setStructureFilter] = useState<StructureFilter>('all');
  const [termsFilter, setTermsFilter] = useState<'all' | ContractorPaymentTerms>('all');

  const [newContractOpen, setNewContractOpen] = useState(false);
  const [editingContract, setEditingContract] =
    useState<ContractorContractRecord | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [contractorRows, contractRows, employeeRows, mappingRows] = await Promise.all([
        listContractors(companyId),
        listContractorContracts(companyId),
        listEmployees(companyId),
        canViewPayrollGl ? listGlContractorMappings(companyId).catch(() => []) : Promise.resolve([]),
      ]);
      setContractors(contractorRows);
      setContracts(contractRows);
      setEmployees(
        employeeRows.map((emp) => ({
          id: emp.id,
          name: emp.fullName ?? `${emp.firstName} ${emp.lastName}`,
        })),
      );
      setGlMappings(mappingRows);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Failed to load contractor payment terms setup',
      );
    } finally {
      setLoading(false);
    }
  }, [canViewPayrollGl, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const contractorById = useMemo(
    () => new Map(contractors.map((c) => [c.id, c])),
    [contractors],
  );

  const filteredContracts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      if (structureFilter !== 'all' && c.paymentStructure !== structureFilter) return false;
      if (termsFilter !== 'all' && c.paymentTerms !== termsFilter) return false;
      if (!q) return true;
      return (
        c.contractNumber.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.contractorName.toLowerCase().includes(q)
      );
    });
  }, [contracts, search, structureFilter, termsFilter]);

  const structureStats = useMemo(() => {
    const fixed = contracts.filter((c) => c.paymentStructure === 'fixed_project_fee');
    const milestone = contracts.filter((c) => c.paymentStructure === 'milestone');
    const hourly = contracts.filter((c) => c.paymentStructure === 'hourly_invoice');

    const fixedCap = sumMoneyStrings(
      fixed.map((c) => c.fixedFeeAmount ?? c.annualValue ?? '0'),
    );
    const totalMilestones = milestone.reduce((sum, c) => sum + c.milestones.length, 0);
    const paidMilestones = milestone.reduce(
      (sum, c) => sum + c.milestones.filter((m) => m.status === 'paid').length,
      0,
    );
    const hourlyRates = hourly
      .map((c) => Number(c.hourlyRate ?? 0))
      .filter((r) => r > 0);
    const avgHourly =
      hourlyRates.length > 0
        ? (hourlyRates.reduce((a, b) => a + b, 0) / hourlyRates.length).toFixed(2)
        : '0.00';

    return {
      fixedCount: fixed.length,
      fixedCap,
      milestoneCount: milestone.length,
      totalMilestones,
      paidMilestones,
      hourlyCount: hourly.length,
      avgHourly,
    };
  }, [contracts]);

  const expenseMapping = glMappings.find((m) => m.systemKey === 'contractor_expense');
  const payableMapping = glMappings.find((m) => m.systemKey === 'contractor_payable');

  if (loading && contracts.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[320px]">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <NonEmployeeApBanner
        activeScreen="payment-terms"
        title="Contractor Payment Terms Setup"
        subtitle="Configure Fixed Project Fee, Milestone Schedule, Hourly Billing Rates, and Net Settlement Rules separate from Employee Salary Structures"
        actions={
          canCreate ? (
            <Button
              className={AP_PRIMARY_BUTTON_CLASS}
              disabled={contractors.length === 0}
              onClick={() => setNewContractOpen(true)}
            >
              <Plus className="h-4 w-4" /> New Contract Terms
            </Button>
          ) : null
        }
      />

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-teal-300 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/40 px-4 py-3 text-sm text-teal-900 dark:text-teal-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {
            key: 'fixed_project_fee' as const,
            title: 'Fixed Project Fee',
            subtitle: 'Capped fixed contract amounts & periodic retainers',
            count: `${structureStats.fixedCount} contract(s)`,
            metric: formatContractorMoney(structureStats.fixedCap),
            metricLabel: 'Total capped value',
            icon: DollarSign,
          },
          {
            key: 'milestone' as const,
            title: 'Milestone-Based Schedule',
            subtitle: 'Invoices locked to deliverable acceptance criteria',
            count: `${structureStats.milestoneCount} contract(s)`,
            metric: `${structureStats.paidMilestones} / ${structureStats.totalMilestones}`,
            metricLabel: 'Milestones settled',
            icon: Layers,
          },
          {
            key: 'hourly_invoice' as const,
            title: 'Hourly Billing Rate',
            subtitle: 'Contracted hourly rate × billed contractor hours',
            count: `${structureStats.hourlyCount} contract(s)`,
            metric: `${formatContractorMoney(structureStats.avgHourly)}/hr`,
            metricLabel: 'Average contracted rate',
            icon: Clock,
          },
        ].map((model) => {
          const Icon = model.icon;
          const active = structureFilter === model.key;
          return (
            <button
              key={model.key}
              type="button"
              onClick={() => setStructureFilter((prev) => (prev === model.key ? 'all' : model.key))}
              className={`text-left rounded-xl border p-4 transition-all ${
                active
                  ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/35 ring-1 ring-teal-600 shadow-sm'
                  : 'border-teal-200/80 dark:border-teal-900/60 border-t-2 border-t-teal-600 bg-[rgb(var(--bg-surface))] hover:border-teal-400'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${STRUCTURE_BADGE_CLASS[model.key]}`}
                  >
                    {model.title}
                  </span>
                  <p className="text-xs text-secondary mt-2">{model.subtitle}</p>
                </div>
                <Icon className="h-5 w-5 text-teal-700 dark:text-teal-400 shrink-0" />
              </div>
              <div className="mt-3 pt-3 border-t border-dashed border-base flex items-baseline justify-between gap-2">
                <div>
                  <p className="text-[11px] text-muted">{model.metricLabel}</p>
                  <p className="text-base font-bold font-mono text-primary">{model.metric}</p>
                </div>
                <span className="text-xs font-medium text-teal-700 dark:text-teal-300">
                  {model.count}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {canViewPayrollGl && (
        <div className="rounded-xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/40 dark:bg-teal-950/25 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                GL Accounting Link · Contractor Expense Category
              </span>
              <Badge tone={expenseMapping?.glAccountId ? 'success' : 'warning'} dot>
                contractor_expense:{' '}
                {expenseMapping?.glAccountCode
                  ? `${expenseMapping.glAccountCode} · ${expenseMapping.glAccountName}`
                  : 'Unmapped'}
              </Badge>
              <Badge tone={payableMapping?.glAccountId ? 'info' : 'warning'}>
                contractor_payable:{' '}
                {payableMapping?.glAccountCode
                  ? `${payableMapping.glAccountCode} · ${payableMapping.glAccountName}`
                  : 'Unmapped'}
              </Badge>
            </div>
            <p className="text-xs text-secondary">
              Completed contractor payments settled under these terms post to GL Exports under the
              distinct <code className="font-mono">contractor_expense</code> category — separated from employee payroll components.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => routerNavigate(`${pathForPage('accounting-mapping')}?tab=contractor`)}
            >
              <BookOpen className="h-3.5 w-3.5" /> Contractor GL Mapping
            </Button>
            <Button
              size="sm"
              className={AP_PRIMARY_BUTTON_CLASS}
              onClick={() => routerNavigate(`${pathForPage('accounting-exports')}?kind=contractor`)}
            >
              <ExternalLink className="h-3.5 w-3.5" /> View in GL Export Status (Stage U.1)
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <Card className={AP_LEDGER_CARD_CLASS}>
        <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <CardTitle>Commercial Agreement Payment Terms ({filteredContracts.length})</CardTitle>
            <p className="text-xs text-muted mt-0.5">
              Define fixed fee caps, hourly billing rates, milestone deliverables, and net invoice due dates
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contract # or vendor..."
                className="h-8 pl-8 py-0 text-xs"
              />
            </div>
            <Select
              value={structureFilter}
              onChange={(e) => setStructureFilter(e.target.value as StructureFilter)}
              className="h-8 py-0 text-xs w-44"
            >
              <option value="all">All models</option>
              {(
                Object.keys(
                  CONTRACTOR_PAYMENT_STRUCTURE_LABELS,
                ) as ContractorPaymentStructure[]
              ).map((key) => (
                <option key={key} value={key}>
                  {CONTRACTOR_PAYMENT_STRUCTURE_LABELS[key]}
                </option>
              ))}
            </Select>
            <Select
              value={termsFilter}
              onChange={(e) =>
                setTermsFilter(e.target.value as 'all' | ContractorPaymentTerms)
              }
              className="h-8 py-0 text-xs w-40"
            >
              <option value="all">All net terms</option>
              {(Object.keys(PAYMENT_TERMS_LABELS) as ContractorPaymentTerms[]).map((key) => (
                <option key={key} value={key}>
                  {PAYMENT_TERMS_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>

        <CardBody className="p-0 overflow-x-auto">
          {filteredContracts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted">
              No contractor agreements match your filters.
            </div>
          ) : (
            <table className="w-full min-w-[920px] text-left">
              <thead className="bg-[rgb(var(--bg-muted))] text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Contract / Scope</th>
                  <th className="px-4 py-2.5 font-medium">Contractor / Vendor</th>
                  <th className="px-4 py-2.5 font-medium">Billing Model</th>
                  <th className="px-4 py-2.5 font-medium">Rate / Cap / Schedule</th>
                  <th className="px-4 py-2.5 font-medium">Net Terms &amp; Cycle</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Setup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filteredContracts.map((contract) => {
                  const vendor = contractorById.get(contract.contractorId);
                  const paidMilestones = contract.milestones.filter(
                    (m) => m.status === 'paid',
                  ).length;
                  const invoicedMilestones = contract.milestones.filter(
                    (m) => m.status === 'invoiced',
                  ).length;

                  return (
                    <tr key={contract.id} className="hover:bg-[rgb(var(--bg-hover))]">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-teal-800 dark:text-teal-300">
                          {contract.contractNumber}
                        </p>
                        <p className="text-sm font-medium text-primary">{contract.title}</p>
                        <p className="text-[11px] text-muted">
                          {formatContractorDate(contract.startDate)} –{' '}
                          {formatContractorDate(contract.endDate)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-primary">
                          {contract.contractorName}
                        </p>
                        {vendor && (
                          <span
                            className={`mt-1 inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${CONTRACTOR_KIND_BADGE_CLASSES[vendor.contractorKind]}`}
                          >
                            {CONTRACTOR_KIND_LABELS[vendor.contractorKind]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STRUCTURE_BADGE_CLASS[contract.paymentStructure]}`}
                        >
                          {CONTRACTOR_PAYMENT_STRUCTURE_LABELS[contract.paymentStructure]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {contract.paymentStructure === 'fixed_project_fee' && (
                          <div>
                            <p className="font-mono text-sm font-semibold text-primary">
                              {formatContractorMoney(
                                contract.fixedFeeAmount ?? contract.annualValue ?? '0',
                                contract.currency,
                              )}
                            </p>
                            <p className="text-[11px] text-muted">Fixed project fee cap</p>
                          </div>
                        )}
                        {contract.paymentStructure === 'hourly_invoice' && (
                          <div>
                            <p className="font-mono text-sm font-semibold text-primary">
                              {formatContractorMoney(
                                contract.hourlyRate ?? '0',
                                contract.currency,
                              )}
                              /hr
                            </p>
                            <p className="text-[11px] text-muted">Validated hours × rate</p>
                          </div>
                        )}
                        {contract.paymentStructure === 'milestone' && (
                          <div>
                            <p className="font-mono text-sm font-semibold text-primary">
                              {contract.milestones.length} deliverable(s)
                            </p>
                            <p className="text-[11px] text-muted">
                              {paidMilestones} paid · {invoicedMilestones} invoiced ·{' '}
                              {contract.milestones.length - paidMilestones - invoicedMilestones}{' '}
                              pending
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex items-center gap-1 font-medium text-primary">
                          <CalendarClock className="h-3.5 w-3.5 text-teal-700" />
                          {PAYMENT_TERMS_LABELS[contract.paymentTerms]} (+
                          {PAYMENT_TERMS_DAYS[contract.paymentTerms]}d)
                        </div>
                        <p className="text-[11px] text-muted mt-0.5">
                          {BILLING_FREQUENCY_LABELS[contract.billingFrequency]} · Notice{' '}
                          {contract.noticePeriodDays}d{contract.autoRenewal ? ' · Auto-renew' : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={CONTRACT_STATUS_TONE[contract.status]} dot>
                          {contract.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={contract.status === 'terminated'}
                            onClick={() => setEditingContract(contract)}
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" /> Configure Terms
                          </Button>
                        ) : (
                          <span className="text-xs text-muted">Read only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {companyId && (
        <ContractorContractModal
          open={newContractOpen}
          onClose={() => setNewContractOpen(false)}
          companyId={companyId}
          contractors={contractors}
          employees={employees}
          onCreated={async (created) => {
            setNotice(
              `Created agreement ${created.contractNumber} (${CONTRACTOR_PAYMENT_STRUCTURE_LABELS[created.paymentStructure]} · ${PAYMENT_TERMS_LABELS[created.paymentTerms]}).`,
            );
            await load();
          }}
        />
      )}

      <ContractorPaymentTermsModal
        contract={editingContract}
        onClose={() => setEditingContract(null)}
        onUpdated={async (updated) => {
          setNotice(
            `Updated payment terms for ${updated.contractNumber}: ${CONTRACTOR_PAYMENT_STRUCTURE_LABELS[updated.paymentStructure]} (${PAYMENT_TERMS_LABELS[updated.paymentTerms]}).`,
          );
          await load();
        }}
      />
    </div>
  );
}

