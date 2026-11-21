import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  Clock,
  Coins,
  CreditCard,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Gauge,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import type { PlatformPlanDetailView } from '@hrm/shared-types';
import { usePlatformTenant } from '@/context/PlatformTenantContext';
import { PermissionGate } from '@/components/rbac';
import { usePermission } from '@/hooks/usePermission';
import { listPlatformPlans } from '@/lib/plans-api';
import { PlanEditorModal } from '@/components/plans/PlanEditorModal';
import { FeatureMatrixGrid } from '@/components/plans/FeatureMatrixGrid';
import { SubscriptionsList } from '@/components/subscriptions/SubscriptionsList';
import { InvoicesList } from '@/components/invoices/InvoicesList';
import { PaymentsList } from '@/components/payments/PaymentsList';

type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Failed';

interface Invoice {
  tenant: string;
  invoice: string;
  amount: number;
  status: InvoiceStatus;
  date: string;
}

const mockInvoices: Invoice[] = [
  { tenant: 'Acme Corporation', invoice: 'INV-2026-1082', amount: 4280, status: 'Paid', date: 'Aug 21, 2026' },
  { tenant: 'TechFlow Labs', invoice: 'INV-2026-1081', amount: 2180, status: 'Pending', date: 'Aug 20, 2026' },
  { tenant: 'Globex Industries', invoice: 'INV-2026-1079', amount: 5950, status: 'Failed', date: 'Aug 18, 2026' },
  { tenant: 'Northstar Retail', invoice: 'INV-2026-1074', amount: 2780, status: 'Paid', date: 'Aug 14, 2026' },
  { tenant: 'Orbit Logistics', invoice: 'INV-2026-1068', amount: 1620, status: 'Overdue', date: 'Aug 08, 2026' },
  { tenant: 'Vertex Health', invoice: 'INV-2026-1062', amount: 299, status: 'Paid', date: 'Aug 02, 2026' },
];

const invoiceStatuses: Array<'All' | InvoiceStatus> = ['All', 'Paid', 'Pending', 'Overdue', 'Failed'];

const statusTone: Record<InvoiceStatus, string> = {
  Paid: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  Pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  Overdue: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  Failed: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
};

function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h2 className="font-extrabold text-slate-900 dark:text-white text-lg">{title}</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

export function PlatformBillingPage() {
  const { selectedTenant, setSelectedTenant } = usePlatformTenant();
  const canEditBilling = usePermission('billing', 'edit');
  const canCreateBilling = usePermission('billing', 'create');

  // Active Tab state
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'plans' | 'matrix' | 'invoices' | 'payments'>('subscriptions');

  // Live Plans state
  const [plans, setPlans] = useState<PlatformPlanDetailView[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  // Editor Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlatformPlanDetailView | null>(null);

  // Invoices & Payment recovery state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'All' | InvoiceStatus>('All');

  const loadPlans = async () => {
    try {
      setIsLoadingPlans(true);
      setPlansError(null);
      const data = await listPlatformPlans();
      setPlans(data);
    } catch (err: any) {
      setPlansError(err.message || 'Failed to load plans from server.');
    } finally {
      setIsLoadingPlans(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const openCreateModal = () => {
    setEditingPlan(null);
    setIsEditorOpen(true);
  };

  const openEditModal = (plan: PlatformPlanDetailView) => {
    setEditingPlan(plan);
    setIsEditorOpen(true);
  };

  const filteredInvoices = useMemo(() => {
    return mockInvoices.filter((invoice) => {
      if (
        selectedTenant &&
        !invoice.tenant.toLowerCase().includes(selectedTenant.name.toLowerCase()) &&
        !selectedTenant.name.toLowerCase().includes(invoice.tenant.toLowerCase())
      ) {
        return false;
      }
      const matchesSearch = `${invoice.tenant} ${invoice.invoice}`.toLowerCase().includes(search.toLowerCase());
      return matchesSearch && (status === 'All' || invoice.status === status);
    });
  }, [search, status, selectedTenant]);

  const exportInvoices = () => {
    const rows = [
      ['Tenant', 'Invoice', 'Amount', 'Status', 'Date'],
      ...filteredInvoices.map((invoice) => [invoice.tenant, invoice.invoice, invoice.amount.toString(), invoice.status, invoice.date]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'platform-invoices.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            <CreditCard className="h-4 w-4" /> Monetization & Entitlements
          </div>
          <h1 className="text-2xl font-extrabold lg:text-3xl text-slate-900 dark:text-white">
            Plans, Pricing & Subscriptions
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Define commercial tiers, manage effective-dated pricing, set platform caps, and configure the feature matrix grid.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(canEditBilling || canCreateBilling) && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-sm"
            >
              <Plus className="h-4 w-4" /> Create New Plan
            </button>
          )}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-right dark:border-indigo-800 dark:bg-indigo-950/40">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
              Active Tier Count
            </div>
            <div className="text-xl font-extrabold text-indigo-700 dark:text-indigo-200">
              {plans.length} Plans
            </div>
          </div>
        </div>
      </div>

      {/* Tenant Context Filter Banner */}
      {selectedTenant && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase font-extrabold tracking-wider text-amber-400">
                  Tenant Scope Active:
                </span>
                <span className="text-sm font-bold text-white">{selectedTenant.name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-purple-500/20 text-purple-300 border-purple-500/30">
                  Plan: {selectedTenant.plan}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  Status: {selectedTenant.status}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>Invoices & subscription views filtered to {selectedTenant.subdomain}.cmsnbd.com</span>
                <span>·</span>
                <span className="text-amber-300 font-medium">Business payroll data strictly isolated</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedTenant(null)}
            className="h-8 px-3 rounded-lg border border-slate-700 hover:border-slate-600 text-xs text-slate-300 hover:text-white transition-colors self-start sm:self-center"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('subscriptions')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition -mb-px ${
            activeTab === 'subscriptions'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Users className="h-4 w-4" /> Tenant Subscriptions Directory
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('plans')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition -mb-px ${
            activeTab === 'plans'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="h-4 w-4" /> Commercial Plans Catalog
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition -mb-px ${
            activeTab === 'matrix'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Sparkles className="h-4 w-4" /> Feature Matrix Grid
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition -mb-px ${
            activeTab === 'invoices'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <CreditCard className="h-4 w-4" /> Invoices Directory
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition -mb-px ${
            activeTab === 'payments'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Coins className="h-4 w-4" /> Payments & Dunning Recovery
        </button>
      </div>

      {/* Tab 1: Subscriptions Directory */}
      {activeTab === 'subscriptions' && (
        <SubscriptionsList
          plans={plans}
          selectedTenantId={selectedTenant?.id}
        />
      )}

      {/* Tab 2: Commercial Plans Catalog */}
      {activeTab === 'plans' && (
        <section className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle
            title="Subscription Plans Catalog"
            detail="Commercial tiers available for tenant subscription. Controls quotas and base feature entitlements."
          />
          <button
            type="button"
            onClick={loadPlans}
            disabled={isLoadingPlans}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingPlans ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {plansError && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{plansError}</span>
          </div>
        )}

        {isLoadingPlans && plans.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-sm font-semibold">Loading subscription plans catalog...</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {plans.map((plan) => {
              // Extract primary USD price or first active price
              const activePrices = (plan.prices ?? []).filter(
                (p) => !p.effectiveTo || new Date(p.effectiveTo) > new Date(),
              );
              const monthlyPrice = activePrices.find((p) => p.billingCycle === 'monthly' && p.currency === 'USD') ?? activePrices[0];
              const employeeLimit = (plan.limits ?? []).find((l) => l.limitKey === 'employees');
              const storageLimit = (plan.limits ?? []).find((l) => l.limitKey === 'storage_gb');
              const activeFeaturesCount = (plan.features ?? []).filter((f) => f.enabled).length;

              return (
                <article
                  key={plan.id}
                  className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md dark:bg-slate-900 ${
                    plan.code === 'business'
                      ? 'border-indigo-400 ring-2 ring-indigo-500/10'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    {/* Header: Name, Rank & Visibility Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                            {plan.name}
                          </h3>
                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            #{plan.rank}
                          </span>
                        </div>
                        <p className="mt-1 min-h-8 text-xs leading-4 text-slate-500 dark:text-slate-400 line-clamp-2">
                          {plan.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            plan.isActive
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {plan.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          {plan.isActive ? 'Public' : 'Hidden'}
                        </span>
                        {plan.code === 'business' && (
                          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                            Popular
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price Card Preview */}
                    <div className="mt-4 p-3 rounded-xl border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Active Price
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                          {monthlyPrice ? `$${monthlyPrice.amount.toFixed(0)}` : 'Free'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {monthlyPrice ? `/${monthlyPrice.billingCycle === 'annual' ? 'yr' : 'mo'}` : ''}
                        </span>
                        {monthlyPrice && monthlyPrice.currency !== 'USD' && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            ({monthlyPrice.currency})
                          </span>
                        )}
                      </div>
                      {monthlyPrice?.perSeatAmount ? (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          + ${monthlyPrice.perSeatAmount.toFixed(2)} / seat / mo
                        </div>
                      ) : null}
                    </div>

                    {/* Limits & Feature Counts */}
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Gauge className="h-3.5 w-3.5 text-slate-400" /> Max Employees:
                        </span>
                        <span className="font-bold">
                          {employeeLimit && employeeLimit.value !== null
                            ? employeeLimit.value.toLocaleString()
                            : '∞ Unlimited'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Layers className="h-3.5 w-3.5 text-slate-400" /> Cloud Storage:
                        </span>
                        <span className="font-bold">
                          {storageLimit && storageLimit.value !== null
                            ? `${storageLimit.value} GB`
                            : '∞ Unlimited'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 py-1">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Features:
                        </span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {activeFeaturesCount} Enabled
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Edit Plan Action */}
                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => openEditModal(plan)}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 rounded-xl transition"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit Plan & Pricing
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        </section>
      )}

      {/* Tab 3: Interactive Feature Matrix Grid */}
      {activeTab === 'matrix' && (
        <section>
          <FeatureMatrixGrid
            plans={plans}
            onPlanUpdated={loadPlans}
            canEdit={canEditBilling}
          />
        </section>
      )}

      {/* Tab 4: Invoices Directory */}
      {activeTab === 'invoices' && (
        <InvoicesList />
      )}

      {/* Tab 5: Payments & Dunning Recovery */}
      {activeTab === 'payments' && (
        <PaymentsList selectedTenantId={selectedTenant?.id} />
      )}

      {/* Plan Editor & Creator Modal */}
      <PlanEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        plan={editingPlan}
        onSuccess={loadPlans}
        canEdit={canEditBilling || canCreateBilling}
      />
    </div>
  );
}
