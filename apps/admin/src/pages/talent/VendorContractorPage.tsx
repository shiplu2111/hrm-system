import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { useCompany } from '@/context/CompanyContext';
import {
  BILLING_FREQUENCY_LABELS,
  CONTRACTOR_KIND_LABELS,
  CONTRACTOR_PAYMENT_STRUCTURE_LABELS,
  createContractor,
  createContractorContract,
  getContractorSummary,
  INVOICE_STATUS_LABELS,
  listContractorContracts,
  listContractorInvoices,
  listContractors,
  PAYMENT_TERMS_LABELS,
} from '@/lib/contractors-api';
import { listEmployees } from '@/lib/employees-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  ContractorContractRecord,
  ContractorInvoiceRecord,
  ContractorKind,
  ContractorRecord,
  ContractorSummary,
} from '@hrm/shared-types';

type View = 'directory' | 'profile';
type DirectoryMode = 'cards' | 'table';
type ProfileTab = 'overview' | 'contract' | 'invoices';
type ContractDisplayStatus = 'Active' | 'Expiring Soon' | 'Expired' | 'Draft';

const statusTone: Record<ContractDisplayStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  Active: 'success',
  'Expiring Soon': 'warning',
  Expired: 'error',
  Draft: 'neutral',
};

const invoiceTone: Record<
  ContractorInvoiceRecord['status'],
  'success' | 'warning' | 'error' | 'info' | 'neutral'
> = {
  draft: 'neutral',
  submitted: 'info',
  approved: 'warning',
  scheduled: 'info',
  paid: 'success',
  rejected: 'error',
  cancelled: 'neutral',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoney(amount: string, currency: string): string {
  const numeric = Number.parseFloat(amount);
  if (Number.isNaN(numeric)) return amount;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function deriveContractDisplayStatus(
  contract: ContractorContractRecord,
): ContractDisplayStatus {
  if (contract.status === 'draft') return 'Draft';
  if (
    contract.status === 'expired' ||
    contract.status === 'terminated' ||
    contract.daysUntilExpiry < 0
  ) {
    return 'Expired';
  }
  if (contract.daysUntilExpiry <= 60) return 'Expiring Soon';
  return 'Active';
}

function primaryContract(
  contractorId: string,
  contracts: ContractorContractRecord[],
): ContractorContractRecord | undefined {
  const mine = contracts.filter((row) => row.contractorId === contractorId);
  return (
    mine.find((row) => row.status === 'active') ??
    mine.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)[0]
  );
}

function ExpiryCard({
  contract,
  onOpen,
}: {
  contract: ContractorContractRecord;
  onOpen: () => void;
}) {
  const displayStatus = deriveContractDisplayStatus(contract);
  const urgent = contract.daysUntilExpiry <= 30 && contract.daysUntilExpiry >= 0;
  const expired = contract.daysUntilExpiry < 0;
  const color = expired
    ? 'border-error-200 dark:border-error-800/60 bg-error-50/50 dark:bg-error-950/20'
    : urgent
      ? 'border-warning-200 dark:border-warning-800/60 bg-warning-50/50 dark:bg-warning-950/20'
      : 'border-accent-200 dark:border-accent-800/60 bg-accent-50/40 dark:bg-accent-950/20';
  const iconColor = expired ? 'text-error-600' : urgent ? 'text-warning-600' : 'text-accent-600';

  return (
    <button
      onClick={onOpen}
      className={`w-full text-left rounded-xl border p-3 hover:shadow-card-hover transition-all ${color}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className={`h-4 w-4 shrink-0 ${iconColor}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary truncate">{contract.contractorName}</p>
            <p className="text-[11px] text-muted">{contract.title}</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted shrink-0" />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] text-muted">Expires</p>
          <p className="text-xs font-medium text-secondary">{formatDate(contract.endDate)}</p>
        </div>
        <Badge tone={statusTone[displayStatus]}>
          {expired
            ? `${Math.abs(contract.daysUntilExpiry)}d overdue`
            : `${contract.daysUntilExpiry} days`}
        </Badge>
      </div>
    </button>
  );
}

export function VendorContractorPage() {
  const { companyId } = useCompany();
  const [view, setView] = useState<View>('directory');
  const [mode, setMode] = useState<DirectoryMode>('cards');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<ContractorSummary | null>(null);
  const [contractors, setContractors] = useState<ContractorRecord[]>([]);
  const [contracts, setContracts] = useState<ContractorContractRecord[]>([]);
  const [invoices, setInvoices] = useState<ContractorInvoiceRecord[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<ContractorRecord | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | ContractDisplayStatus>('All');
  const [addOpen, setAddOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview');

  const [legalName, setLegalName] = useState('');
  const [contractorKind, setContractorKind] = useState<ContractorKind>('consultant');
  const [newCategory, setNewCategory] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [ownerEmployeeId, setOwnerEmployeeId] = useState('');
  const [contractTitle, setContractTitle] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [annualValue, setAnnualValue] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryRow, contractorRows, contractRows, employeeRows] = await Promise.all([
        getContractorSummary(companyId),
        listContractors(companyId),
        listContractorContracts(companyId),
        listEmployees(companyId),
      ]);
      setSummary(summaryRow);
      setContractors(contractorRows);
      setContracts(contractRows);
      setEmployees(
        employeeRows.map((emp) => ({
          id: emp.id,
          name: emp.fullName ?? `${emp.firstName} ${emp.lastName}`,
        })),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load contractors');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const loadProfile = useCallback(
    async (contractor: ContractorRecord) => {
      if (!companyId) return;
      try {
        const invoiceRows = await listContractorInvoices(companyId, {
          contractorId: contractor.id,
        });
        setInvoices(invoiceRows);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load invoices');
      }
    },
    [companyId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(contractors.map((row) => row.category).filter(Boolean) as string[]),
      ).sort(),
    [contractors],
  );

  const contractorContracts = useMemo(() => {
    if (!selected) return [];
    return contracts.filter((row) => row.contractorId === selected.id);
  }, [contracts, selected]);

  const activeContract = contractorContracts.find((row) => row.status === 'active');

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return contractors.filter((contractor) => {
      const contract = primaryContract(contractor.id, contracts);
      const displayStatus = contract
        ? deriveContractDisplayStatus(contract)
        : ('Draft' as ContractDisplayStatus);
      return (
        (!query ||
          `${contractor.legalName} ${contractor.contactName ?? ''} ${contractor.category ?? ''} ${contractor.contractorNumber}`
            .toLowerCase()
            .includes(query)) &&
        (category === 'All' || contractor.category === category) &&
        (statusFilter === 'All' || displayStatus === statusFilter)
      );
    });
  }, [category, contractors, contracts, search, statusFilter]);

  const expiryContracts = useMemo(
    () =>
      contracts
        .filter(
          (row) =>
            row.status !== 'draft' &&
            row.status !== 'terminated' &&
            row.daysUntilExpiry <= 60,
        )
        .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
    [contracts],
  );

  const openProfile = (contractor: ContractorRecord) => {
    setSelected(contractor);
    setProfileTab('overview');
    setView('profile');
    void loadProfile(contractor);
  };

  const resetAddForm = () => {
    setLegalName('');
    setContractorKind('consultant');
    setNewCategory('');
    setContactName('');
    setEmail('');
    setPhone('');
    setLocation('');
    setOwnerEmployeeId('');
    setContractTitle('');
    setContractStart('');
    setContractEnd('');
    setAnnualValue('');
    setScopeDescription('');
  };

  const handleCreateContractor = async () => {
    if (!companyId || !legalName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createContractor(companyId, {
        legalName: legalName.trim(),
        contractorKind,
        category: newCategory.trim() || undefined,
        contactName: contactName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        location: location.trim() || undefined,
        ownerEmployeeId: ownerEmployeeId || undefined,
      });

      if (contractTitle.trim() && contractStart && contractEnd) {
        await createContractorContract(companyId, {
          contractorId: created.id,
          title: contractTitle.trim(),
          scopeDescription: scopeDescription.trim() || undefined,
          startDate: contractStart,
          endDate: contractEnd,
          annualValue: annualValue.trim() || undefined,
          ownerEmployeeId: ownerEmployeeId || undefined,
        });
      }

      setAddOpen(false);
      resetAddForm();
      await load();
      openProfile(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create contractor');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && contractors.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[320px]">
        <Loader2 className="h-6 w-6 animate-spin text-accent-600" />
      </div>
    );
  }

  if (view === 'profile' && selected) {
    const displayName = selected.displayName ?? selected.legalName;
    const contractStatus = activeContract
      ? deriveContractDisplayStatus(activeContract)
      : 'Draft';

    return (
      <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
        <button
          onClick={() => setView('directory')}
          className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to vendor directory
        </button>

        {error && (
          <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
            {error}
          </div>
        )}

        <Card>
          <CardBody className="flex flex-col lg:flex-row lg:items-center gap-5">
            <Avatar name={selected.contactName ?? displayName} size="lg" className="h-14 w-14 text-lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-primary">
                  {selected.contactName ?? displayName}
                </h1>
                <Badge tone="accent">
                  <UserRound className="h-3 w-3" />
                  {CONTRACTOR_KIND_LABELS[selected.contractorKind]}
                </Badge>
                <Badge tone={statusTone[contractStatus]} dot>
                  {contractStatus}
                </Badge>
                <Badge tone="neutral">{selected.contractorNumber}</Badge>
              </div>
              <p className="text-sm text-secondary mt-1">
                {activeContract?.scopeDescription ?? selected.category ?? 'No active contract'} ·{' '}
                {selected.legalName}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted">
                {selected.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {selected.email}
                  </span>
                )}
                {selected.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {selected.phone}
                  </span>
                )}
                {selected.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {selected.location}
                  </span>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: 'Contract value',
              value: activeContract?.annualValue
                ? formatMoney(activeContract.annualValue, activeContract.currency)
                : '—',
              note: 'Annual value',
              icon: CircleDollarSign,
            },
            {
              label: 'Contract term',
              value: activeContract ? `${activeContract.startDate} – ${activeContract.endDate}` : '—',
              note: activeContract
                ? `${activeContract.daysUntilExpiry} days remaining`
                : 'No active contract',
              icon: Calendar,
            },
            {
              label: 'Payment structure',
              value: activeContract
                ? CONTRACTOR_PAYMENT_STRUCTURE_LABELS[activeContract.paymentStructure]
                : '—',
              note: activeContract?.hourlyRate
                ? `${formatMoney(activeContract.hourlyRate, activeContract.currency)}/hr · ${PAYMENT_TERMS_LABELS[activeContract.paymentTerms]}`
                : activeContract?.fixedFeeAmount
                  ? `Fixed ${formatMoney(activeContract.fixedFeeAmount, activeContract.currency)} · ${PAYMENT_TERMS_LABELS[activeContract.paymentTerms]}`
                  : activeContract
                    ? PAYMENT_TERMS_LABELS[activeContract.paymentTerms]
                    : 'Invoice-based',
              icon: Clock3,
            },
            {
              label: 'Account owner',
              value: selected.ownerEmployeeName ?? activeContract?.ownerEmployeeName ?? '—',
              note: 'Internal contract owner',
              icon: ShieldCheck,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label}>
                <CardBody className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Icon className="h-4 w-4 text-accent-600" />
                    {item.label}
                  </div>
                  <p className="text-base font-semibold text-primary mt-2">{item.value}</p>
                  <p className="text-[11px] text-muted mt-0.5">{item.note}</p>
                </CardBody>
              </Card>
            );
          })}
        </div>

        <div className="flex items-center gap-1 border-b border-base">
          {(['overview', 'contract', 'invoices'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setProfileTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
                profileTab === tab
                  ? 'border-accent-600 text-accent-600'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              {tab === 'invoices' ? 'Invoices & payments' : tab}
            </button>
          ))}
        </div>

        {profileTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Contractor information</CardTitle>
              </CardHeader>
              <CardBody className="grid grid-cols-2 gap-4">
                {[
                  ['Legal / vendor name', selected.legalName],
                  ['Category', selected.category ?? '—'],
                  ['Primary contact', selected.contactName ?? '—'],
                  ['Vendor ID', selected.contractorNumber],
                  ['Email', selected.email ?? '—'],
                  ['Phone', selected.phone ?? '—'],
                  ['Location', selected.location ?? '—'],
                  ['Outstanding invoices', formatMoney(selected.outstandingInvoiceAmount, 'AUD')],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted">{label}</p>
                    <p className="text-sm text-primary mt-0.5">{value}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Invoice-based payments</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                <p className="text-sm text-secondary">
                  Contractor payments are processed through approved invoices and contractor payment
                  batches — separate from employee payroll runs and salary structures.
                </p>
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[rgb(var(--bg-muted))]">
                  <div>
                    <p className="text-sm font-medium text-primary">Pending approval</p>
                    <p className="text-xs text-muted">
                      {invoices.filter((row) => row.status === 'submitted').length} submitted
                      invoice(s)
                    </p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-success-600 shrink-0" />
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {profileTab === 'contract' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {contractorContracts.length === 0 ? (
              <Card className="lg:col-span-3">
                <CardBody className="py-10 text-center text-sm text-muted">
                  No contracts on file for this contractor.
                </CardBody>
              </Card>
            ) : (
              contractorContracts.map((contract) => (
                <Card key={contract.id} className="lg:col-span-3">
                  <CardHeader>
                    <div>
                      <CardTitle>{contract.title}</CardTitle>
                      <p className="text-xs text-muted mt-0.5">{contract.contractNumber}</p>
                    </div>
                  </CardHeader>
                  <CardBody className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    {[
                      ['Effective date', formatDate(contract.startDate)],
                      ['Expiry date', formatDate(contract.endDate)],
                      [
                        'Payment structure',
                        CONTRACTOR_PAYMENT_STRUCTURE_LABELS[contract.paymentStructure],
                      ],
                      [
                        'Contract value',
                        contract.fixedFeeAmount
                          ? formatMoney(contract.fixedFeeAmount, contract.currency)
                          : contract.annualValue
                            ? formatMoney(contract.annualValue, contract.currency)
                            : '—',
                      ],
                      [
                        'Hourly rate',
                        contract.hourlyRate
                          ? `${formatMoney(contract.hourlyRate, contract.currency)}/hr`
                          : '—',
                      ],
                      ['Billing frequency', BILLING_FREQUENCY_LABELS[contract.billingFrequency]],
                      ['Payment terms', PAYMENT_TERMS_LABELS[contract.paymentTerms]],
                      ['Auto-renewal', contract.autoRenewal ? 'Yes' : 'No'],
                      ['Notice period', `${contract.noticePeriodDays} days`],
                      ['Currency', contract.currency],
                      ['Status', deriveContractDisplayStatus(contract)],
                    ].map(([label, value]) => (
                      <div key={`${contract.id}-${label}`}>
                        <p className="text-xs text-muted">{label}</p>
                        <p className="text-sm font-medium text-primary mt-1">{value}</p>
                      </div>
                    ))}
                    {contract.scopeDescription && (
                      <div className="col-span-2 sm:col-span-3 border-t border-base pt-4">
                        <p className="text-xs text-muted">Scope of services</p>
                        <p className="text-sm text-secondary mt-1">{contract.scopeDescription}</p>
                      </div>
                    )}
                    {contract.milestones.length > 0 && (
                      <div className="col-span-2 sm:col-span-3 border-t border-base pt-4">
                        <p className="text-xs text-muted mb-2">Milestones</p>
                        <div className="space-y-2">
                          {contract.milestones.map((milestone) => (
                            <div
                              key={milestone.id}
                              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[rgb(var(--bg-muted))]"
                            >
                              <div>
                                <p className="text-sm font-medium text-primary">{milestone.title}</p>
                                <p className="text-xs text-muted">
                                  {milestone.targetDate
                                    ? `Due ${formatDate(milestone.targetDate)}`
                                    : 'No target date'}{' '}
                                  · {milestone.status}
                                </p>
                              </div>
                              <p className="text-sm font-medium text-primary">
                                {formatMoney(milestone.amount, contract.currency)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))
            )}
          </div>
        )}

        {profileTab === 'invoices' && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Invoices & payments</CardTitle>
                <p className="text-xs text-muted mt-0.5">
                  {invoices.length} invoice(s) · Outstanding{' '}
                  {formatMoney(selected.outstandingInvoiceAmount, 'AUD')}
                </p>
              </div>
            </CardHeader>
            <CardBody className="p-0 overflow-x-auto">
              {invoices.length === 0 ? (
                <p className="p-6 text-sm text-muted text-center">No invoices yet.</p>
              ) : (
                <table className="w-full min-w-[720px] text-left">
                  <thead className="bg-[rgb(var(--bg-muted))] text-[11px] uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Invoice</th>
                      <th className="px-4 py-2.5 font-medium">Period</th>
                      <th className="px-4 py-2.5 font-medium">Issued / due</th>
                      <th className="px-4 py-2.5 font-medium">Amount</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--border-base))]">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-[rgb(var(--bg-hover))]">
                        <td className="px-4 py-3 text-sm font-medium text-primary">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="px-4 py-3 text-xs text-secondary">
                          {invoice.periodLabel ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <p className="text-secondary">{formatDate(invoice.issuedAt)}</p>
                          <p className="text-muted">Due {formatDate(invoice.dueAt)}</p>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-primary">
                          {formatMoney(invoice.amount, invoice.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={invoiceTone[invoice.status]} dot>
                            {INVOICE_STATUS_LABELS[invoice.status]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-accent-600 dark:text-accent-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">Vendors & Contractors</h1>
            <p className="text-sm text-secondary">
              External workforce, contracts and invoice-based payments
            </p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add vendor
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Total vendors',
            value: summary?.totalContractors ?? contractors.length,
            note: `${categories.length} categories`,
            icon: Building2,
            tone: 'text-accent-600',
          },
          {
            label: 'Active contracts',
            value: summary?.activeContracts ?? 0,
            note: `${summary?.pendingInvoiceCount ?? 0} invoices pending`,
            icon: CheckCircle2,
            tone: 'text-success-600',
          },
          {
            label: 'Expiring in 60 days',
            value: summary?.expiringWithin60Days ?? 0,
            note: 'Renewal action needed',
            icon: Clock3,
            tone: 'text-warning-600',
          },
          {
            label: 'Overdue contracts',
            value: summary?.overdueContracts ?? 0,
            note: formatMoney(summary?.outstandingInvoiceAmount ?? '0', 'AUD') + ' outstanding',
            icon: AlertTriangle,
            tone: 'text-error-600',
          },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardBody className="p-4 flex justify-between gap-2">
                <div>
                  <p className="text-xs text-muted">{metric.label}</p>
                  <p className="text-2xl font-bold text-primary mt-1">{metric.value}</p>
                  <p className="text-[11px] text-secondary">{metric.note}</p>
                </div>
                <Icon className={`h-5 w-5 ${metric.tone}`} />
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <Card className="xl:col-span-3">
          <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle>Vendor directory</CardTitle>
              <p className="text-xs text-muted mt-0.5">{filtered.length} vendors</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-48 flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search vendors..."
                  className="h-8 pl-8 py-0 text-xs"
                />
              </div>
              <Select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-8 py-0 text-xs w-40"
              >
                <option>All</option>
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
              <Select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as 'All' | ContractDisplayStatus)
                }
                className="h-8 py-0 text-xs w-36"
              >
                <option>All</option>
                <option>Active</option>
                <option>Expiring Soon</option>
                <option>Expired</option>
                <option>Draft</option>
              </Select>
              <div className="flex border border-base rounded-lg p-0.5">
                <button
                  onClick={() => setMode('cards')}
                  className={`h-7 w-7 rounded-md flex items-center justify-center ${mode === 'cards' ? 'bg-accent-50 text-accent-600 dark:bg-accent-950/40' : 'text-muted'}`}
                  aria-label="Card view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setMode('table')}
                  className={`h-7 w-7 rounded-md flex items-center justify-center ${mode === 'table' ? 'bg-accent-50 text-accent-600 dark:bg-accent-950/40' : 'text-muted'}`}
                  aria-label="Table view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </CardHeader>
          {filtered.length === 0 ? (
            <CardBody className="py-10 text-center text-sm text-muted">
              No contractors match your filters.
            </CardBody>
          ) : mode === 'cards' ? (
            <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((contractor) => {
                const contract = primaryContract(contractor.id, contracts);
                const displayStatus = contract
                  ? deriveContractDisplayStatus(contract)
                  : ('Draft' as ContractDisplayStatus);
                return (
                  <button
                    key={contractor.id}
                    onClick={() => openProfile(contractor)}
                    className="text-left rounded-xl border border-base p-4 hover:border-accent-400 hover:shadow-card-hover transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={contractor.legalName} size="lg" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-primary truncate">
                              {contractor.displayName ?? contractor.legalName}
                            </p>
                            <p className="text-xs text-muted">
                              {contractor.category ?? CONTRACTOR_KIND_LABELS[contractor.contractorKind]} ·{' '}
                              {contractor.contractorNumber}
                            </p>
                          </div>
                          <Badge tone={statusTone[displayStatus]} dot>
                            {displayStatus}
                          </Badge>
                        </div>
                        <div className="mt-3 pt-3 border-t border-base flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium text-secondary">
                              {contractor.contactName ?? '—'}
                            </p>
                            <p className="text-[11px] text-muted">{contractor.email ?? '—'}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardBody>
          ) : (
            <CardBody className="p-0 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-[rgb(var(--bg-muted))] text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Vendor</th>
                    <th className="px-4 py-2.5 font-medium">Category</th>
                    <th className="px-4 py-2.5 font-medium">Contact</th>
                    <th className="px-4 py-2.5 font-medium">Contract</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {filtered.map((contractor) => {
                    const contract = primaryContract(contractor.id, contracts);
                    const displayStatus = contract
                      ? deriveContractDisplayStatus(contract)
                      : ('Draft' as ContractDisplayStatus);
                    return (
                      <tr
                        key={contractor.id}
                        onClick={() => openProfile(contractor)}
                        className="cursor-pointer hover:bg-[rgb(var(--bg-hover))]"
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-primary">
                            {contractor.displayName ?? contractor.legalName}
                          </p>
                          <p className="text-xs text-muted">{contractor.contractorNumber}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-secondary">
                          {contractor.category ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-secondary">{contractor.contactName ?? '—'}</p>
                          <p className="text-[11px] text-muted">{contractor.email ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={statusTone[displayStatus]} dot>
                            {displayStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight className="h-4 w-4 text-muted" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardBody>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contract expiry tracker</CardTitle>
            <p className="text-xs text-muted mt-0.5">Due within 60 days or overdue</p>
          </CardHeader>
          <CardBody className="space-y-3">
            {expiryContracts.length === 0 ? (
              <p className="text-sm text-muted">No contracts expiring soon.</p>
            ) : (
              expiryContracts.map((contract) => (
                <ExpiryCard
                  key={contract.id}
                  contract={contract}
                  onOpen={() => {
                    const contractor = contractors.find((row) => row.id === contract.contractorId);
                    if (contractor) openProfile(contractor);
                  }}
                />
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          resetAddForm();
        }}
        title="Add vendor or contractor"
        description="Create a directory record and optionally capture the primary contract."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setAddOpen(false);
                resetAddForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleCreateContractor()} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create vendor'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Vendor name</Label>
            <Input
              value={legalName}
              onChange={(event) => setLegalName(event.target.value)}
              placeholder="Registered business name"
            />
          </div>
          <div>
            <Label>Kind</Label>
            <Select
              value={contractorKind}
              onChange={(event) => setContractorKind(event.target.value as ContractorKind)}
            >
              <option value="consultant">Consultant</option>
              <option value="freelancer">Freelancer</option>
              <option value="vendor">Vendor</option>
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Input
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              placeholder="e.g. Professional Services"
            />
          </div>
          <div>
            <Label>Primary contact</Label>
            <Input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Contact name"
            />
          </div>
          <div>
            <Label>Contact email</Label>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+61 ..."
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="City, state"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Internal owner</Label>
            <Select
              value={ownerEmployeeId}
              onChange={(event) => setOwnerEmployeeId(event.target.value)}
            >
              <option value="">Select owner</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2 border-t border-base pt-4 mt-2">
            <p className="text-sm font-medium text-primary mb-3">Primary contract (optional)</p>
          </div>
          <div className="sm:col-span-2">
            <Label>Contract title</Label>
            <Input
              value={contractTitle}
              onChange={(event) => setContractTitle(event.target.value)}
              placeholder="Scope summary"
            />
          </div>
          <div>
            <Label>Contract start</Label>
            <Input
              type="date"
              value={contractStart}
              onChange={(event) => setContractStart(event.target.value)}
            />
          </div>
          <div>
            <Label>Contract expiry</Label>
            <Input
              type="date"
              value={contractEnd}
              onChange={(event) => setContractEnd(event.target.value)}
            />
          </div>
          <div>
            <Label>Annual value</Label>
            <Input
              value={annualValue}
              onChange={(event) => setAnnualValue(event.target.value)}
              placeholder="120000.00"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Scope description</Label>
            <Textarea
              value={scopeDescription}
              onChange={(event) => setScopeDescription(event.target.value)}
              rows={3}
              placeholder="Services covered under this contract"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
