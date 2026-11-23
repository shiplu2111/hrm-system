import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  FileJson,
  FileText,
  Filter,
  Globe,
  HelpCircle,
  History,
  Info,
  Languages,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Upload,
} from 'lucide-react';
import type { PlatformLanguagePackSummary } from '@hrm/shared-types';
import {
  exportPlatformLanguagePack,
  listPlatformLanguagePacks,
  setPlatformLanguageAvailability,
} from '@/lib/platform-language-packs-api';
import { MissingKeysReportModal } from '@/components/language-packs/MissingKeysReportModal';
import { ImportLanguagePackModal } from '@/components/language-packs/ImportLanguagePackModal';
import { AddLanguagePackModal } from '@/components/language-packs/AddLanguagePackModal';

export function PlatformLanguagePacksPage() {
  const [packs, setPacks] = useState<PlatformLanguagePackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'draft'>('all');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'ltr' | 'rtl'>('all');

  // Modals state
  const [selectedPackForReport, setSelectedPackForReport] = useState<PlatformLanguagePackSummary | null>(null);
  const [selectedPackForImport, setSelectedPackForImport] = useState<PlatformLanguagePackSummary | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Export in progress
  const [exportingCode, setExportingCode] = useState<string | null>(null);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);

  useEffect(() => {
    loadLanguagePacks();
  }, []);

  const loadLanguagePacks = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await listPlatformLanguagePacks();
      setPacks(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load platform language packs.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAvailability = async (pack: PlatformLanguagePackSummary) => {
    if (pack.isDefault && pack.isAvailableToTenants) {
      alert('The canonical baseline language pack (English) cannot be disabled from tenants.');
      return;
    }

    const nextState = !pack.isAvailableToTenants;
    const confirmMsg = nextState
      ? `Are you sure you want to mark ${pack.name} (${pack.code.toUpperCase()}) as AVAILABLE to all tenants?`
      : `Are you sure you want to disable ${pack.name} (${pack.code.toUpperCase()}) from tenant selection?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setTogglingCode(pack.code);
      setErrorMsg(null);
      const updated = await setPlatformLanguageAvailability(pack.code, nextState);
      setPacks((prev) => prev.map((p) => (p.code === updated.code ? updated : p)));
      setActionSuccessMsg(
        `Language pack ${pack.name} is now ${nextState ? 'available to tenants' : 'restricted to platform draft'}.`,
      );
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to toggle language availability.');
    } finally {
      setTogglingCode(null);
    }
  };

  const handleExportJson = async (code: string) => {
    try {
      setExportingCode(code);
      const { filename, jsonContent } = await exportPlatformLanguagePack(code, 'nested');
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to export language pack.');
    } finally {
      setExportingCode(null);
    }
  };

  // Filtered language packs
  const filteredPacks = packs.filter((pack) => {
    if (availabilityFilter === 'available' && !pack.isAvailableToTenants) return false;
    if (availabilityFilter === 'draft' && pack.isAvailableToTenants) return false;
    if (directionFilter !== 'all' && pack.direction !== directionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        pack.code.toLowerCase().includes(q) ||
        pack.name.toLowerCase().includes(q) ||
        pack.nativeName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Aggregate stats
  const totalLanguages = packs.length;
  const availableToTenantsCount = packs.filter((p) => p.isAvailableToTenants).length;
  const averageCompleteness =
    packs.length > 0
      ? Number(
          (
            packs.reduce((acc, p) => acc + p.completenessPercent, 0) / packs.length
          ).toFixed(1),
        )
      : 0;
  const defaultPack = packs.find((p) => p.isDefault);
  const baselineKeys = defaultPack?.totalKeys || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-950 p-6 lg:p-8 text-white border border-indigo-800/40 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 backdrop-blur-sm">
              <Languages className="w-3.5 h-3.5 text-indigo-400" />
              <span>MODULES.md §46 • Platform Language Packs</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Language Packs & Translation Management
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Global translation dictionaries, completeness metrics per language, JSON import/export,
              tenant availability controls, and missing-keys audit reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleExportJson('en')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Export Base Template (EN)
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              Add Language Pack
            </button>
          </div>
        </div>
      </div>

      {/* 2. Platform Concept Notice */}
      <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 flex items-start gap-3 text-xs text-indigo-900 dark:text-indigo-300">
        <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
            Tenant Localization Governance (MODULES.md §46)
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/60 rounded-full text-indigo-700 dark:text-indigo-300">
              Settings $\rightarrow$ Localization
            </span>
          </h4>
          <p className="leading-relaxed">
            Only languages marked <strong>"Available to Tenants"</strong> are selectable in tenant
            organization and branch localization settings (<code className="px-1 py-0.5 bg-indigo-100/50 dark:bg-indigo-900/40 rounded">/settings/localization</code>) and the user language switcher.
            Incomplete or in-progress language packs remain in <strong>Draft (Platform Only)</strong> status
            until translation completeness meets quality requirements.
          </p>
        </div>
      </div>

      {/* 3. Action Feedback */}
      {actionSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 4. Stat Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Supported Languages</span>
            <Languages className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100 mt-2">
            {totalLanguages} Packs
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Cross-jurisdiction UI catalogs</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider">Available to Tenants</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-2">
            {availableToTenantsCount} Live
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Selectable in /settings/localization</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-bold uppercase tracking-wider">Avg. Completeness</span>
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-2">
            {averageCompleteness}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Across all registered languages</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Baseline Keys</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100 mt-2">
            {baselineKeys.toLocaleString()} Keys
          </div>
          <div className="text-[11px] text-slate-400 mt-1">English (EN) reference strings</div>
        </div>
      </div>

      {/* 5. Filters Bar */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Availability filter */}
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Languages ({packs.length})</option>
            <option value="available">Available to Tenants Only ({availableToTenantsCount})</option>
            <option value="draft">Draft / Platform Only ({totalLanguages - availableToTenantsCount})</option>
          </select>

          {/* Direction filter */}
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Directions (LTR + RTL)</option>
            <option value="ltr">LTR — Left to Right</option>
            <option value="rtl">RTL — Right to Left</option>
          </select>

          {/* Search box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code or language..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={loadLanguagePacks}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors self-end sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* 6. Language Packs List / Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">Loading platform language packs...</p>
        </div>
      ) : filteredPacks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <Languages className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            No language packs match your filter
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search criteria or register a new language pack.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPacks.map((pack) => {
            const isDefault = pack.isDefault;
            const isAvailable = pack.isAvailableToTenants;
            const completeness = pack.completenessPercent;

            return (
              <div
                key={pack.id}
                className={`flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 shadow-sm hover:shadow-md ${
                  isDefault
                    ? 'border-indigo-400/80 dark:border-indigo-500/50 ring-1 ring-indigo-500/20'
                    : isAvailable
                    ? 'border-emerald-200 dark:border-emerald-800/40'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-black font-mono text-sm uppercase shadow-sm ${
                          isDefault
                            ? 'bg-indigo-600 text-white'
                            : isAvailable
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {pack.code}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {pack.name}
                          </h3>
                          <span className="text-xs text-slate-400 font-medium">
                            · {pack.nativeName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                            {pack.direction.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            v{pack.version}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex flex-col items-end gap-1">
                      {isDefault && (
                        <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Canonical Base
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                          isAvailable
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {isAvailable ? 'Available to Tenants' : 'Draft · Platform Only'}
                      </span>
                    </div>
                  </div>

                  {/* Completeness Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                        Translation Completeness
                      </span>
                      <span
                        className={`font-mono text-xs font-bold ${
                          completeness >= 90
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : completeness >= 50
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {completeness}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          completeness >= 90
                            ? 'bg-emerald-500'
                            : completeness >= 50
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${completeness}%` }}
                      />
                    </div>
                  </div>

                  {/* Keys Count Breakdown */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Translated Keys
                      </div>
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {pack.translatedKeys.toLocaleString()} / {pack.totalKeys.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Missing Keys
                      </div>
                      <div
                        className={`font-mono font-bold mt-0.5 ${
                          pack.missingKeysCount === 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {pack.missingKeysCount === 0
                          ? '0 (Complete)'
                          : `${pack.missingKeysCount.toLocaleString()} missing`}
                      </div>
                    </div>
                  </div>

                  {/* Notes / Descriptions */}
                  {pack.notes && (
                    <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {pack.notes}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                  {/* Availability Toggle Switch */}
                  <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/40 px-2.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Tenant Access:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleAvailability(pack)}
                      disabled={togglingCode === pack.code || isDefault}
                      className={`text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        isDefault
                          ? 'opacity-60 cursor-not-allowed text-indigo-600 dark:text-indigo-400'
                          : isAvailable
                          ? 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                      }`}
                      title={
                        isDefault
                          ? 'Canonical language is permanently active'
                          : isAvailable
                          ? 'Click to revoke tenant availability'
                          : 'Click to make available to tenants'
                      }
                    >
                      {togglingCode === pack.code ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : isAvailable ? (
                        <ToggleRight className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-slate-400" />
                      )}
                      <span>{isAvailable ? 'Enabled' : 'Disabled'}</span>
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedPackForReport(pack)}
                      className="px-2 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center gap-1 transition-colors"
                      title="Inspect translation completeness and missing keys"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Missing Keys
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportJson(pack.code)}
                      disabled={exportingCode === pack.code}
                      className="px-2 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1 transition-colors"
                      title="Download JSON translation dictionary"
                    >
                      <Download className={`w-3.5 h-3.5 ${exportingCode === pack.code ? 'animate-bounce' : ''}`} />
                      Export
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPackForImport(pack)}
                      className="px-2 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-1 transition-colors"
                      title="Upload or paste translation JSON to update catalog"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Import
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Missing Keys Report Modal */}
      {selectedPackForReport && (
        <MissingKeysReportModal
          isOpen={true}
          onClose={() => setSelectedPackForReport(null)}
          languageCode={selectedPackForReport.code}
          languageName={selectedPackForReport.name}
          onOpenImport={(code) => {
            const p = packs.find((item) => item.code === code);
            if (p) setSelectedPackForImport(p);
          }}
        />
      )}

      {/* Import Translations Modal */}
      {selectedPackForImport && (
        <ImportLanguagePackModal
          isOpen={true}
          onClose={() => setSelectedPackForImport(null)}
          onSuccess={() => {
            loadLanguagePacks();
            setActionSuccessMsg(`Successfully imported translations for ${selectedPackForImport.name}.`);
            setTimeout(() => setActionSuccessMsg(null), 4000);
          }}
          languageCode={selectedPackForImport.code}
          languageName={selectedPackForImport.name}
        />
      )}

      {/* Add Language Pack Modal */}
      {isAddModalOpen && (
        <AddLanguagePackModal
          isOpen={true}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            loadLanguagePacks();
            setActionSuccessMsg('New language pack registered successfully.');
            setTimeout(() => setActionSuccessMsg(null), 4000);
          }}
        />
      )}
    </div>
  );
}
