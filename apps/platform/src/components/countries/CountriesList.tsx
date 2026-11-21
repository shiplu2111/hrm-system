import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Filter,
  Globe2,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type { CountryStatus, CountrySummary } from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';

export const ISO_FLAGS: Record<string, string> = {
  USA: '🇺🇸',
  GBR: '🇬🇧',
  DEU: '🇩🇪',
  AUS: '🇦🇺',
  CAN: '🇨🇦',
  SGP: '🇸🇬',
  BGD: '🇧🇩',
  ARE: '🇦🇪',
  IND: '🇮🇳',
  NZL: '🇳🇿',
  FRA: '🇫🇷',
  IRL: '🇮🇪',
  NLD: '🇳🇱',
  JPN: '🇯🇵',
  MYS: '🇲🇾',
  PHL: '🇵🇭',
  ZAF: '🇿🇦',
};

export const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Amsterdam',
  'Asia/Dubai',
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Pacific/Auckland',
  'UTC',
];

interface CountriesListProps {
  countries: CountrySummary[];
  loading: boolean;
  onSelectCountry: (countryId: string) => void;
  onRefresh: () => Promise<void>;
  onCreateCountry: (input: {
    name: string;
    isoCode: string;
    currency: string;
    timezone: string;
    dateFormat: string;
    numberFormat?: string;
    defaultFinancialYearStart?: string;
    defaultPayFrequency?: string;
    status?: CountryStatus;
  }) => Promise<void>;
}

export function CountriesList({
  countries,
  loading,
  onSelectCountry,
  onRefresh,
  onCreateCountry,
}: CountriesListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CountryStatus>('all');
  const [sortBy, setSortBy] = useState<'name' | 'tenants' | 'completeness' | 'updated'>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Add country modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newCountry, setNewCountry] = useState({
    name: '',
    isoCode: '',
    currency: '',
    timezone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: '1,234.56',
    defaultFinancialYearStart: '01-01',
    defaultPayFrequency: 'monthly',
    status: 'draft' as CountryStatus,
  });

  // Calculate metrics
  const totalCountries = countries.length;
  const activeCount = countries.filter((c) => c.status === 'active').length;
  const draftCount = countries.filter((c) => c.status === 'draft').length;
  const totalTenants = countries.reduce((acc, c) => acc + (c.tenantCount || 0), 0);

  // Filter & sort
  const filteredCountries = useMemo(() => {
    return countries
      .filter((country) => {
        if (statusFilter !== 'all' && country.status !== statusFilter) {
          return false;
        }
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          country.name.toLowerCase().includes(q) ||
          country.isoCode.toLowerCase().includes(q) ||
          country.currency.toLowerCase().includes(q) ||
          country.timezone.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'tenants') {
          return (b.tenantCount || 0) - (a.tenantCount || 0);
        }
        if (sortBy === 'completeness') {
          const compA = a.configStatus?.completedRequiredCount ?? 0;
          const compB = b.configStatus?.completedRequiredCount ?? 0;
          return compB - compA;
        }
        if (sortBy === 'updated') {
          const timeA = a.lastRuleUpdate ? new Date(a.lastRuleUpdate).getTime() : 0;
          const timeB = b.lastRuleUpdate ? new Date(b.lastRuleUpdate).getTime() : 0;
          return timeB - timeA;
        }
        return a.name.localeCompare(b.name);
      });
  }, [countries, search, statusFilter, sortBy]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!newCountry.name.trim() || !newCountry.isoCode.trim() || !newCountry.currency.trim()) {
      setAddError('Please fill in country name, ISO code, and currency.');
      return;
    }
    if (newCountry.isoCode.trim().length !== 3) {
      setAddError('ISO code must be a 3-letter code (e.g. USA, GBR, AUS).');
      return;
    }
    if (newCountry.currency.trim().length !== 3) {
      setAddError('Currency must be a 3-letter ISO code (e.g. USD, EUR, GBP).');
      return;
    }

    try {
      setSubmitting(true);
      await onCreateCountry({
        ...newCountry,
        name: newCountry.name.trim(),
        isoCode: newCountry.isoCode.trim().toUpperCase(),
        currency: newCountry.currency.trim().toUpperCase(),
      });
      setIsAddOpen(false);
      setNewCountry({
        name: '',
        isoCode: '',
        currency: '',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        numberFormat: '1,234.56',
        defaultFinancialYearStart: '01-01',
        defaultPayFrequency: 'monthly',
        status: 'draft',
      });
    } catch (err: any) {
      setAddError(err?.message || 'Failed to create country.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: CountryStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Draft
          </span>
        );
      case 'retired':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Retired
          </span>
        );
    }
  };

  const getCompletenessBadge = (summary: CountrySummary) => {
    const configStatus = summary.configStatus;
    if (!configStatus) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          General Only
        </span>
      );
    }

    const { isReadyForActivation, completedRequiredCount, totalRequiredCount, missingCategories } =
      configStatus;
    const percent = Math.round((completedRequiredCount / totalRequiredCount) * 100);

    if (isReadyForActivation) {
      return (
        <div className="flex flex-col items-end">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3 w-3" />
            100% Ready ({completedRequiredCount}/{totalRequiredCount})
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-3 w-3" />
          {percent}% ({completedRequiredCount}/{totalRequiredCount} req)
        </span>
        {missingCategories && missingCategories.length > 0 && (
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            Missing: {missingCategories.slice(0, 2).join(', ')}
            {missingCategories.length > 2 ? ` +${missingCategories.length - 2}` : ''}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Jurisdictions
            </span>
            <div className="h-8 w-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Globe2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {totalCountries}
            </span>
            <span className="text-xs text-slate-500">configured</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Active & Live
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </span>
            <span className="text-xs text-slate-500">serving tenants</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Draft & Staging
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {draftCount}
            </span>
            <span className="text-xs text-slate-500">in configuration</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Tenants Using
            </span>
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {totalTenants}
            </span>
            <span className="text-xs text-slate-500">workspaces linked</span>
          </div>
        </div>
      </div>

      {/* Action Header & Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by country name, ISO code, currency, or timezone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:bg-slate-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-50/50 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Table
              </button>
            </div>

            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={loading}
              title="Refresh countries"
              className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="h-10 px-4 flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Add Country
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Status:
            </span>
            {(['all', 'active', 'draft', 'retired'] as const).map((st) => {
              const isSelected = statusFilter === st;
              const count =
                st === 'all'
                  ? countries.length
                  : countries.filter((c) => c.status === st).length;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap capitalize ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {st} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="name">Country Name (A-Z)</option>
              <option value="tenants">Most Tenants</option>
              <option value="completeness">Highest Completeness</option>
              <option value="updated">Recently Updated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Country Cards Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCountries.map((country) => {
            const flag = ISO_FLAGS[country.isoCode] || '🌐';
            const progress = country.configStatus
              ? Math.round(
                  (country.configStatus.completedRequiredCount /
                    country.configStatus.totalRequiredCount) *
                    100,
                )
              : 25;

            return (
              <div
                key={country.id}
                onClick={() => onSelectCountry(country.id)}
                className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-500/50 transition cursor-pointer dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Card Top: Flag, Name, Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl" role="img" aria-label={country.name}>
                      {flag}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                        {country.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {country.isoCode}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {country.currency}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>{getStatusBadge(country.status)}</div>
                </div>

                {/* Progress / Completeness bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Configuration Completeness</span>
                    {getCompletenessBadge(country)}
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        progress === 100
                          ? 'bg-emerald-500'
                          : progress >= 60
                          ? 'bg-indigo-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Meta Attributes */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Tenants Active
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      {country.tenantCount || 0} tenant{(country.tenantCount || 0) === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Pay Cycle & FY
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 capitalize truncate">
                      {country.defaultPayFrequency || 'monthly'} • FY {country.defaultFinancialYearStart || '01-01'}
                    </span>
                  </div>
                </div>

                {/* Card Footer: Timezone, Date & Action Button */}
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                  <span className="truncate max-w-[170px]" title={country.timezone}>
                    🕒 {country.timezone}
                  </span>

                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:translate-x-0.5 transition">
                    Configure Detail →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3">Jurisdiction</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tenants</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3">Timezone</th>
                  <th className="px-4 py-3">Default Cycle</th>
                  <th className="px-4 py-3 text-right">Completeness</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCountries.map((country) => {
                  const flag = ISO_FLAGS[country.isoCode] || '🌐';
                  return (
                    <tr
                      key={country.id}
                      onClick={() => onSelectCountry(country.id)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{flag}</span>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {country.name}
                            </span>
                            <span className="font-mono text-xs text-slate-400">
                              {country.isoCode}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">{getStatusBadge(country.status)}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                        {country.tenantCount || 0}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {country.currency}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{country.timezone}</td>
                      <td className="px-4 py-3.5 text-xs capitalize text-slate-600 dark:text-slate-300">
                        {country.defaultPayFrequency || 'monthly'}
                      </td>
                      <td className="px-4 py-3.5 text-right">{getCompletenessBadge(country)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCountry(country.id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-semibold transition"
                        >
                          Configure
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredCountries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-white dark:bg-slate-900">
          <Globe2 className="mx-auto h-10 w-10 text-slate-400 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No countries found
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {search
              ? `No countries matched your search "${search}". Try clearing your filters.`
              : 'No countries have been configured in this platform environment yet.'}
          </p>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Add Country Modal */}
      <Modal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Supported Country Jurisdiction"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adding a country enables tenants to operate under its statutory tax, overtime, leave,
            and payroll regulations.
          </p>

          {addError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Country Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Canada"
                value={newCountry.name}
                onChange={(e) => setNewCountry({ ...newCountry, name: e.target.value })}
                required
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                ISO 3166-1 Code (3-letter) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={3}
                placeholder="e.g. CAN"
                value={newCountry.isoCode}
                onChange={(e) =>
                  setNewCountry({ ...newCountry, isoCode: e.target.value.toUpperCase() })
                }
                required
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 text-sm uppercase font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                ISO Currency Code (3-letter) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={3}
                placeholder="e.g. CAD"
                value={newCountry.currency}
                onChange={(e) =>
                  setNewCountry({ ...newCountry, currency: e.target.value.toUpperCase() })
                }
                required
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 text-sm uppercase font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Default Timezone
              </label>
              <select
                value={newCountry.timezone}
                onChange={(e) => setNewCountry({ ...newCountry, timezone: e.target.value })}
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Date Format
              </label>
              <select
                value={newCountry.dateFormat}
                onChange={(e) => setNewCountry({ ...newCountry, dateFormat: e.target.value })}
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (UK / AU)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                <option value="DD.MM.YYYY">DD.MM.YYYY (German / EU)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Number Format
              </label>
              <select
                value={newCountry.numberFormat}
                onChange={(e) => setNewCountry({ ...newCountry, numberFormat: e.target.value })}
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none"
              >
                <option value="1,234.56">1,234.56 (Standard comma/period)</option>
                <option value="1.234,56">1.234,56 (European period/comma)</option>
                <option value="1 234,56">1 234,56 (French space/comma)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Financial Year Start (MM-DD)
              </label>
              <input
                type="text"
                placeholder="01-01"
                value={newCountry.defaultFinancialYearStart}
                onChange={(e) =>
                  setNewCountry({ ...newCountry, defaultFinancialYearStart: e.target.value })
                }
                pattern="^\d{2}-\d{2}$"
                title="Format MM-DD (e.g. 01-01 or 07-01)"
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 text-sm font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Default Pay Frequency
              </label>
              <select
                value={newCountry.defaultPayFrequency}
                onChange={(e) =>
                  setNewCountry({ ...newCountry, defaultPayFrequency: e.target.value })
                }
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none"
              >
                <option value="monthly">Monthly</option>
                <option value="semi-monthly">Semi-Monthly</option>
                <option value="bi-weekly">Bi-Weekly</option>
                <option value="weekly">Weekly</option>
                <option value="four-weekly">Four-Weekly</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Initial Lifecycle Status
            </label>
            <select
              value={newCountry.status}
              onChange={(e) =>
                setNewCountry({ ...newCountry, status: e.target.value as CountryStatus })
              }
              className="mt-1 h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none"
            >
              <option value="draft">Draft (in-progress configuration)</option>
              <option value="active">Active (available for tenant selection)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-60 transition"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create Country
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
