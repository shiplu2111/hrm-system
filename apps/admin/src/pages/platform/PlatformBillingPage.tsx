import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  CreditCard,
  Download,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

type TierName = 'Free' | 'Starter' | 'Business' | 'Enterprise';
type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Failed';

interface Plan {
  name: TierName;
  price: string;
  description: string;
  features: string[];
}

interface Invoice {
  tenant: string;
  invoice: string;
  amount: number;
  status: InvoiceStatus;
  date: string;
}

const initialPlans: Plan[] = [
  { name: 'Free', price: '0', description: 'For small teams evaluating core HR.', features: ['25 employees', 'Core employee records', 'Community support'] },
  { name: 'Starter', price: '299', description: 'Essential people operations for growing teams.', features: ['250 employees', 'Attendance & leave', 'Email support'] },
  { name: 'Business', price: '899', description: 'Advanced automation for scaling companies.', features: ['1,000 employees', 'Payroll & recruitment', 'Analytics workspace'] },
  { name: 'Enterprise', price: 'Custom', description: 'Flexible controls for complex organizations.', features: ['Unlimited employees', 'SSO, SCIM & API', 'Priority support'] },
];

const moduleGroups = [
  { name: 'Core HR', count: 7, access: { Free: true, Starter: true, Business: true, Enterprise: true } },
  { name: 'Time & Attendance', count: 6, access: { Free: false, Starter: true, Business: true, Enterprise: true } },
  { name: 'Leave & Scheduling', count: 5, access: { Free: false, Starter: true, Business: true, Enterprise: true } },
  { name: 'Payroll', count: 7, access: { Free: false, Starter: false, Business: true, Enterprise: true } },
  { name: 'Talent & Recruitment', count: 5, access: { Free: false, Starter: false, Business: true, Enterprise: true } },
  { name: 'Performance', count: 4, access: { Free: false, Starter: false, Business: true, Enterprise: true } },
  { name: 'Expenses & Benefits', count: 4, access: { Free: false, Starter: false, Business: true, Enterprise: true } },
  { name: 'Analytics', count: 4, access: { Free: false, Starter: false, Business: true, Enterprise: true } },
  { name: 'Platform & Security', count: 5, access: { Free: false, Starter: false, Business: false, Enterprise: true } },
] satisfies { name: string; count: number; access: Record<TierName, boolean> }[];

const invoices: Invoice[] = [
  { tenant: 'Acme Corporation', invoice: 'INV-2026-1082', amount: 4280, status: 'Paid', date: 'Aug 21, 2026' },
  { tenant: 'TechFlow Labs', invoice: 'INV-2026-1081', amount: 2180, status: 'Pending', date: 'Aug 20, 2026' },
  { tenant: 'Globex Industries', invoice: 'INV-2026-1079', amount: 5950, status: 'Failed', date: 'Aug 18, 2026' },
  { tenant: 'Northstar Retail', invoice: 'INV-2026-1074', amount: 2780, status: 'Paid', date: 'Aug 14, 2026' },
  { tenant: 'Orbit Logistics', invoice: 'INV-2026-1068', amount: 1620, status: 'Overdue', date: 'Aug 08, 2026' },
  { tenant: 'Vertex Health', invoice: 'INV-2026-1062', amount: 299, status: 'Paid', date: 'Aug 02, 2026' },
];

const tiers: TierName[] = ['Free', 'Starter', 'Business', 'Enterprise'];
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
      <h2 className="font-extrabold text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

export function PlatformBillingPage() {
  const [plans, setPlans] = useState(initialPlans);
  const [moduleAccess, setModuleAccess] = useState(() =>
    Object.fromEntries(moduleGroups.map((group) => [group.name, { ...group.access }])) as Record<string, Record<TierName, boolean>>,
  );
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'All' | InvoiceStatus>('All');
  const [retrying, setRetrying] = useState(false);
  const [failureResolved, setFailureResolved] = useState(false);

  const filteredInvoices = useMemo(() => invoices.filter((invoice) => {
    const matchesSearch = `${invoice.tenant} ${invoice.invoice}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (status === 'All' || invoice.status === status);
  }), [search, status]);

  const updatePlan = (planIndex: number, field: 'price' | 'feature', value: string, featureIndex?: number) => {
    setPlans((current) => current.map((plan, index) => {
      if (index !== planIndex) return plan;
      if (field === 'price') return { ...plan, price: value };
      return { ...plan, features: plan.features.map((feature, itemIndex) => itemIndex === featureIndex ? value : feature) };
    }));
  };

  const addFeature = (planIndex: number) => {
    setPlans((current) => current.map((plan, index) =>
      index === planIndex ? { ...plan, features: [...plan.features, 'New feature'] } : plan,
    ));
  };

  const removeFeature = (planIndex: number, featureIndex: number) => {
    setPlans((current) => current.map((plan, index) =>
      index === planIndex ? { ...plan, features: plan.features.filter((_, itemIndex) => itemIndex !== featureIndex) } : plan,
    ));
  };

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

  const retryPayment = () => {
    setRetrying(true);
    window.setTimeout(() => {
      setRetrying(false);
      setFailureResolved(true);
    }, 900);
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-300">
            <CreditCard className="h-4 w-4" /> REVENUE OPERATIONS
          </div>
          <h1 className="text-2xl font-extrabold lg:text-3xl">Subscriptions & Billing</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage platform pricing, entitlements, invoices and payment recovery.</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-right dark:border-indigo-800 dark:bg-indigo-950/40">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Monthly recurring revenue</div>
          <div className="text-xl font-extrabold text-indigo-700 dark:text-indigo-200">$284,610</div>
        </div>
      </div>

      {!failureResolved ? (
        <section className="overflow-hidden rounded-2xl border border-red-200 bg-red-50 shadow-sm dark:border-red-900 dark:bg-red-950/30">
          <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white"><AlertTriangle className="h-5 w-5" /></div>
              <div>
                <div className="font-extrabold text-red-900 dark:text-red-100">Payment recovery in progress</div>
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">Globex Industries · $5,950 · Visa •••• 1842 · 2 automated retries failed</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                  <span className="rounded-lg border border-red-200 bg-white/70 px-2.5 py-1.5 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"><Clock className="mr-1 inline h-3.5 w-3.5" /> Retry in 04:18:32</span>
                  <span className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300">Grace period: 3 days left</span>
                </div>
                <div className="mt-3 h-1.5 max-w-md overflow-hidden rounded-full bg-red-200 dark:bg-red-950"><div className="h-full w-[72%] rounded-full bg-gradient-to-r from-orange-500 to-red-600" /></div>
              </div>
            </div>
            <button onClick={retryPayment} disabled={retrying} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} /> {retrying ? 'Retrying…' : 'Retry now'}
            </button>
          </div>
        </section>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"><Check className="h-4 w-4" /> Payment retry succeeded and the tenant is back in good standing.</div>
      )}

      <section>
        <SectionTitle title="Plan tier management" detail="Prices and feature copy are editable locally. Changes remain in this workspace." />
        <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {plans.map((plan, planIndex) => (
            <article key={plan.name} className={`rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900 ${plan.name === 'Business' ? 'border-indigo-400 ring-2 ring-indigo-500/10' : 'border-slate-200 dark:border-slate-800'}`}>
              <div className="flex items-start justify-between">
                <div><h3 className="text-lg font-extrabold">{plan.name}</h3><p className="mt-1 min-h-8 text-[11px] leading-4 text-slate-500">{plan.description}</p></div>
                {plan.name === 'Business' && <span className="rounded-full bg-indigo-600 px-2 py-1 text-[9px] font-bold text-white">POPULAR</span>}
              </div>
              <div className="mt-4 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-950">
                <span className="text-lg font-bold text-slate-400">$</span>
                <input aria-label={`${plan.name} monthly price`} value={plan.price} onChange={(event) => updatePlan(planIndex, 'price', event.target.value)} className="h-11 min-w-0 flex-1 bg-transparent px-2 text-2xl font-extrabold outline-none" />
                <span className="text-[10px] text-slate-500">/ month</span>
              </div>
              <div className="mt-4 space-y-2">
                {plan.features.map((feature, featureIndex) => (
                  <div key={`${plan.name}-${featureIndex}`} className="group flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <input aria-label={`${plan.name} feature ${featureIndex + 1}`} value={feature} onChange={(event) => updatePlan(planIndex, 'feature', event.target.value, featureIndex)} className="h-8 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-xs outline-none hover:border-slate-200 focus:border-indigo-400 dark:hover:border-slate-700" />
                    <button onClick={() => removeFeature(planIndex, featureIndex)} className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500" aria-label={`Remove ${feature}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => addFeature(planIndex)} className="mt-3 flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-300"><Plus className="h-3.5 w-3.5" /> Add feature</button>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800"><SectionTitle title="Module access matrix" detail="47 modules grouped into 9 product areas. Toggle access for each commercial tier." /></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-950/50">
              <tr><th className="px-5 py-3">Module group</th>{tiers.map((tier) => <th key={tier} className="px-4 py-3 text-center">{tier}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {moduleGroups.map((group) => (
                <tr key={group.name} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="px-5 py-3"><span className="text-sm font-bold">{group.name}</span><span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">{group.count} modules</span></td>
                  {tiers.map((tier) => (
                    <td key={tier} className="px-4 py-3 text-center">
                      <input type="checkbox" aria-label={`${group.name} access for ${tier}`} checked={moduleAccess[group.name][tier]} onChange={(event) => setModuleAccess((current) => ({ ...current, [group.name]: { ...current[group.name], [tier]: event.target.checked } }))} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 xl:flex-row xl:items-center xl:justify-between">
          <SectionTitle title="Cross-tenant invoices" detail={`${filteredInvoices.length} invoices shown across all subscription accounts.`} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tenant or invoice…" className="h-10 w-full rounded-xl border border-slate-200 bg-transparent pl-9 pr-3 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 sm:w-64" /></div>
            <select value={status} onChange={(event) => setStatus(event.target.value as 'All' | InvoiceStatus)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-950">{invoiceStatuses.map((item) => <option key={item}>{item}</option>)}</select>
            <button onClick={exportInvoices} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-500"><Download className="h-4 w-4" /> Export</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-950/50"><tr><th className="px-5 py-3">Tenant</th><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInvoices.map((invoice) => <tr key={invoice.invoice} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20"><td className="px-5 py-4 text-sm font-bold">{invoice.tenant}</td><td className="px-4 py-4 font-mono text-xs text-indigo-600 dark:text-indigo-300">{invoice.invoice}</td><td className="px-4 py-4 text-sm font-extrabold">${invoice.amount.toLocaleString()}</td><td className="px-4 py-4"><span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${statusTone[invoice.status]}`}>{invoice.status}</span></td><td className="px-4 py-4 text-xs text-slate-500">{invoice.date}</td></tr>)}
              {filteredInvoices.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">No invoices match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
