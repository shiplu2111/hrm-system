import { useMemo, useState, type ComponentType } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Database,
  ExternalLink,
  FileClock,
  Flag,
  Gauge,
  Globe2,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Server,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  TicketCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCog,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { Modal } from '@/components/ui/Modal';
import { Toggle, Avatar } from '@/components/ui/Toggle';
import { Dropdown, DropdownDivider, DropdownHeader, DropdownItem } from '@/components/ui/Dropdown';
import { PortalSwitcher } from '@/components/layout/PortalSwitcher';
import { PlatformBillingPage } from '@/pages/platform/PlatformBillingPage';
import { FeatureFlagsPage } from '@/pages/platform/FeatureFlagsPage';
import { SystemHealthPage } from '@/pages/platform/SystemHealthPage';
import { PlatformUsersPage } from '@/pages/platform/PlatformUsersPage';
import { SupportTicketsPage } from '@/pages/platform/SupportTicketsPage';
import { PlatformSettingsPage } from '@/pages/platform/PlatformSettingsPage';
import { PlatformAuditPage } from '@/pages/platform/PlatformAuditPage';
import { CountryCompliancePage } from '@/pages/platform/CountryCompliancePage';
import { TenantIsolationPage } from '@/pages/platform/TenantIsolationPage';

type PlatformView =
  | 'dashboard'
  | 'tenants'
  | 'billing'
  | 'users'
  | 'health'
  | 'features'
  | 'support'
  | 'settings'
  | 'audit'
  | 'country-compliance'
  | 'tenant-isolation'
  | 'tenant-detail'
  | 'create-tenant';

type TenantStatus = 'Active' | 'Trial' | 'Suspended' | 'Cancelled';

interface Tenant {
  id: string;
  name: string;
  domain: string;
  plan: 'Starter' | 'Business' | 'Enterprise';
  employees: number;
  status: TenantStatus;
  mrr: number;
  signup: string;
  health: number;
  region: string;
  country: string;
  admin: string;
  email: string;
}

const tenants: Tenant[] = [
  { id: 'acme', name: 'Acme Corporation', domain: 'acme.nexushr.com', plan: 'Enterprise', employees: 1248, status: 'Active', mrr: 4280, signup: 'Jan 12, 2024', health: 94, region: 'North America', country: 'United States', admin: 'Olivia Martin', email: 'olivia@acme.com' },
  { id: 'techflow', name: 'TechFlow Labs', domain: 'techflow.nexushr.com', plan: 'Business', employees: 684, status: 'Active', mrr: 2180, signup: 'Mar 08, 2024', health: 88, region: 'Asia Pacific', country: 'Singapore', admin: 'Ethan Lim', email: 'ethan@techflow.io' },
  { id: 'globex', name: 'Globex Industries', domain: 'globex.nexushr.com', plan: 'Enterprise', employees: 2106, status: 'Suspended', mrr: 5950, signup: 'Nov 21, 2023', health: 42, region: 'Europe', country: 'Germany', admin: 'Mia Weber', email: 'mia@globex.de' },
  { id: 'northstar', name: 'Northstar Retail', domain: 'northstar.nexushr.com', plan: 'Business', employees: 932, status: 'Active', mrr: 2780, signup: 'Apr 17, 2024', health: 81, region: 'Europe', country: 'United Kingdom', admin: 'Noah Clarke', email: 'noah@northstar.co.uk' },
  { id: 'vertex', name: 'Vertex Health', domain: 'vertex.nexushr.com', plan: 'Starter', employees: 184, status: 'Trial', mrr: 0, signup: 'Aug 19, 2026', health: 68, region: 'Asia Pacific', country: 'Australia', admin: 'Ava Wilson', email: 'ava@vertex.health' },
  { id: 'orbit', name: 'Orbit Logistics', domain: 'orbit.nexushr.com', plan: 'Business', employees: 516, status: 'Cancelled', mrr: 0, signup: 'Sep 04, 2023', health: 24, region: 'Middle East', country: 'UAE', admin: 'Omar Rahman', email: 'omar@orbit.ae' },
];

const navItems: { key: PlatformView; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: 'dashboard', label: 'Platform Dashboard', icon: LayoutDashboard },
  { key: 'tenants', label: 'Tenants / Companies', icon: Building2 },
  { key: 'tenant-isolation', label: 'Tenant Isolation', icon: Database },
  { key: 'country-compliance', label: 'Country Configuration', icon: Globe2 },
  { key: 'billing', label: 'Subscriptions & Billing', icon: CreditCard },
  { key: 'users', label: 'Platform Users', icon: UserCog },
  { key: 'health', label: 'System Health', icon: Activity },
  { key: 'features', label: 'Feature Flags', icon: SlidersHorizontal },
  { key: 'support', label: 'Support Tickets', icon: Headphones },
  { key: 'settings', label: 'Platform Settings', icon: Settings },
  { key: 'audit', label: 'Audit Log', icon: FileClock },
];

const kpis = [
  { label: 'Total Tenants', value: '128', change: '+6 this month', icon: Building2, tone: 'indigo' },
  { label: 'Active Subscriptions', value: '112', change: '87.5% conversion', icon: CheckCircle2, tone: 'emerald' },
  { label: 'Monthly Recurring Revenue', value: '$284.6K', change: '+12.4% vs last month', icon: CircleDollarSign, tone: 'violet' },
  { label: 'Employees on Platform', value: '84,216', change: '+3,108 this month', icon: Users, tone: 'blue' },
  { label: 'Churn Rate', value: '1.8%', change: '-0.4% improvement', icon: TrendingDown, tone: 'emerald' },
  { label: 'New Signups', value: '26', change: 'August 2026', icon: Sparkles, tone: 'cyan' },
  { label: 'Trial Accounts', value: '16', change: '5 expire this week', icon: FileClock, tone: 'orange' },
  { label: 'Support Tickets Open', value: '37', change: '8 high priority', icon: TicketCheck, tone: 'orange' },
];

const revenue = [152, 161, 174, 182, 195, 211, 226, 238, 249, 262, 273, 285];
const growth = [64, 70, 76, 83, 90, 98, 104, 111, 116, 121, 124, 128];
const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];

const modules = [
  { phase: 'Phase 1', name: 'Core HR & Employee Records', enabled: true },
  { phase: 'Phase 1', name: 'Attendance & Leave', enabled: true },
  { phase: 'Phase 1', name: 'Payroll & Payslips', enabled: true },
  { phase: 'Phase 2', name: 'Recruitment / ATS', enabled: true },
  { phase: 'Phase 2', name: 'Onboarding & Offboarding', enabled: true },
  { phase: 'Phase 2', name: 'Expense Management', enabled: false },
  { phase: 'Phase 3', name: 'Performance & Goals', enabled: false },
  { phase: 'Phase 3', name: 'Learning Management', enabled: false },
  { phase: 'Phase 3', name: 'Workforce Analytics', enabled: true },
];

function statusTone(status: TenantStatus) {
  if (status === 'Active') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
  if (status === 'Trial') return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
  if (status === 'Suspended') return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800';
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
}

function planTone(plan: Tenant['plan']) {
  if (plan === 'Enterprise') return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800';
  if (plan === 'Business') return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
}

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;
}

function HealthScore({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color} shadow-sm`} />
      <span className="text-xs font-mono font-bold">{score}</span>
    </div>
  );
}

function LineChart() {
  const points = revenue.map((value, index) => `${(index / 11) * 100},${92 - ((value - 145) / 150) * 78}`).join(' ');
  return (
    <div className="h-64 pt-4">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-48 w-full overflow-visible">
        {[20, 40, 60, 80].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="0.4" />)}
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,100 ${points} 100,100`} fill="url(#revenueFill)" />
        <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {revenue.map((value, index) => (
          <circle key={value} cx={(index / 11) * 100} cy={92 - ((value - 145) / 150) * 78} r="1.15" fill="#6366f1" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="grid grid-cols-12 gap-1 text-[9px] text-slate-400 mt-2">
        {months.map((month) => <span key={month} className="text-center">{month}</span>)}
      </div>
    </div>
  );
}

function GrowthChart() {
  const max = Math.max(...growth);
  return (
    <div className="h-64 flex items-end gap-2 pt-8">
      {growth.map((value, index) => (
        <div key={months[index]} className="flex-1 h-full flex flex-col justify-end items-center gap-2 group">
          <span className="text-[9px] font-mono text-slate-400 opacity-0 group-hover:opacity-100">{value}</span>
          <div className="w-full rounded-t-md bg-gradient-to-t from-violet-600 to-indigo-400 hover:from-violet-500 hover:to-indigo-300 transition-all" style={{ height: `${(value / max) * 80}%` }} />
          <span className="text-[9px] text-slate-400">{months[index]}</span>
        </div>
      ))}
    </div>
  );
}

function Dashboard({ onOpenTenants }: { onOpenTenants: () => void }) {
  const tone: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
    cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-300 font-bold mb-2">
            <Zap className="h-3.5 w-3.5" /> PLATFORM CONTROL PLANE
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold">Platform Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Cross-tenant growth, revenue and operating health.</p>
        </div>
        <button className="h-10 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-900/15">
          <AlertTriangle className="h-4 w-4" /> Open incident console
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, change, icon: Icon, tone: color }) => (
          <div key={label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${tone[color]}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-300" />
            </div>
            <div className="text-2xl font-extrabold mt-3">{value}</div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">{label}</div>
            <div className={`text-[10px] mt-1 ${change.startsWith('+') || change.startsWith('-0') ? 'text-emerald-600' : 'text-slate-400'}`}>{change}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-bold">Revenue trend</h2>
              <p className="text-xs text-slate-500 mt-0.5">Monthly recurring revenue · USD thousands</p>
            </div>
            <Pill className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              <TrendingUp className="h-3 w-3 mr-1" /> 12.4%
            </Pill>
          </div>
          <LineChart />
        </section>
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div>
            <h2 className="font-bold">Tenant growth</h2>
            <p className="text-xs text-slate-500 mt-0.5">Cumulative active companies</p>
          </div>
          <GrowthChart />
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Tenants at risk</h2>
              <p className="text-xs text-slate-500 mt-0.5">Accounts requiring operator attention</p>
            </div>
            <button onClick={onOpenTenants} className="text-xs font-bold text-indigo-600 dark:text-indigo-300">View tenants</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[
              { company: 'Globex Industries', issue: 'Payment failed · 2 retries', tone: 'red', icon: CreditCard },
              { company: 'Orbit Logistics', issue: 'Usage down 48% in 30 days', tone: 'amber', icon: TrendingDown },
              { company: 'Vertex Health', issue: 'Trial expires in 2 days', tone: 'amber', icon: FileClock },
              { company: 'Pioneer Foods', issue: 'Health score dropped to 51', tone: 'red', icon: Gauge },
            ].map(({ company, issue, tone: riskTone, icon: Icon }) => (
              <button key={company} onClick={onOpenTenants} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${riskTone === 'red' ? 'bg-red-50 text-red-600 dark:bg-red-950/40' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold">{company}</div>
                  <div className={`text-[11px] mt-0.5 ${riskTone === 'red' ? 'text-red-600' : 'text-amber-600'}`}>{issue}</div>
                </div>
                <Flag className={`h-4 w-4 ${riskTone === 'red' ? 'text-red-500' : 'text-amber-500'}`} />
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-bold">Recent platform activity</h2>
            <p className="text-xs text-slate-500 mt-0.5">Commercial lifecycle events across all tenants</p>
          </div>
          <div className="p-5 space-y-4">
            {[
              { title: 'Vertex Health started a trial', meta: '4 minutes ago · Australia', icon: Sparkles, color: 'bg-indigo-500' },
              { title: 'TechFlow Labs upgraded to Business', meta: '38 minutes ago · +$840 MRR', icon: TrendingUp, color: 'bg-emerald-500' },
              { title: 'Orbit Logistics cancelled subscription', meta: '2 hours ago · -$1,620 MRR', icon: TrendingDown, color: 'bg-red-500' },
              { title: 'Northstar Retail added 125 seats', meta: '5 hours ago · Enterprise expansion', icon: Users, color: 'bg-violet-500' },
              { title: 'Globex downgraded payroll add-on', meta: 'Yesterday · Effective next cycle', icon: CreditCard, color: 'bg-amber-500' },
            ].map(({ title, meta, icon: Icon, color }, index) => (
              <div key={title} className="flex items-start gap-3 relative">
                {index < 4 && <div className="absolute left-[15px] top-8 h-7 w-px bg-slate-200 dark:bg-slate-700" />}
                <div className={`h-8 w-8 rounded-full ${color} text-white flex items-center justify-center shrink-0`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{meta}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function TenantsList({
  onSelect,
  onCreate,
}: {
  onSelect: (tenant: Tenant) => void;
  onCreate: () => void;
}) {
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('All');
  const [status, setStatus] = useState('All');
  const [region, setRegion] = useState('All');
  const filtered = tenants.filter((tenant) =>
    `${tenant.name} ${tenant.domain}`.toLowerCase().includes(search.toLowerCase())
    && (plan === 'All' || tenant.plan === plan)
    && (status === 'All' || tenant.status === status)
    && (region === 'All' || tenant.region === region),
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Tenants / Companies</h1>
          <p className="text-sm text-slate-500 mt-1">Manage every organization on the Nexus HR platform.</p>
        </div>
        <button onClick={onCreate} className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/15">
          <Plus className="h-4 w-4" /> Create New Tenant
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company or subdomain..." className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          {[
            { value: plan, setter: setPlan, values: ['All', 'Starter', 'Business', 'Enterprise'], label: 'Plan' },
            { value: status, setter: setStatus, values: ['All', 'Active', 'Trial', 'Suspended', 'Cancelled'], label: 'Status' },
            { value: region, setter: setRegion, values: ['All', 'North America', 'Europe', 'Asia Pacific', 'Middle East'], label: 'Region' },
          ].map((filter) => (
            <select key={filter.label} value={filter.value} onChange={(event) => filter.setter(event.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-indigo-400">
              {filter.values.map((value) => <option key={value}>{value === 'All' ? `All ${filter.label}s` : value}</option>)}
            </select>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>{filtered.length} companies found</span>
          <button className="flex items-center gap-1.5 hover:text-indigo-600"><SlidersHorizontal className="h-3.5 w-3.5" /> Customize columns</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead className="bg-slate-50 dark:bg-slate-950/50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Company</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Employees</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">MRR</th><th className="px-4 py-3">Signup</th><th className="px-4 py-3">Health</th><th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((tenant) => (
                <tr key={tenant.id} onClick={() => onSelect(tenant)} className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center text-[10px] font-extrabold">{tenant.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
                      <div><div className="text-sm font-bold">{tenant.name}</div><div className="text-[11px] text-slate-500">{tenant.domain}</div></div>
                    </div>
                  </td>
                  <td className="px-4 py-4"><Pill className={planTone(tenant.plan)}>{tenant.plan}</Pill></td>
                  <td className="px-4 py-4 text-sm font-mono">{tenant.employees.toLocaleString()}</td>
                  <td className="px-4 py-4"><Pill className={statusTone(tenant.status)}>{tenant.status}</Pill></td>
                  <td className="px-4 py-4 text-sm font-mono font-bold">${tenant.mrr.toLocaleString()}</td>
                  <td className="px-4 py-4 text-xs text-slate-500">{tenant.signup}</td>
                  <td className="px-4 py-4"><HealthScore score={tenant.health} /></td>
                  <td className="px-4 py-4"><MoreHorizontal className="h-4 w-4 text-slate-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TenantDetail({ tenant, onBack }: { tenant: Tenant; onBack: () => void }) {
  const [tab, setTab] = useState('Overview');
  const [featureStates, setFeatureStates] = useState(() => Object.fromEntries(modules.map((module) => [module.name, module.enabled])));
  const [action, setAction] = useState<'suspend' | 'plan' | 'trial' | 'impersonate' | 'archive' | null>(null);
  const tabs = ['Overview', 'Subscription & Billing', 'Modules & Feature Access', 'Users', 'Activity Log'];

  const actionCopy = {
    suspend: ['Suspend tenant account?', 'Users will immediately lose access until the account is restored.'],
    plan: ['Change subscription plan', 'Select a new commercial tier. Proration will be applied automatically.'],
    trial: ['Extend trial period', 'Add 14 days to this tenant’s current evaluation period.'],
    impersonate: ['Impersonate company admin?', 'You will view the tenant on behalf of an administrator. Every action will be logged.'],
    archive: ['Archive tenant permanently?', 'This destructive action disables access and schedules tenant data for retention-policy deletion.'],
  } as const;

  return (
    <div className="space-y-5 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600"><ArrowLeft className="h-4 w-4" /> Back to tenants</button>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center text-sm font-extrabold shadow-lg">{tenant.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
            <div>
              <div className="flex items-center gap-2 flex-wrap"><h1 className="text-2xl font-extrabold">{tenant.name}</h1><Pill className={statusTone(tenant.status)}>{tenant.status}</Pill></div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-3"><span>{tenant.domain}</span><span>·</span><span>{tenant.country}</span><span>·</span><HealthScore score={tenant.health} /></div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setAction('impersonate')} className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Impersonate Admin</button>
            <button onClick={() => setAction('plan')} className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold">Change Plan</button>
            <button onClick={() => setAction('trial')} className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold">Extend Trial</button>
            <button onClick={() => setAction('suspend')} className="h-9 px-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 text-xs font-bold">Suspend</button>
            <button onClick={() => setAction('archive')} className="h-9 w-9 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 border border-red-200 dark:border-red-800 flex items-center justify-center"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <div className="flex min-w-max">
          {tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors ${tab === item ? 'border-indigo-600 text-indigo-600 dark:text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>{item}</button>)}
        </div>
      </div>

      {tab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <section className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h2 className="font-bold mb-4">Company information</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[['Legal name', tenant.name], ['Tenant ID', `tn_${tenant.id}_8f21`], ['Country / Region', `${tenant.country} · ${tenant.region}`], ['Subdomain', tenant.domain], ['Data residency', tenant.region === 'Europe' ? 'EU · Frankfurt' : 'Regional primary'], ['Created', tenant.signup]].map(([label, value]) => <div key={label} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50"><div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div><div className="text-sm font-semibold mt-1">{value}</div></div>)}
            </div>
          </section>
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h2 className="font-bold mb-4">Primary admin</h2>
            <div className="flex items-center gap-3 mb-4"><Avatar name={tenant.admin} size="lg" /><div><div className="text-sm font-bold">{tenant.admin}</div><div className="text-xs text-slate-500">Company Administrator</div></div></div>
            <div className="text-xs text-slate-500 space-y-2"><div>{tenant.email}</div><div>+1 (415) 555-0192</div><div>Last active 18 minutes ago</div></div>
          </section>
          <section className="lg:col-span-3 grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[['Active employees', tenant.employees.toLocaleString()], ['Admin users', '12'], ['Storage used', '68.4 GB'], ['API requests / month', '1.82M']].map(([label, value]) => <div key={label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4"><div className="text-xl font-extrabold">{value}</div><div className="text-xs text-slate-500 mt-1">{label}</div></div>)}
          </section>
        </div>
      )}

      {tab === 'Subscription & Billing' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <section className="bg-gradient-to-br from-indigo-950 to-violet-950 text-white rounded-2xl p-5">
            <div className="text-[10px] uppercase tracking-wider text-indigo-200">Current plan</div><div className="text-2xl font-extrabold mt-2">{tenant.plan}</div><div className="text-sm text-indigo-200 mt-1">${tenant.mrr.toLocaleString()} / month</div>
            <div className="border-t border-white/10 mt-5 pt-4 text-xs text-indigo-200 space-y-2"><div>Next invoice: Sep 01, 2026</div><div>{tenant.employees.toLocaleString()} of 2,500 seats</div><div>Annual contract · Net 30</div></div>
          </section>
          <section className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h2 className="font-bold mb-4">Payment method</h2><div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700"><CreditCard className="h-6 w-6 text-indigo-500" /><div className="flex-1"><div className="text-sm font-bold">Visa ending in 4242</div><div className="text-xs text-slate-500">Expires 08/29 · Billing contact {tenant.email}</div></div><Pill className="bg-emerald-50 text-emerald-700 border-emerald-200">Verified</Pill></div>
          </section>
          <section className="xl:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800"><h2 className="font-bold">Invoice history</h2></div>
            <table className="w-full text-left text-sm"><thead className="bg-slate-50 dark:bg-slate-950/50 text-[10px] uppercase text-slate-500"><tr><th className="px-5 py-3">Invoice</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{['August 2026', 'July 2026', 'June 2026'].map((month, index) => <tr key={month} className="border-t border-slate-100 dark:border-slate-800"><td className="px-5 py-3 font-mono text-xs">INV-2026-{1082 - index}</td><td className="px-4 py-3">{month}</td><td className="px-4 py-3 font-bold">${tenant.mrr.toLocaleString()}</td><td className="px-4 py-3"><Pill className="bg-emerald-50 text-emerald-700 border-emerald-200">Paid</Pill></td></tr>)}</tbody></table>
          </section>
        </div>
      )}

      {tab === 'Modules & Feature Access' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800"><h2 className="font-bold">Module entitlement</h2><p className="text-xs text-slate-500 mt-1">Control modules available to this tenant by product phase.</p></div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {modules.map((module) => <div key={module.name} className="flex items-center gap-4 px-5 py-4"><Pill className={module.phase === 'Phase 1' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : module.phase === 'Phase 2' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-orange-50 text-orange-700 border-orange-200'}>{module.phase}</Pill><div className="flex-1 text-sm font-semibold">{module.name}</div><Toggle checked={featureStates[module.name]} onChange={(checked) => setFeatureStates((previous) => ({ ...previous, [module.name]: checked }))} /></div>)}
          </div>
        </div>
      )}

      {tab === 'Users' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between"><div><h2 className="font-bold">Tenant administrators</h2><p className="text-xs text-slate-500 mt-1">Admin and HR users with elevated access.</p></div><button className="text-xs font-bold text-indigo-600">Export users</button></div>
          {[tenant.admin, 'Sophia Bennett', 'Liam Carter', 'Emma Thompson'].map((name, index) => <div key={name} className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800 last:border-0"><Avatar name={name} size="md" /><div className="flex-1"><div className="text-sm font-bold">{name}</div><div className="text-xs text-slate-500">{index === 0 ? tenant.email : `${name.toLowerCase().replace(' ', '.')}@${tenant.id}.com`}</div></div><Pill className={index === 0 ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-slate-100 text-slate-600 border-slate-200'}>{index === 0 ? 'Company Admin' : 'HR Admin'}</Pill><span className="text-xs text-emerald-600">Active</span></div>)}
        </div>
      )}

      {tab === 'Activity Log' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5">
          {['Payroll module enabled by Alex Morgan', 'Plan changed from Business to Enterprise', 'SSO configuration updated', 'Admin user Sophia Bennett invited', 'Data export completed'].map((event, index) => <div key={event} className="flex items-start gap-3"><div className="h-8 w-8 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center"><FileClock className="h-4 w-4" /></div><div><div className="text-sm font-semibold">{event}</div><div className="text-[11px] text-slate-500 mt-0.5">{index + 1} day{index ? 's' : ''} ago · IP 192.168.1.{42 + index}</div></div></div>)}
        </div>
      )}

      <Modal
        open={action !== null}
        onClose={() => setAction(null)}
        title={action ? actionCopy[action][0] : ''}
        description={action ? actionCopy[action][1] : ''}
        footer={
          <>
            <button onClick={() => setAction(null)} className="h-9 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold">Cancel</button>
            <button onClick={() => setAction(null)} className={`h-9 px-4 rounded-lg text-white text-sm font-bold ${action === 'archive' ? 'bg-red-600 hover:bg-red-500' : action === 'suspend' ? 'bg-orange-600 hover:bg-orange-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
              {action === 'impersonate' ? 'Continue & Log Session' : action === 'archive' ? 'Archive Tenant' : 'Confirm Action'}
            </button>
          </>
        }
      >
        {action === 'impersonate' && <div className="flex gap-3 p-4 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200"><AlertTriangle className="h-5 w-5 shrink-0" /><p className="text-sm">You are entering a privileged support session. A persistent banner will identify the impersonation state and every mutation will be written to the platform audit log.</p></div>}
        {action === 'archive' && <div><label className="text-xs font-bold text-secondary">Type {tenant.name} to confirm</label><input className="mt-2 w-full h-10 px-3 rounded-lg border border-red-300 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20" placeholder={tenant.name} /></div>}
        {action === 'plan' && <div className="grid grid-cols-3 gap-3">{['Starter', 'Business', 'Enterprise'].map((plan) => <button key={plan} className={`p-3 rounded-xl border text-sm font-bold ${plan === tenant.plan ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700'}`}>{plan}</button>)}</div>}
        {action === 'trial' && <div className="grid grid-cols-3 gap-3">{['7 days', '14 days', '30 days'].map((period) => <button key={period} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold hover:border-indigo-400">{period}</button>)}</div>}
        {action === 'suspend' && <div className="flex gap-3 p-4 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200"><LockKeyhole className="h-5 w-5 shrink-0" /><p className="text-sm">Existing sessions will be revoked. Billing data and tenant records remain retained.</p></div>}
      </Modal>
    </div>
  );
}

function CreateTenant({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [company, setCompany] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [country, setCountry] = useState('United States');
  const [plan, setPlan] = useState('Business');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [invite, setInvite] = useState(true);
  const available = subdomain.length >= 3 && /^[a-z0-9-]+$/.test(subdomain) && !['acme', 'globex', 'admin'].includes(subdomain);
  const steps = ['Company Info', 'Plan Selection', 'Admin Setup', 'Review & Create'];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600"><ArrowLeft className="h-4 w-4" /> Cancel onboarding</button>
      <div><h1 className="text-2xl font-extrabold">Create New Tenant</h1><p className="text-sm text-slate-500 mt-1">Manual onboarding by the platform operations team.</p></div>
      <div className="grid grid-cols-4 gap-2">
        {steps.map((label, index) => <div key={label}><div className={`h-1.5 rounded-full ${step >= index + 1 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} /><div className={`text-[10px] mt-2 ${step === index + 1 ? 'text-indigo-600 font-bold' : 'text-slate-500'}`}>{index + 1}. {label}</div></div>)}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm min-h-[390px]">
        {step === 1 && (
          <div className="space-y-5">
            <div><h2 className="text-lg font-extrabold">Company information</h2><p className="text-xs text-slate-500 mt-1">Country determines data residency and compliance defaults.</p></div>
            <div><label className="text-xs font-bold">Legal company name</label><input value={company} onChange={(event) => { setCompany(event.target.value); if (!subdomain) setSubdomain(event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} placeholder="Example Corporation" className="mt-1.5 w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-indigo-400" /></div>
            <div><label className="text-xs font-bold">Workspace subdomain</label><div className="relative mt-1.5"><input value={subdomain} onChange={(event) => setSubdomain(event.target.value.toLowerCase())} placeholder="example" className={`w-full h-11 pl-4 pr-40 rounded-xl border bg-transparent text-sm focus:outline-none ${subdomain ? available ? 'border-emerald-400' : 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`} /><span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-slate-500">.nexushr.com</span>{subdomain && (available ? <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" /> : <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />)}</div>{subdomain && <p className={`text-[11px] mt-1.5 ${available ? 'text-emerald-600' : 'text-red-600'}`}>{available ? 'Subdomain is available' : 'Use 3+ lowercase letters, numbers or hyphens; this name may be unavailable.'}</p>}</div>
            <div><label className="text-xs font-bold">Country / compliance region</label><select value={country} onChange={(event) => setCountry(event.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-indigo-400">{['United States', 'United Kingdom', 'Germany', 'Singapore', 'Australia', 'Bangladesh', 'United Arab Emirates'].map((item) => <option key={item}>{item}</option>)}</select></div>
          </div>
        )}
        {step === 2 && (
          <div><h2 className="text-lg font-extrabold">Select a pricing tier</h2><p className="text-xs text-slate-500 mt-1 mb-5">Plan limits can be customized after tenant creation.</p><div className="grid md:grid-cols-3 gap-4">{[
            { name: 'Starter', price: '$299', seats: 'Up to 250 employees', features: ['Core HR', 'Attendance', 'Leave'] },
            { name: 'Business', price: '$899', seats: 'Up to 1,000 employees', features: ['Everything in Starter', 'Payroll', 'Recruitment'] },
            { name: 'Enterprise', price: 'Custom', seats: 'Unlimited employees', features: ['All modules', 'SSO & API', 'Priority support'] },
          ].map((tier) => <button key={tier.name} onClick={() => setPlan(tier.name)} className={`p-5 rounded-2xl border text-left transition-all ${plan === tier.name ? 'border-indigo-500 ring-2 ring-indigo-500/15 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}><div className="flex justify-between"><div className="font-extrabold">{tier.name}</div>{plan === tier.name && <CheckCircle2 className="h-5 w-5 text-indigo-600" />}</div><div className="text-2xl font-extrabold mt-4">{tier.price}<span className="text-xs text-slate-500 font-normal">{tier.price !== 'Custom' && '/mo'}</span></div><div className="text-xs text-slate-500 mt-1 mb-4">{tier.seats}</div>{tier.features.map((feature) => <div key={feature} className="flex items-center gap-2 text-xs mt-2"><Check className="h-3.5 w-3.5 text-emerald-500" />{feature}</div>)}</button>)}</div></div>
        )}
        {step === 3 && (
          <div className="space-y-5"><div><h2 className="text-lg font-extrabold">Set up the first administrator</h2><p className="text-xs text-slate-500 mt-1">This person receives full company-admin permissions.</p></div><div><label className="text-xs font-bold">Full name</label><input value={adminName} onChange={(event) => setAdminName(event.target.value)} placeholder="Admin full name" className="mt-1.5 w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-indigo-400" /></div><div><label className="text-xs font-bold">Work email</label><input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="admin@company.com" className="mt-1.5 w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-indigo-400" /></div><div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50"><Toggle checked={invite} onChange={setInvite} /><div><div className="text-sm font-bold">Send secure invitation email</div><div className="text-xs text-slate-500 mt-1">{invite ? 'Admin creates their own password from a time-limited link.' : 'Generate a temporary initial password for manual delivery.'}</div></div></div>{!invite && <div><label className="text-xs font-bold">Temporary password</label><input value="Nexus!Temp2026" readOnly className="mt-1.5 w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-sm" /></div>}</div>
        )}
        {step === 4 && (
          <div><h2 className="text-lg font-extrabold">Review & create tenant</h2><p className="text-xs text-slate-500 mt-1 mb-5">Confirm configuration before provisioning platform resources.</p><div className="grid md:grid-cols-2 gap-4">{[
            ['Company', company || 'Example Corporation'], ['Workspace', `${subdomain || 'example'}.nexushr.com`], ['Country / Region', country], ['Selected plan', plan], ['Initial admin', adminName || 'Admin User'], ['Admin email', adminEmail || 'admin@example.com'], ['Access setup', invite ? 'Secure email invitation' : 'Temporary password'], ['Audit actor', 'Alex Morgan · Platform Operator'],
          ].map(([label, value]) => <div key={label} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50"><div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div><div className="text-sm font-bold mt-1">{value}</div></div>)}</div><div className="flex gap-3 p-4 mt-5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-200"><Server className="h-5 w-5 shrink-0" /><p className="text-xs leading-relaxed">Creating this tenant provisions an isolated workspace, regional data store, default roles, subscription record and invitation workflow.</p></div></div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <button onClick={() => step === 1 ? onBack() : setStep(step - 1)} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold">{step === 1 ? 'Cancel' : 'Back'}</button>
        <button disabled={(step === 1 && (!company || !available)) || (step === 3 && (!adminName || !adminEmail))} onClick={() => step === 4 ? onCreated() : setStep(step + 1)} className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-40">{step === 4 ? <><Check className="h-4 w-4" /> Create Tenant</> : <>Continue <ArrowRight className="h-4 w-4" /></>}</button>
      </div>
    </div>
  );
}

export function PlatformControlPanelPage() {
  const { navigate } = useNav();
  const [view, setView] = useState<PlatformView>('dashboard');
  const [selectedTenant, setSelectedTenant] = useState<Tenant>(tenants[0]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const searchResults = useMemo(() => globalSearch.length > 1 ? tenants.filter((tenant) => `${tenant.name} ${tenant.domain}`.toLowerCase().includes(globalSearch.toLowerCase())) : [], [globalSearch]);

  const go = (next: PlatformView) => {
    setView(next);
    setSidebarOpen(false);
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {sidebarOpen && <button className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed lg:relative inset-y-0 left-0 z-50 w-64 bg-slate-950 text-slate-200 border-r border-indigo-400/15 flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center gap-3 px-4 border-b border-white/10">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-950"><Shield className="h-5 w-5 text-white" /></div>
          <div><div className="font-extrabold text-white">Nexus HR</div><div className="text-[10px] text-indigo-300">Platform Control Plane</div></div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-slate-400"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-4 pt-4"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/25 text-indigo-200 text-[9px] font-bold tracking-[0.16em]"><LockKeyhole className="h-3 w-3" /> PLATFORM ADMIN</span></div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ key, label, icon: Icon }) => {
            const active = view === key || (key === 'tenants' && ['tenant-detail', 'create-tenant'].includes(view));
            return <button key={key} onClick={() => go(key)} className={`w-full h-10 px-3 rounded-xl flex items-center gap-3 text-xs font-semibold transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/40' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><Icon className="h-4 w-4" /><span>{label}</span>{key === 'support' && <span className="ml-auto px-1.5 py-0.5 rounded bg-orange-500 text-white text-[9px]">37</span>}</button>;
          })}
        </nav>
        <div className="p-3 border-t border-white/10"><button onClick={() => navigate('auth')} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 text-left"><Avatar name="Alex Morgan" size="sm" /><div className="flex-1"><div className="text-xs font-bold text-white">Alex Morgan</div><div className="text-[10px] text-slate-500">Platform Operator</div></div><LogOut className="h-4 w-4 text-slate-500" /></button></div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-slate-950 text-white border-b border-indigo-400/20 px-4 lg:px-6 flex items-center gap-3 shrink-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-white/10"><Menu className="h-5 w-5" /></button>
          <div className="relative flex-1 max-w-xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Jump to company..." className="w-full h-9 pl-9 pr-16 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400" />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">⌘ K</kbd>
            {searchResults.length > 0 && <div className="absolute top-11 inset-x-0 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">{searchResults.map((tenant) => <button key={tenant.id} onClick={() => { setSelectedTenant(tenant); setView('tenant-detail'); setGlobalSearch(''); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-left"><Building2 className="h-4 w-4 text-indigo-500" /><div className="flex-1"><div className="text-sm font-bold">{tenant.name}</div><div className="text-[10px] text-slate-500">{tenant.domain}</div></div><ArrowRight className="h-4 w-4 text-slate-400" /></button>)}</div>}
          </div>
          <PortalSwitcher variant="dark" />
          <button className="relative h-9 w-9 rounded-lg hover:bg-white/10 text-slate-300 flex items-center justify-center" title="Platform-wide alerts"><Bell className="h-4.5 w-4.5" /><span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-slate-950 animate-pulse" /></button>
          <Dropdown width="w-72" trigger={<div className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/10"><Avatar name="Alex Morgan" size="sm" /><ChevronDown className="h-4 w-4 text-slate-400" /></div>}>
            <DropdownHeader><div className="text-xs font-bold text-primary">Platform operator session</div><div className="text-[10px] text-muted mt-0.5">Privileged actions are audit logged</div></DropdownHeader>
            <DropdownDivider />
            <DropdownItem icon={<Building2 className="h-4 w-4" />} onClick={() => navigate('dashboard')}><span><span className="block">Switch to Acme Corporation</span><span className="block text-[10px] text-warning-600">Viewing as admin · actions logged</span></span></DropdownItem>
            <DropdownItem icon={<Shield className="h-4 w-4" />}>Security settings</DropdownItem>
            <DropdownDivider />
            <DropdownItem icon={<LogOut className="h-4 w-4" />} onClick={() => navigate('auth')}>Sign out</DropdownItem>
          </Dropdown>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 xl:p-7">
          <div className="max-w-[1600px] mx-auto">
            {view === 'dashboard' && <Dashboard onOpenTenants={() => setView('tenants')} />}
            {view === 'tenants' && <TenantsList onCreate={() => setView('create-tenant')} onSelect={(tenant) => { setSelectedTenant(tenant); setView('tenant-detail'); }} />}
            {view === 'tenant-detail' && <TenantDetail tenant={selectedTenant} onBack={() => setView('tenants')} />}
            {view === 'create-tenant' && <CreateTenant onBack={() => setView('tenants')} onCreated={() => setView('tenants')} />}
            {view === 'billing' && <PlatformBillingPage />}
            {view === 'features' && <FeatureFlagsPage />}
            {view === 'health' && <SystemHealthPage />}
            {view === 'users' && <PlatformUsersPage />}
            {view === 'support' && <SupportTicketsPage />}
            {view === 'settings' && <PlatformSettingsPage />}
            {view === 'audit' && <PlatformAuditPage />}
            {view === 'country-compliance' && <CountryCompliancePage />}
            {view === 'tenant-isolation' && <TenantIsolationPage />}
          </div>
        </main>
      </div>
    </div>
  );
}
