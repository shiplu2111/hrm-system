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
  CreditCard,
  Eye,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  XCircle,
} from 'lucide-react';
import { PermissionGate, usePermissions } from '@hrm/portal-ui';
import { ContractorContractModal } from '@/components/contractors/ContractorContractModal';
import {
  ContractorInvoiceModals,
  useContractorInvoiceActions,
} from '@/components/contractors/ContractorInvoiceDetailModals';
import { ContractorInvoiceFormModal } from '@/components/contractors/ContractorInvoiceFormModal';
import { ContractorPaymentTermsModal } from '@/components/contractors/ContractorPaymentTermsModal';
import { NonEmployeeApBanner } from '@/components/contractors/NonEmployeeApBanner';
import {
  AP_LEDGER_CARD_CLASS,
  AP_PRIMARY_BUTTON_CLASS,
  CONTRACTOR_KIND_BADGE_CLASSES,
  formatContractorDate,
  formatContractorMoney,
  INVOICE_STATUS_TONE,
  isInvoiceOverdue,
} from '@/components/contractors/contractor-ui.utils';
import { Avatar } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
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
  ContractorPaymentStructure,
  ContractorPaymentTerms,
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
      : 'border-teal-200 dark:border-teal-800/60 bg-teal-50/40 dark:bg-teal-950/20';
  const iconColor = expired ? 'text-error-600' : urgent ? 'text-warning-600' : 'text-teal-700';

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
          <p className="text-xs font-medium text-secondary">
            {formatContractorDate(contract.endDate)}
          </p>
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
  const { navigate } = useNav();
  const { can } = usePermissions();
  const canCreate = can('contractors', 'create');
  const canEdit = can('contractors', 'edit');
  const canApprove = can('contractors', 'approve');
  const canFinalize = can('contractors', 'finalize');

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
  const [kindFilter, setKindFilter] = useState<'All' | ContractorKind>('All');
  const [category, setCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | ContractDisplayStatus>('All');
  const [addOpen, setAddOpen] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [editingTermsContract, setEditingTermsContract] =
    useState<ContractorContractRecord | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview');

  const [legalName, setLegalName] = useState('');
  const [contractorKind, setContractorKind] = useState<ContractorKind>('consultant');
  const [newCategory, setNewCategory] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [taxId, setTaxId] = useState('');
  const [ownerEmployeeId, setOwnerEmployeeId] = useState('');
  const [contractTitle, setContractTitle] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [paymentStructure, setPaymentStructure] =
    useState<Exclude<ContractorPaymentStructure, 'milestone'>>('fixed_project_fee');
  const [paymentTerms, setPaymentTerms] = useState<ContractorPaymentTerms>('net_30');
  const [annualValue, setAnnualValue] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
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
      setSelected((prev) =>
        prev ? contractorRows.find((c) => c.id === prev.id) ?? prev : null,
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

  const invoiceActions = useContractorInvoiceActions({
    onSuccess: async () => {
      await load();
      if (selected) await loadProfile(selected);
    },
    onError: (msg) => setError(msg),
  });

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
          `${contractor.legalName} ${contractor.displayName ?? ''} ${contractor.contactName ?? ''} ${contractor.category ?? ''} ${contractor.contractorNumber}`
            .toLowerCase()
            .includes(query)) &&
        (kindFilter === 'All' || contractor.contractorKind === kindFilter) &&
        (category === 'All' || contractor.category === category) &&
        (statusFilter === 'All' || displayStatus === statusFilter)
      );
    });
  }, [category, contractors, contracts, kindFilter, search, statusFilter]);

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
    setTaxId('');
    setOwnerEmployeeId('');
    setContractTitle('');
    setContractStart('');
    setContractEnd('');
    setPaymentStructure('fixed_project_fee');
    setPaymentTerms('net_30');
    setAnnualValue('');
    setHourlyRate('');
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
        taxId: taxId.trim() || undefined,
        ownerEmployeeId: ownerEmployeeId || undefined,
      });

      if (contractTitle.trim() && contractStart && contractEnd) {
        await createContractorContract(companyId, {
          contractorId: created.id,
          title: contractTitle.trim(),
          scopeDescription: scopeDescription.trim() || undefined,
          startDate: contractStart,
          endDate: contractEnd,
          paymentStructure,
          paymentTerms,
          fixedFeeAmount:
            paymentStructure === 'fixed_project_fee'
              ? annualValue.trim() || undefined
              : undefined,
          annualValue: annualValue.trim() || undefined,
          hourlyRate:
            paymentStructure === 'hourly_invoice'
              ? hourlyRate.trim() || undefined
              : undefined,
          ownerEmployeeId: ownerEmployeeId || undefined,
          status: 'active',
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
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setView('directory')}
            className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to contractor &amp; vendor list
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate('contractor-invoices')}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Open AP Invoices Ledger
            </Button>
            {canCreate && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setContractModalOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> New Contract
                </Button>
                <Button
                  size="sm"
                  className={AP_PRIMARY_BUTTON_CLASS}
                  disabled={contractorContracts.length === 0}
                  onClick={() => setInvoiceModalOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> New Invoice
                </Button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
            {error}
          </div>
        )}

        <Card className="border-teal-300/80 dark:border-teal-800/70 border-l-4 border-l-teal-600 bg-gradient-to-r from-teal-50/70 via-white to-amber-50/50 dark:from-teal-950/30 dark:via-slate-900 dark:to-amber-950/20">
          <CardBody className="flex flex-col lg:flex-row lg:items-center gap-5">
            <Avatar
              name={selected.contactName ?? displayName}
              size="lg"
              className="h-14 w-14 text-lg"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-primary">
                  {displayName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${CONTRACTOR_KIND_BADGE_CLASSES[selected.contractorKind]}`}
                >
                  <UserRound className="h-3 w-3" />
                  {CONTRACTOR_KIND_LABELS[selected.contractorKind]}
                </span>
                <Badge tone={statusTone[contractStatus]} dot>
                  {contractStatus}
                </Badge>
                <Badge tone="neutral" className="font-mono">
                  {selected.contractorNumber}
                </Badge>
                <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900 dark:border-amber-700/70 dark:bg-amber-950/60 dark:text-amber-200">
                  External Entity · Non-Employee AP
                </span>
              </div>
              <p className="text-sm text-secondary mt-1">
                {activeContract?.scopeDescription ?? selected.category ?? 'No active contract'} ·{' '}
                {selected.legalName}
                {selected.taxId ? ` · Tax ID: ${selected.taxId}` : ''}
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
                ? formatContractorMoney(activeContract.annualValue, activeContract.currency)
                : activeContract?.fixedFeeAmount
                  ? formatContractorMoney(activeContract.fixedFeeAmount, activeContract.currency)
                  : '—',
              note: 'Annual / cap value',
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
                ? `${formatContractorMoney(activeContract.hourlyRate, activeContract.currency)}/hr · ${PAYMENT_TERMS_LABELS[activeContract.paymentTerms]}`
                : activeContract?.fixedFeeAmount
                  ? `Fixed ${formatContractorMoney(activeContract.fixedFeeAmount, activeContract.currency)} · ${PAYMENT_TERMS_LABELS[activeContract.paymentTerms]}`
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
              <Card key={item.label} className={AP_LEDGER_CARD_CLASS}>
                <CardBody className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Icon className="h-4 w-4 text-teal-700 dark:text-teal-400" />
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
                  ? 'border-teal-700 text-teal-800 dark:text-teal-300'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              {tab === 'invoices' ? `Invoices & payments (${invoices.length})` : tab}
            </button>
          ))}
        </div>

        {profileTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className={AP_LEDGER_CARD_CLASS}>
              <CardHeader>
                <CardTitle>Commercial vendor details</CardTitle>
              </CardHeader>
              <CardBody className="grid grid-cols-2 gap-4">
                {[
                  ['Legal / vendor name', selected.legalName],
                  ['Tax ID / ABN (masked)', selected.taxId ?? '—'],
                  ['Category', selected.category ?? '—'],
                  ['Primary contact', selected.contactName ?? '—'],
                  ['Vendor ID', selected.contractorNumber],
                  ['Email', selected.email ?? '—'],
                  ['Phone', selected.phone ?? '—'],
                  ['Location', selected.location ?? '—'],
                  [
                    'Outstanding AP balance',
                    formatContractorMoney(selected.outstandingInvoiceAmount, 'AUD'),
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted">{label}</p>
                    <p className="text-sm text-primary mt-0.5 font-medium">{value}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
            <Card className={AP_LEDGER_CARD_CLASS}>
              <CardHeader>
                <CardTitle>Non-Employee Invoice Payments</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                <p className="text-sm text-secondary">
                  Contractor payments flow exclusively through vendor invoices and commercial AP
                  settlement batches — isolated from employee payroll runs and salary structures.
                </p>
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-teal-200 dark:border-teal-900 bg-teal-50/40 dark:bg-teal-950/30">
                  <div>
                    <p className="text-sm font-medium text-primary">Awaiting AP approval</p>
                    <p className="text-xs text-muted">
                      {invoices.filter((row) => row.status === 'submitted').length} submitted
                      invoice(s) ·{' '}
                      {invoices.filter((row) => row.status === 'approved').length} approved ready to
                      batch
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate('contractor-invoices')}
                  >
                    Manage in AP Ledger
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {profileTab === 'contract' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">
                {contractorContracts.length} commercial agreement(s) registered for{' '}
                {displayName}
              </p>
              {canCreate && (
                <Button
                  size="sm"
                  className={AP_PRIMARY_BUTTON_CLASS}
                  onClick={() => setContractModalOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Contract
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {contractorContracts.length === 0 ? (
                <Card className="lg:col-span-3">
                  <CardBody className="py-10 text-center text-sm text-muted">
                    No contracts on file for this contractor.
                  </CardBody>
                </Card>
              ) : (
                contractorContracts.map((contract) => (
                  <Card key={contract.id} className={`lg:col-span-3 ${AP_LEDGER_CARD_CLASS}`}>
                    <CardHeader className="flex flex-row items-center justify-between gap-2">
                      <div>
                        <CardTitle>{contract.title}</CardTitle>
                        <p className="text-xs font-mono text-muted mt-0.5">
                          {contract.contractNumber}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {canEdit && contract.status !== 'terminated' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingTermsContract(contract)}
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" /> Configure Terms
                          </Button>
                        )}
                        <Badge tone={statusTone[deriveContractDisplayStatus(contract)]} dot>
                          {deriveContractDisplayStatus(contract)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardBody className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                      {[
                        ['Effective date', formatContractorDate(contract.startDate)],
                        ['Expiry date', formatContractorDate(contract.endDate)],
                        [
                          'Payment structure',
                          CONTRACTOR_PAYMENT_STRUCTURE_LABELS[contract.paymentStructure],
                        ],
                        [
                          'Contract value',
                          contract.fixedFeeAmount
                            ? formatContractorMoney(contract.fixedFeeAmount, contract.currency)
                            : contract.annualValue
                              ? formatContractorMoney(contract.annualValue, contract.currency)
                              : '—',
                        ],
                        [
                          'Hourly rate',
                          contract.hourlyRate
                            ? `${formatContractorMoney(contract.hourlyRate, contract.currency)}/hr`
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
                                  <p className="text-sm font-medium text-primary">
                                    {milestone.title}
                                  </p>
                                  <p className="text-xs text-muted">
                                    {milestone.targetDate
                                      ? `Due ${formatContractorDate(milestone.targetDate)}`
                                      : 'No target date'}{' '}
                                    · {milestone.status}
                                  </p>
                                </div>
                                <p className="text-sm font-mono font-medium text-primary">
                                  {formatContractorMoney(milestone.amount, contract.currency)}
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
          </div>
        )}

        {profileTab === 'invoices' && (
          <Card className={AP_LEDGER_CARD_CLASS}>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Invoices &amp; payments</CardTitle>
                <p className="text-xs text-muted mt-0.5">
                  {invoices.length} invoice(s) · Outstanding{' '}
                  {formatContractorMoney(selected.outstandingInvoiceAmount, 'AUD')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate('contractor-invoices')}
                >
                  Batch Payments Workspace
                </Button>
                {canCreate && (
                  <Button
                    size="sm"
                    className={AP_PRIMARY_BUTTON_CLASS}
                    disabled={contractorContracts.length === 0}
                    onClick={() => setInvoiceModalOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Create Invoice
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardBody className="p-0 overflow-x-auto">
              {invoices.length === 0 ? (
                <p className="p-6 text-sm text-muted text-center">No invoices yet.</p>
              ) : (
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-[rgb(var(--bg-muted))] text-[11px] uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Invoice</th>
                      <th className="px-4 py-2.5 font-medium">Period</th>
                      <th className="px-4 py-2.5 font-medium">Issued / due</th>
                      <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--border-base))]">
                    {invoices.map((invoice) => {
                      const overdue = isInvoiceOverdue(invoice);
                      const isBusy = invoiceActions.busyId === invoice.id;
                      return (
                        <tr key={invoice.id} className="hover:bg-[rgb(var(--bg-hover))]">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => invoiceActions.setDetailInvoice(invoice)}
                              className="font-mono text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300"
                            >
                              {invoice.invoiceNumber}
                            </button>
                            <p className="text-[11px] font-mono text-muted">
                              {invoice.contractNumber}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs text-secondary">
                            {invoice.periodLabel ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <p className="text-secondary">
                              {formatContractorDate(invoice.issuedAt)}
                            </p>
                            <p className={overdue ? 'text-error-600 font-semibold' : 'text-muted'}>
                              Due {formatContractorDate(invoice.dueAt)}
                              {overdue ? ' · OVERDUE' : ''}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono font-medium text-primary text-right">
                            {formatContractorMoney(invoice.amount, invoice.currency)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={INVOICE_STATUS_TONE[invoice.status]} dot>
                              {INVOICE_STATUS_LABELS[invoice.status]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => invoiceActions.setDetailInvoice(invoice)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {canEdit && invoice.status === 'draft' && (
                                <Button
                                  size="sm"
                                  className={AP_PRIMARY_BUTTON_CLASS}
                                  disabled={isBusy}
                                  onClick={() => invoiceActions.submitInvoice(invoice)}
                                >
                                  <Send className="h-3.5 w-3.5" /> Submit
                                </Button>
                              )}
                              {canApprove && invoice.status === 'submitted' && (
                                <>
                                  <Button
                                    size="sm"
                                    className={AP_PRIMARY_BUTTON_CLASS}
                                    disabled={isBusy}
                                    onClick={() => invoiceActions.approveInvoice(invoice)}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    disabled={isBusy}
                                    onClick={() => invoiceActions.openRejectModal(invoice)}
                                  >
                                    <XCircle className="h-3.5 w-3.5" /> Reject
                                  </Button>
                                </>
                              )}
                              {canFinalize &&
                                (invoice.status === 'approved' ||
                                  invoice.status === 'scheduled') && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={isBusy}
                                    onClick={() => invoiceActions.openPayModal(invoice)}
                                  >
                                    <CreditCard className="h-3.5 w-3.5" /> Mark Paid
                                  </Button>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        )}

        {companyId && (
          <>
            <ContractorContractModal
              open={contractModalOpen}
              onClose={() => setContractModalOpen(false)}
              companyId={companyId}
              contractor={selected}
              employees={employees}
              onCreated={async () => {
                await load();
              }}
            />
            <ContractorInvoiceFormModal
              open={invoiceModalOpen}
              onClose={() => setInvoiceModalOpen(false)}
              companyId={companyId}
              contractors={contractors}
              contracts={contracts}
              lockedContractorId={selected.id}
              onCreated={async () => {
                await load();
                await loadProfile(selected);
              }}
            />
          </>
        )}

        <ContractorInvoiceModals
          state={invoiceActions}
          canEdit={canEdit}
          canApprove={canApprove}
          canFinalize={canFinalize}
        />

        <ContractorPaymentTermsModal
          contract={editingTermsContract}
          onClose={() => setEditingTermsContract(null)}
          onUpdated={async () => {
            await load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <NonEmployeeApBanner
        activeScreen="directory"
        title="Vendors & Contractors"
        subtitle="External workforce directory, commercial contracts, and invoice-based payment structures"
        actions={
          <PermissionGate module="contractors" action="create">
            <Button
              className={AP_PRIMARY_BUTTON_CLASS}
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" /> Add vendor / contractor
            </Button>
          </PermissionGate>
        }
      />

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'External entities',
            value: summary?.totalContractors ?? contractors.length,
            note: `${categories.length} category tags`,
            icon: Building2,
            tone: 'text-teal-700 dark:text-teal-400',
          },
          {
            label: 'Active contracts',
            value: summary?.activeContracts ?? 0,
            note: `${summary?.pendingInvoiceCount ?? 0} AP invoices queued`,
            icon: CheckCircle2,
            tone: 'text-emerald-600',
          },
          {
            label: 'Expiring in 60 days',
            value: summary?.expiringWithin60Days ?? 0,
            note: 'Renewal review needed',
            icon: Clock3,
            tone: 'text-amber-600',
          },
          {
            label: 'Open AP / Overdue',
            value: formatContractorMoney(summary?.outstandingInvoiceAmount ?? '0', 'AUD'),
            note: `${summary?.overdueContracts ?? 0} expired/overdue contract(s)`,
            icon: AlertTriangle,
            tone: (summary?.overdueContracts ?? 0) > 0 ? 'text-error-600' : 'text-teal-700',
          },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className={AP_LEDGER_CARD_CLASS}>
              <CardBody className="p-4 flex justify-between gap-2">
                <div>
                  <p className="text-xs text-muted">{metric.label}</p>
                  <p className="text-xl font-bold font-mono text-primary mt-1">{metric.value}</p>
                  <p className="text-[11px] text-secondary mt-0.5">{metric.note}</p>
                </div>
                <Icon className={`h-5 w-5 shrink-0 ${metric.tone}`} />
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <Card className={`xl:col-span-3 ${AP_LEDGER_CARD_CLASS}`}>
          <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle>Commercial Contractor Directory</CardTitle>
              <p className="text-xs text-muted mt-0.5">{filtered.length} entity record(s)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-44 flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search vendors, ID..."
                  className="h-8 pl-8 py-0 text-xs"
                />
              </div>
              <Select
                value={kindFilter}
                onChange={(event) =>
                  setKindFilter(event.target.value as 'All' | ContractorKind)
                }
                className="h-8 py-0 text-xs w-36"
              >
                <option value="All">All types</option>
                <option value="consultant">Consultant</option>
                <option value="freelancer">Freelancer</option>
                <option value="vendor">Vendor</option>
              </Select>
              <Select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-8 py-0 text-xs w-40"
              >
                <option value="All">All categories</option>
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
                <option value="All">All statuses</option>
                <option>Active</option>
                <option>Expiring Soon</option>
                <option>Expired</option>
                <option>Draft</option>
              </Select>
              <div className="flex border border-base rounded-lg p-0.5">
                <button
                  onClick={() => setMode('cards')}
                  className={`h-7 w-7 rounded-md flex items-center justify-center ${
                    mode === 'cards'
                      ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300'
                      : 'text-muted'
                  }`}
                  aria-label="Card view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setMode('table')}
                  className={`h-7 w-7 rounded-md flex items-center justify-center ${
                    mode === 'table'
                      ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300'
                      : 'text-muted'
                  }`}
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
                    className="text-left rounded-xl border border-base border-l-4 border-l-teal-600 p-4 hover:border-teal-500 hover:shadow-card-hover transition-all bg-[rgb(var(--bg-surface))]"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={contractor.legalName} size="lg" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-primary truncate">
                              {contractor.displayName ?? contractor.legalName}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span
                                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${CONTRACTOR_KIND_BADGE_CLASSES[contractor.contractorKind]}`}
                              >
                                {CONTRACTOR_KIND_LABELS[contractor.contractorKind]}
                              </span>
                              <span className="text-[11px] font-mono text-muted">
                                {contractor.contractorNumber}
                              </span>
                            </div>
                          </div>
                          <Badge tone={statusTone[displayStatus]} dot>
                            {displayStatus}
                          </Badge>
                        </div>
                        <div className="mt-3 pt-3 border-t border-dashed border-base flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-secondary truncate">
                              {contract
                                ? `${CONTRACTOR_PAYMENT_STRUCTURE_LABELS[contract.paymentStructure]} · ${PAYMENT_TERMS_LABELS[contract.paymentTerms]}`
                                : contractor.contactName ?? 'No active contract'}
                            </p>
                            <p className="text-[11px] font-mono text-muted">
                              Open AP:{' '}
                              {formatContractorMoney(contractor.outstandingInvoiceAmount, 'AUD')}
                              {contractor.taxId ? ` · Tax ${contractor.taxId}` : ''}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-teal-700 shrink-0" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardBody>
          ) : (
            <CardBody className="p-0 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left">
                <thead className="bg-[rgb(var(--bg-muted))] text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Vendor / Contractor</th>
                    <th className="px-4 py-2.5 font-medium">Kind &amp; Category</th>
                    <th className="px-4 py-2.5 font-medium">Payment Structure</th>
                    <th className="px-4 py-2.5 font-medium text-right">Outstanding AP</th>
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
                          <p className="text-xs font-mono text-muted">
                            {contractor.contractorNumber}
                            {contractor.taxId ? ` · Tax ${contractor.taxId}` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${CONTRACTOR_KIND_BADGE_CLASSES[contractor.contractorKind]}`}
                          >
                            {CONTRACTOR_KIND_LABELS[contractor.contractorKind]}
                          </span>
                          <p className="text-xs text-secondary mt-0.5">
                            {contractor.category ?? '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-secondary">
                          {contract ? (
                            <>
                              <p className="font-medium text-primary">
                                {CONTRACTOR_PAYMENT_STRUCTURE_LABELS[contract.paymentStructure]}
                              </p>
                              <p className="text-[11px] text-muted">
                                {PAYMENT_TERMS_LABELS[contract.paymentTerms]}
                              </p>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono font-medium text-primary text-right">
                          {formatContractorMoney(contractor.outstandingInvoiceAmount, 'AUD')}
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

        <Card className={AP_LEDGER_CARD_CLASS}>
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
        description="Onboard a non-employee commercial entity and optionally attach primary payment terms."
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
            <Button
              onClick={() => void handleCreateContractor()}
              disabled={submitting}
              className={AP_PRIMARY_BUTTON_CLASS}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create vendor'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Legal / business name</Label>
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
            <Label>Tax ID / ABN / EIN (masked in UI &amp; API)</Label>
            <Input
              value={taxId}
              onChange={(event) => setTaxId(event.target.value)}
              placeholder="e.g. ABN-12-34567890"
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
          <div>
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
          <div className="sm:col-span-2 border-t border-base pt-4 mt-2 flex items-center justify-between">
            <p className="text-sm font-medium text-primary">Primary contract (optional)</p>
            <span className="text-[11px] text-muted">
              For milestone schedules, create vendor first then use New Contract
            </span>
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
            <Label>Payment structure</Label>
            <Select
              value={paymentStructure}
              onChange={(event) =>
                setPaymentStructure(
                  event.target.value as Exclude<ContractorPaymentStructure, 'milestone'>,
                )
              }
            >
              <option value="fixed_project_fee">Fixed project fee</option>
              <option value="hourly_invoice">Hourly rate</option>
            </Select>
          </div>
          <div>
            <Label>Payment terms</Label>
            <Select
              value={paymentTerms}
              onChange={(event) =>
                setPaymentTerms(event.target.value as ContractorPaymentTerms)
              }
            >
              {(Object.keys(PAYMENT_TERMS_LABELS) as ContractorPaymentTerms[]).map((key) => (
                <option key={key} value={key}>
                  {PAYMENT_TERMS_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>
          {paymentStructure === 'fixed_project_fee' ? (
            <div>
              <Label>Fixed fee / cap value</Label>
              <Input
                value={annualValue}
                onChange={(event) => setAnnualValue(event.target.value)}
                placeholder="120000.00"
              />
            </div>
          ) : (
            <div>
              <Label>Hourly rate</Label>
              <Input
                value={hourlyRate}
                onChange={(event) => setHourlyRate(event.target.value)}
                placeholder="95.00"
              />
            </div>
          )}
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
