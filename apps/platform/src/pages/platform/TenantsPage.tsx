import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  Download,
  ExternalLink,
  FileClock,
  Filter,
  FlaskConical,
  Globe,
  Lock,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Server,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { PlatformTenantStatus } from '@hrm/shared-types';
import { Toggle } from '@/components/ui/Toggle';
import { usePlatformTenant } from '@/context/PlatformTenantContext';
import { PermissionGate } from '@/components/rbac';
import { CreateTenantWizard } from '@/components/tenants/CreateTenantWizard';
import { TenantDetailView } from '@/components/tenants/TenantDetailView';

export type TenantStatus = PlatformTenantStatus;

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  plan: 'Starter' | 'Business' | 'Enterprise';
  employees: number;
  status: TenantStatus;
  mrr: number;
  signup: string;
  createdAt?: string;
  lastActivity?: string | null;
  health: number;
  region: string;
  country: string;
  countryCode?: string;
  admin: string;
  email: string;
  suspensionMode?: string | null;
  suspensionReason?: string | null;
  cancelReason?: string | null;
  scheduledDeletionAt?: string | null;
  isSandbox?: boolean;
  sandboxTemplate?: string | null;
}

export const initialTenants: Tenant[] = [
  {
    id: 'sandbox-apex-demo',
    name: 'Apex Cloud Innovations (Demo)',
    domain: 'apex-cloud-demo.cmsnbd.com',
    plan: 'Enterprise',
    employees: 48,
    status: 'Active',
    isSandbox: true,
    sandboxTemplate: 'tech_saas',
    mrr: 0,
    signup: 'Nov 01, 2026',
    createdAt: '2026-11-01T10:00:00.000Z',
    lastActivity: '2026-11-20T10:15:00.000Z',
    health: 98,
    region: 'North America',
    country: 'United States',
    countryCode: 'USA',
    admin: 'Sophia Hayes',
    email: 'admin@apex-cloud-demo.cmsnbd.com',
  },
  {
    id: 'sandbox-metromart-demo',
    name: 'MetroMart Retail Group (Demo)',
    domain: 'metromart-demo.cmsnbd.com',
    plan: 'Enterprise',
    employees: 120,
    status: 'Active',
    isSandbox: true,
    sandboxTemplate: 'retail_hospitality',
    mrr: 0,
    signup: 'Nov 05, 2026',
    createdAt: '2026-11-05T14:00:00.000Z',
    lastActivity: '2026-11-19T14:15:00.000Z',
    health: 95,
    region: 'Europe',
    country: 'United Kingdom',
    countryCode: 'GBR',
    admin: 'Liam Carter',
    email: 'admin@metromart-demo.cmsnbd.com',
  },
  {
    id: 'acme',
    name: 'Acme Corporation',
    domain: 'acme.cmsnbd.com',
    plan: 'Enterprise',
    employees: 1248,
    status: 'Active',
    mrr: 4280,
    signup: 'Jan 12, 2024',
    createdAt: '2024-01-12T09:30:00.000Z',
    lastActivity: '2026-11-19T14:20:00.000Z',
    health: 94,
    region: 'North America',
    country: 'United States',
    countryCode: 'USA',
    admin: 'Olivia Martin',
    email: 'olivia@acme.com',
  },
  {
    id: 'techflow',
    name: 'TechFlow Labs',
    domain: 'techflow.cmsnbd.com',
    plan: 'Business',
    employees: 684,
    status: 'Active',
    mrr: 2180,
    signup: 'Mar 08, 2024',
    createdAt: '2024-03-08T11:15:00.000Z',
    lastActivity: '2026-11-19T10:45:00.000Z',
    health: 88,
    region: 'Asia Pacific',
    country: 'Singapore',
    countryCode: 'SGP',
    admin: 'Ethan Lim',
    email: 'ethan@techflow.io',
  },
  {
    id: 'globex',
    name: 'Globex Industries',
    domain: 'globex.cmsnbd.com',
    plan: 'Enterprise',
    employees: 2106,
    status: 'Suspended',
    suspensionMode: 'read_only',
    mrr: 5950,
    signup: 'Nov 21, 2023',
    createdAt: '2023-11-21T08:00:00.000Z',
    lastActivity: '2026-11-15T16:30:00.000Z',
    health: 42,
    region: 'Europe',
    country: 'Germany',
    countryCode: 'DEU',
    admin: 'Mia Weber',
    email: 'mia@globex.de',
  },
  {
    id: 'northstar',
    name: 'Northstar Retail',
    domain: 'northstar.cmsnbd.com',
    plan: 'Business',
    employees: 932,
    status: 'Active',
    mrr: 2780,
    signup: 'Apr 17, 2024',
    createdAt: '2024-04-17T14:00:00.000Z',
    lastActivity: '2026-11-18T18:00:00.000Z',
    health: 81,
    region: 'Europe',
    country: 'United Kingdom',
    countryCode: 'GBR',
    admin: 'Noah Clarke',
    email: 'noah@northstar.co.uk',
  },
  {
    id: 'vertex',
    name: 'Vertex Health',
    domain: 'vertex.cmsnbd.com',
    plan: 'Starter',
    employees: 184,
    status: 'Trial',
    mrr: 0,
    signup: 'Aug 19, 2026',
    createdAt: '2026-08-19T12:00:00.000Z',
    lastActivity: '2026-11-19T15:10:00.000Z',
    health: 68,
    region: 'Asia Pacific',
    country: 'Australia',
    countryCode: 'AUS',
    admin: 'Ava Wilson',
    email: 'ava@vertex.health',
  },
  {
    id: 'orbit',
    name: 'Orbit Logistics',
    domain: 'orbit.cmsnbd.com',
    plan: 'Business',
    employees: 516,
    status: 'Cancelled',
    mrr: 0,
    signup: 'Sep 04, 2023',
    createdAt: '2023-09-04T07:45:00.000Z',
    lastActivity: '2026-09-10T11:20:00.000Z',
    health: 24,
    region: 'Middle East',
    country: 'UAE',
    countryCode: 'ARE',
    admin: 'Omar Rahman',
    email: 'omar@orbit.ae',
  },
];

function statusTone(status: TenantStatus) {
  if (status === 'Active')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
  if (status === 'Trial')
    return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
  if (status === 'Suspended')
    return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800';
  if (status === 'Past_due')
    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
  if (status === 'Pending_deletion')
    return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800';
  if (status === 'Deleted')
    return 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400';
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
}

function formatStatusLabel(status: string) {
  switch (status) {
    case 'Past_due':
      return 'Past Due';
    case 'Pending_deletion':
      return 'Pending Deletion';
    default:
      return status;
  }
}

function planTone(plan: Tenant['plan']) {
  if (plan === 'Enterprise')
    return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800';
  if (plan === 'Business')
    return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
}

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function HealthScore({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color} shadow-sm`} />
      <span className="text-xs font-mono font-bold">{score}</span>
    </div>
  );
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay === 0) {
    if (diffHour === 0) {
      if (diffMin <= 1) return 'Just now';
      return `${diffMin}m ago`;
    }
    return `${diffHour}h ago`;
  }
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCreatedDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type SortField = 'name' | 'plan' | 'employees' | 'status' | 'created' | 'lastActivity';
type SortOrder = 'asc' | 'desc';

function SortIndicator({ active, order }: { active: boolean; order: SortOrder }) {
  if (!active) {
    return <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-50" />;
  }
  return order === 'asc' ? (
    <ArrowUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 font-bold" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 font-bold" />
  );
}

function exportTenantsToCsv(tenants: Tenant[]) {
  const headers = [
    'Tenant ID',
    'Company Name',
    'Subdomain / Domain',
    'Plan Tier',
    'Status',
    'Suspension Mode',
    'Employees',
    'Country',
    'Region',
    'MRR ($)',
    'Health Score',
    'Created At',
    'Last Activity',
    'Primary Administrator',
    'Admin Email',
  ];

  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = tenants.map((t) => [
    escapeCell(t.id),
    escapeCell(t.name),
    escapeCell(t.domain),
    escapeCell(t.plan),
    escapeCell(t.status),
    escapeCell(t.suspensionMode ?? 'N/A'),
    escapeCell(t.employees),
    escapeCell(t.country),
    escapeCell(t.region),
    escapeCell(t.mrr),
    escapeCell(t.health),
    escapeCell(t.createdAt ?? t.signup),
    escapeCell(t.lastActivity ?? 'N/A'),
    escapeCell(t.admin),
    escapeCell(t.email),
  ]);

  const csvContent = [headers.map(escapeCell).join(','), ...rows.map((r) => r.join(','))].join(
    '\r\n',
  );
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `tenants_export_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface TenantsPageProps {
  initialView?: 'list' | 'create';
  onNavigate?: (subview: string) => void;
}

export function TenantsPage({ initialView = 'list' }: TenantsPageProps) {
  const {
    tenants: contextTenants,
    selectedTenant: contextSelectedTenant,
    setSelectedTenant: setContextSelectedTenant,
    refreshTenants,
  } = usePlatformTenant();

  const [tenantsList, setTenantsList] = useState<Tenant[]>(initialTenants);
  const [viewState, setViewState] = useState<'list' | 'detail' | 'create'>(initialView);
  const [selectedTenant, setSelectedTenant] = useState<Tenant>(initialTenants[0]);

  useEffect(() => {
    setViewState(initialView);
  }, [initialView]);

  useEffect(() => {
    const targetTenantId = localStorage.getItem('hrm_platform_target_tenant');
    if (targetTenantId) {
      localStorage.removeItem('hrm_platform_target_tenant');
      const found = tenantsList.find(
        (t) =>
          t.id === targetTenantId ||
          t.domain.includes(targetTenantId) ||
          t.name.toLowerCase() === targetTenantId.toLowerCase(),
      );
      if (found) {
        setSelectedTenant(found);
        setViewState('detail');
      } else if (contextTenants.length > 0) {
        const ct = contextTenants.find((c) => c.id === targetTenantId || c.subdomain === targetTenantId);
        if (ct) {
          const mapped: Tenant = {
            id: ct.id,
            name: ct.name,
            domain: `${ct.subdomain}.cmsnbd.com`,
            plan: 'Enterprise',
            employees: 0,
            status: 'Active',
            mrr: 0,
            signup: new Date().toLocaleDateString(),
            health: 95,
            region: 'Global',
            country: 'Global',
            admin: 'Tenant Admin',
            email: `admin@${ct.subdomain}.com`,
          };
          setSelectedTenant(mapped);
          setViewState('detail');
        }
      }
    }
  }, [tenantsList, contextTenants]);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [datePreset, setDatePreset] = useState<'all' | '7d' | '30d' | '90d' | 'year' | 'custom'>(
    'all',
  );
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Sort state
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Feedback notifications
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // Sync with context tenants when API returns them
  useEffect(() => {
    if (contextTenants.length > 0) {
      const mapped: Tenant[] = contextTenants.map((ct) => ({
        id: ct.id,
        name: ct.name,
        domain: `${ct.subdomain}.cmsnbd.com`,
        plan: (ct.plan === 'Free' ? 'Starter' : ct.plan) as Tenant['plan'],
        employees: ct.employeeCount ?? 0,
        status: ct.status,
        mrr: ct.mrr ?? 0,
        signup: new Date(ct.createdAt).toLocaleDateString(),
        createdAt: ct.createdAt,
        lastActivity: ct.lastActivity ?? ct.createdAt,
        health: ct.health ?? 90,
        region: ct.region ?? 'Global',
        country: ct.country ?? 'Global',
        countryCode: ct.countryCode ?? 'GLB',
        admin: 'Tenant Owner',
        email: `admin@${ct.subdomain}.com`,
        suspensionMode: ct.suspensionMode,
        isSandbox: ct.isSandbox ?? false,
        sandboxTemplate: ct.sandboxTemplate,
      }));
      setTenantsList(mapped);
    }
  }, [contextTenants]);

  // Sync selectedTenant when contextSelectedTenant changes
  useEffect(() => {
    if (contextSelectedTenant) {
      const match = tenantsList.find(
        (t) =>
          t.id === contextSelectedTenant.id ||
          t.domain.includes(contextSelectedTenant.subdomain) ||
          t.name.toLowerCase() === contextSelectedTenant.name.toLowerCase(),
      );
      if (match) {
        setSelectedTenant(match);
      }
    }
  }, [contextSelectedTenant, tenantsList]);

  // Reset to page 1 whenever filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, planFilter, countryFilter, datePreset, customFrom, customTo]);

  // Available countries derived from loaded data + platform baselines
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    tenantsList.forEach((t) => {
      if (t.country && t.country.trim()) set.add(t.country.trim());
    });
    [
      'United States',
      'United Kingdom',
      'Germany',
      'Singapore',
      'Australia',
      'UAE',
      'Bangladesh',
    ].forEach((c) => set.add(c));
    return Array.from(set).sort();
  }, [tenantsList]);

  // Check if any filters are currently active
  const hasActiveFilters =
    search.trim() !== '' ||
    statusFilter !== 'All' ||
    planFilter !== 'All' ||
    countryFilter !== 'All' ||
    datePreset !== 'all' ||
    customFrom !== '' ||
    customTo !== '';

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setPlanFilter('All');
    setCountryFilter('All');
    setDatePreset('all');
    setCustomFrom('');
    setCustomTo('');
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'name' || field === 'status' ? 'asc' : 'desc');
    }
  };

  // Filter and sort computation
  const filteredAndSortedTenants = useMemo(() => {
    let result = [...tenantsList];

    // 1. Search Query (name, domain, country, admin, email)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.domain.toLowerCase().includes(q) ||
          t.country.toLowerCase().includes(q) ||
          t.admin.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q),
      );
    }

    // 2. Status Filter
    if (statusFilter === 'Sandbox') {
      result = result.filter((t) => t.isSandbox);
    } else if (statusFilter !== 'All') {
      result = result.filter((t) => t.status === statusFilter);
    }

    // 3. Plan Filter
    if (planFilter !== 'All') {
      result = result.filter((t) => t.plan === planFilter);
    }

    // 4. Country Filter
    if (countryFilter !== 'All') {
      const cf = countryFilter.toLowerCase();
      result = result.filter(
        (t) =>
          t.country.toLowerCase() === cf ||
          (t.countryCode && t.countryCode.toLowerCase() === cf),
      );
    }

    // 5. Created Date Filter
    if (datePreset === '7d') {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      result = result.filter((t) => new Date(t.createdAt ?? t.signup).getTime() >= cutoff);
    } else if (datePreset === '30d') {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      result = result.filter((t) => new Date(t.createdAt ?? t.signup).getTime() >= cutoff);
    } else if (datePreset === '90d') {
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      result = result.filter((t) => new Date(t.createdAt ?? t.signup).getTime() >= cutoff);
    } else if (datePreset === 'year') {
      const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
      result = result.filter((t) => new Date(t.createdAt ?? t.signup).getTime() >= yearStart);
    } else if (datePreset === 'custom') {
      if (customFrom) {
        const fromTime = new Date(customFrom).getTime();
        if (!isNaN(fromTime)) {
          result = result.filter((t) => new Date(t.createdAt ?? t.signup).getTime() >= fromTime);
        }
      }
      if (customTo) {
        const toDate = new Date(customTo);
        toDate.setHours(23, 59, 59, 999);
        if (!isNaN(toDate.getTime())) {
          result = result.filter(
            (t) => new Date(t.createdAt ?? t.signup).getTime() <= toDate.getTime(),
          );
        }
      }
    }

    // 6. Sort
    const direction = sortOrder === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'plan': {
          const planOrder: Record<string, number> = {
            Starter: 1,
            Business: 2,
            Enterprise: 3,
          };
          comparison = (planOrder[a.plan] ?? 0) - (planOrder[b.plan] ?? 0);
          break;
        }
        case 'employees':
          comparison = a.employees - b.employees;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'lastActivity': {
          const timeA = new Date(a.lastActivity ?? a.createdAt ?? a.signup).getTime();
          const timeB = new Date(b.lastActivity ?? b.createdAt ?? b.signup).getTime();
          comparison = timeA - timeB;
          break;
        }
        case 'created':
        default: {
          const timeA = new Date(a.createdAt ?? a.signup).getTime();
          const timeB = new Date(b.createdAt ?? b.signup).getTime();
          comparison = timeA - timeB;
          break;
        }
      }
      return comparison * direction;
    });

    return result;
  }, [
    tenantsList,
    search,
    statusFilter,
    planFilter,
    countryFilter,
    datePreset,
    customFrom,
    customTo,
    sortField,
    sortOrder,
  ]);

  // Pagination slicing
  const totalFiltered = filteredAndSortedTenants.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTenants = filteredAndSortedTenants.slice(startIndex, startIndex + pageSize);

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  if (viewState === 'create') {
    return (
      <CreateTenantWizard
        onCancel={() => {
          setViewState('list');
          if (window.location.hash.includes('tenant-provisioning')) {
            window.location.hash = '#/tenants';
          }
        }}
        onSuccess={(result) => {
          refreshTenants();
          const newEntry: Tenant = {
            id: result.tenantId,
            name: result.name,
            domain: `${result.subdomain}.cmsnbd.com`,
            plan: 'Business',
            employees: 1,
            status: result.status,
            mrr: 899,
            signup: 'Just now',
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            health: 100,
            region: 'Global',
            country: 'Configured',
            admin: result.ownerEmail,
            email: result.ownerEmail,
          };
          setTenantsList((prev) => [newEntry, ...prev]);
        }}
      />
    );
  }

  if (viewState === 'detail') {
    return (
      <TenantDetailView
        tenant={selectedTenant}
        onBack={() => setViewState('list')}
        onTenantUpdated={(updated) => {
          setSelectedTenant(updated);
          setTenantsList((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        }}
      />
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header section with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Tenants Directory
          </h1>
          <p className="text-sm text-secondary mt-1">
            Search, filter, and inspect tenant workspaces across regions and subscription tiers.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* CSV Export Button */}
          <button
            type="button"
            onClick={() => {
              exportTenantsToCsv(filteredAndSortedTenants);
              setExportFeedback(
                `Exported ${filteredAndSortedTenants.length} tenant${filteredAndSortedTenants.length === 1 ? '' : 's'
                } to CSV`,
              );
              setTimeout(() => setExportFeedback(null), 3500);
            }}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 shadow-sm transition-colors"
            title="Export filtered directory to CSV"
          >
            <Download className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>Export CSV</span>
          </button>

          <PermissionGate module="tenant" action="create">
            <button
              onClick={() => setViewState('create')}
              className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" /> Provision Tenant
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* CSV Export feedback pill */}
      {exportFeedback && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in shadow-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>{exportFeedback}</span>
        </div>
      )}

      {/* Active Tenant Context Banner (Top Header Selector Scope) */}
      {contextSelectedTenant && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase font-extrabold tracking-wider text-amber-400">
                  Active Tenant Context:
                </span>
                <span className="text-sm font-bold text-white">{contextSelectedTenant.name}</span>
                <Pill className={planTone(contextSelectedTenant.plan as Tenant['plan'])}>
                  {contextSelectedTenant.plan}
                </Pill>
                <Pill className={statusTone(contextSelectedTenant.status as TenantStatus)}>
                  {formatStatusLabel(contextSelectedTenant.status)}
                </Pill>
              </div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-mono">{contextSelectedTenant.subdomain}.cmsnbd.com</span>
                <span>·</span>
                <span>Platform views scoped to this organization</span>
                <span>·</span>
                <span className="text-amber-300 font-medium">Business data strictly isolated</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const target = tenantsList.find(
                  (t) =>
                    t.id === contextSelectedTenant.id ||
                    t.domain.includes(contextSelectedTenant.subdomain) ||
                    t.name.toLowerCase() === contextSelectedTenant.name.toLowerCase(),
                );
                if (target) setSelectedTenant(target);
                setViewState('detail');
              }}
              className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors"
            >
              View Tenant Details
            </button>
            <button
              type="button"
              onClick={() => setContextSelectedTenant(null)}
              className="h-8 px-3 rounded-lg border border-slate-700 hover:border-slate-600 text-xs text-slate-300 hover:text-white transition-colors"
            >
              Reset to All Tenants
            </button>
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-card space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          {/* Search Box */}
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company, domain, admin..."
              className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-amber-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Trial">Trial</option>
            <option value="Sandbox">Sandbox Demo (Non-billable)</option>
            <option value="Past_due">Past Due</option>
            <option value="Suspended">Suspended</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Pending_deletion">Pending Deletion</option>
            <option value="Deleted">Deleted</option>
          </select>

          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="All">All Plans</option>
            <option value="Starter">Starter</option>
            <option value="Business">Business</option>
            <option value="Enterprise">Enterprise</option>
          </select>

          {/* Country Filter */}
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="All">All Countries</option>
            {availableCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Created Date Filter Presets */}
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as any)}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="all">Created: All Time</option>
            <option value="7d">Created: Last 7 Days</option>
            <option value="30d">Created: Last 30 Days</option>
            <option value="90d">Created: Last 90 Days</option>
            <option value="year">Created: This Year</option>
            <option value="custom">Created: Custom Range...</option>
          </select>
        </div>

        {/* Custom Date Range Selector (appears when datePreset === 'custom') */}
        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber-500" />
              <span>Created Date Range:</span>
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-amber-500"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        )}

        {/* Active Filters Pill Bar with Reset Button */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 font-medium">Active filters:</span>
              {search && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px]">
                  <span>Query: "{search}"</span>
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="hover:text-amber-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {statusFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px]">
                  <span>Status: {formatStatusLabel(statusFilter)}</span>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('All')}
                    className="hover:text-amber-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {planFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px]">
                  <span>Plan: {planFilter}</span>
                  <button
                    type="button"
                    onClick={() => setPlanFilter('All')}
                    className="hover:text-amber-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {countryFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px]">
                  <span>Country: {countryFilter}</span>
                  <button
                    type="button"
                    onClick={() => setCountryFilter('All')}
                    className="hover:text-amber-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {datePreset !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px]">
                  <span>
                    Created:{' '}
                    {datePreset === 'custom'
                      ? `${customFrom || 'Start'} → ${customTo || 'Now'}`
                      : datePreset}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset('all');
                      setCustomFrom('');
                      setCustomTo('');
                    }}
                    className="hover:text-amber-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-amber-600 hover:text-amber-500 dark:text-amber-400 flex items-center gap-1 shrink-0 ml-auto"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Tenants Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
        {/* Table summary bar */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-secondary">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-slate-900 dark:text-white">{totalFiltered}</strong>{' '}
              matching {totalFiltered === 1 ? 'organization' : 'organizations'}
            </span>
            {hasActiveFilters && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                (filtered from {tenantsList.length} total)
              </span>
            )}
          </div>
          <span className="font-mono text-[11px]">aud: platform-admin</span>
        </div>

        {/* Empty state when no matching tenants */}
        {filteredAndSortedTenants.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No matching organizations found
            </h3>
            <p className="text-xs text-secondary max-w-sm mx-auto">
              No tenants match your search query and filter criteria. Try adjusting the filter
              parameters or resetting to show all tenants.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-2 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset all filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1100px]">
              <thead className="bg-slate-50 dark:bg-slate-950/50 text-[10px] uppercase tracking-wider text-secondary">
                <tr>
                  {/* Company Name (sortable) */}
                  <th
                    className="px-5 py-3.5 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort('name')}
                    title="Click to sort by company name"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Company</span>
                      <SortIndicator active={sortField === 'name'} order={sortOrder} />
                    </div>
                  </th>

                  {/* Plan (sortable) */}
                  <th
                    className="px-4 py-3.5 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort('plan')}
                    title="Click to sort by plan tier"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Plan</span>
                      <SortIndicator active={sortField === 'plan'} order={sortOrder} />
                    </div>
                  </th>

                  {/* Employees (sortable) */}
                  <th
                    className="px-4 py-3.5 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort('employees')}
                    title="Click to sort by employee count"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Employees</span>
                      <SortIndicator active={sortField === 'employees'} order={sortOrder} />
                    </div>
                  </th>

                  {/* Status (sortable) */}
                  <th
                    className="px-4 py-3.5 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort('status')}
                    title="Click to sort by status"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Status</span>
                      <SortIndicator active={sortField === 'status'} order={sortOrder} />
                    </div>
                  </th>

                  {/* Country */}
                  <th className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3 text-slate-400" />
                      <span>Country</span>
                    </div>
                  </th>

                  {/* MRR */}
                  <th className="px-4 py-3.5 font-mono">MRR</th>

                  {/* Created Date (sortable) */}
                  <th
                    className="px-4 py-3.5 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort('created')}
                    title="Click to sort by creation date"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Created</span>
                      <SortIndicator active={sortField === 'created'} order={sortOrder} />
                    </div>
                  </th>

                  {/* Last Activity (sortable) */}
                  <th
                    className="px-4 py-3.5 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    onClick={() => handleSort('lastActivity')}
                    title="Click to sort by last activity date"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Last Activity</span>
                      <SortIndicator active={sortField === 'lastActivity'} order={sortOrder} />
                    </div>
                  </th>

                  {/* Health */}
                  <th className="px-4 py-3.5">Health</th>

                  {/* Actions */}
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {paginatedTenants.map((tenant) => {
                  const isContextActive =
                    contextSelectedTenant &&
                    (contextSelectedTenant.id === tenant.id ||
                      tenant.domain.includes(contextSelectedTenant.subdomain));

                  return (
                    <tr
                      key={tenant.id}
                      onClick={() => {
                        setSelectedTenant(tenant);
                        const match = contextTenants.find(
                          (ct) =>
                            ct.id === tenant.id ||
                            ct.subdomain === tenant.id ||
                            ct.name.toLowerCase() === tenant.name.toLowerCase(),
                        );
                        if (match) {
                          setContextSelectedTenant(match);
                        }
                        setViewState('detail');
                      }}
                      className={`hover:bg-amber-50/30 dark:hover:bg-amber-950/10 cursor-pointer transition-colors ${isContextActive ? 'bg-amber-500/10 border-l-4 border-amber-500' : ''
                        }`}
                    >
                      {/* Company Name & Subdomain */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center text-[10px] font-extrabold shrink-0 shadow-sm">
                            {tenant.name
                              .split(' ')
                              .map((p) => p[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                              <span>{tenant.name}</span>
                              {tenant.isSandbox && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800 font-bold uppercase tracking-wider flex items-center gap-1">
                                  <FlaskConical className="h-2.5 w-2.5" />
                                  SANDBOX
                                </span>
                              )}
                              {tenant.suspensionMode && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 font-mono">
                                  {tenant.suspensionMode}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-secondary font-mono">
                              {tenant.domain}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-3.5">
                        <Pill className={planTone(tenant.plan)}>{tenant.plan}</Pill>
                      </td>

                      {/* Employees */}
                      <td className="px-4 py-3.5 font-mono">
                        {tenant.employees.toLocaleString()}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <Pill className={statusTone(tenant.status)}>
                          {formatStatusLabel(tenant.status)}
                        </Pill>
                      </td>

                      {/* Country */}
                      <td className="px-4 py-3.5">
                        <div className="text-xs text-slate-800 dark:text-slate-200">
                          {tenant.country}
                        </div>
                        {tenant.countryCode && (
                          <div className="text-[10px] font-mono text-secondary">
                            {tenant.countryCode}
                          </div>
                        )}
                      </td>

                      {/* MRR */}
                      <td className="px-4 py-3.5 font-mono font-bold">
                        {tenant.isSandbox ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">$0</span>
                            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 font-sans px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                              Demo
                            </span>
                          </div>
                        ) : (
                          `$${tenant.mrr.toLocaleString()}`
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="px-4 py-3.5 text-xs text-secondary whitespace-nowrap">
                        {formatCreatedDate(tenant.createdAt ?? tenant.signup)}
                      </td>

                      {/* Last Activity */}
                      <td className="px-4 py-3.5 text-xs text-secondary whitespace-nowrap">
                        {formatRelativeTime(tenant.lastActivity ?? tenant.createdAt)}
                      </td>

                      {/* Health */}
                      <td className="px-4 py-3.5">
                        <HealthScore score={tenant.health} />
                      </td>

                      {/* Action Menu button */}
                      <td className="px-4 py-3.5 text-right text-slate-400">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTenant(tenant);
                            setViewState('detail');
                          }}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                          title="View details"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {filteredAndSortedTenants.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-secondary">
            {/* Left side: showing count & page size selector */}
            <div className="flex items-center gap-3">
              <span>
                Showing{' '}
                <strong className="text-slate-900 dark:text-white">{startIndex + 1}</strong> to{' '}
                <strong className="text-slate-900 dark:text-white">
                  {Math.min(startIndex + pageSize, totalFiltered)}
                </strong>{' '}
                of <strong className="text-slate-900 dark:text-white">{totalFiltered}</strong>{' '}
                tenants
              </span>
              <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-slate-700">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Right side: Page navigation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="First Page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1 px-1">
                {getPageNumbers().map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCurrentPage(num)}
                    className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-bold transition-colors ${currentPage === num
                      ? 'bg-amber-600 text-white'
                      : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next Page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Last Page"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
