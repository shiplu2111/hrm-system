import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  Calculator,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Edit3,
  ExternalLink,
  Eye,
  Filter,
  Globe,
  History,
  Info,
  Layers,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { COMMON_CURRENCIES } from '@hrm/shared-types';
import type {
  PlatformExchangeRatePairSummary,
  PlatformExchangeRateProviderDef,
  PlatformRateSource,
} from '@hrm/shared-types';
import {
  listPlatformExchangeRatePairs,
  listPlatformExchangeRateProviders,
  syncPlatformExchangeRates,
} from '@/lib/platform-exchange-rates-api';
import { RateHistoryModal } from '@/components/exchange-rates/RateHistoryModal';
import { ManualOverrideModal } from '@/components/exchange-rates/ManualOverrideModal';
import { RateResolverSimulatorModal } from '@/components/exchange-rates/RateResolverSimulatorModal';

export function PlatformExchangeRatesPage() {
  const [pairs, setPairs] = useState<PlatformExchangeRatePairSummary[]>([]);
  const [providers, setProviders] = useState<PlatformExchangeRateProviderDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBaseFilter, setSelectedBaseFilter] = useState('all');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState('all');

  // Modals state
  const [historyModalPair, setHistoryModalPair] = useState<{ base: string; quote: string } | null>(null);
  const [overrideModalPair, setOverrideModalPair] = useState<{ base: string; quote: string } | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [pairsData, providersData] = await Promise.all([
        listPlatformExchangeRatePairs({
          baseCurrency: selectedBaseFilter === 'all' ? undefined : selectedBaseFilter,
          source: selectedSourceFilter === 'all' ? undefined : selectedSourceFilter,
        }),
        listPlatformExchangeRateProviders(),
      ]);
      setPairs(pairsData);
      setProviders(providersData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load platform exchange rates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBaseFilter, selectedSourceFilter]);

  // Sync from Provider
  const handleSyncProvider = async () => {
    setSyncing(true);
    setErrorMsg(null);
    try {
      const res = await syncPlatformExchangeRates({
        baseCurrency: 'AUD',
      });
      setActionSuccessMsg(
        `Successfully synchronized ${res.syncedCount} benchmark rates from Platform FX Feed. Rates are recorded with effective dates and never overwritten.`,
      );
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sync rates from provider');
    } finally {
      setSyncing(false);
    }
  };

  // Filter pairs
  const filteredPairs = pairs.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.baseCurrency.toLowerCase().includes(q) ||
      p.quoteCurrency.toLowerCase().includes(q) ||
      (p.currentRate && p.currentRate.providerName && p.currentRate.providerName.toLowerCase().includes(q)) ||
      (p.currentRate && p.currentRate.overrideReason && p.currentRate.overrideReason.toLowerCase().includes(q))
    );
  });

  const totalPairsCount = pairs.length;
  const totalOverridesCount = pairs.reduce((sum, p) => sum + p.overrideCount, 0);

  return (
    <div className="space-y-6">
      {/* 1. Top Hero Card */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-6 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Stage 24.1 • MODULES.md §46 • Platform Exchange Rates
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Platform Exchange Rates
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Global baseline exchange rates supporting multi-currency payroll. Rates are sourced via provider feeds or manual administrative entry, stored with effective dates, never overwritten, and accompanied by full rate-history and override audit trails.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsSimulatorOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              <Calculator className="w-4 h-4 text-emerald-400" />
              Resolver Simulator
            </button>
            <button
              type="button"
              onClick={handleSyncProvider}
              disabled={syncing}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-600/30"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Provider Rates'}
            </button>
            <button
              type="button"
              onClick={() => setOverrideModalPair({ base: 'AUD', quote: 'USD' })}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-amber-500/30"
            >
              <Edit3 className="w-4 h-4" />
              Manual Override
            </button>
          </div>
        </div>
      </div>

      {/* 2. Platform Default & Immutability Notice Banner */}
      <div className="rounded-2xl p-4 bg-gradient-to-r from-amber-50 via-orange-50/70 to-amber-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 text-amber-950 dark:text-amber-100 shadow-sm flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-100 flex items-center gap-2">
              <span>Platform Default Exchange Rates — Tenants May Override (Phase 2 Stage 24.1)</span>
            </h4>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
              Historical Rates Never Overwritten
            </span>
          </div>
          <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
            These exchange rates serve as the global cross-tenant platform defaults for multi-currency payroll calculations. Individual tenants may override any rate pair within their organization settings (Phase 2 Stage 24.1).
            <strong className="font-bold underline decoration-amber-500 underline-offset-2 ml-1">
              Historical rates are stored with effective dates and are never overwritten.
            </strong>{' '}
            Payroll runs permanently copy and lock their applicable rate on the pay period end date.
          </p>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{actionSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-600 hover:text-rose-800 font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Stat KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Currency Pairs Tracked
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
            {totalPairsCount} Pairs
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            Cross-currency coverage
          </span>
        </div>

        <div className="rounded-xl p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Active Rate Providers
          </span>
          <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
            {providers.length} Sources
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Platform FX Feed + Manual
          </span>
        </div>

        <div className="rounded-xl p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Manual Overrides Active
          </span>
          <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
            {totalOverridesCount} Recorded
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Mandatory audit reason logged
          </span>
        </div>

        <div className="rounded-xl p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
            Historical Integrity Lock
          </span>
          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Never Overwritten
          </span>
          <span className="text-[10px] text-slate-400 font-medium block mt-1">
            Effective dates enforced
          </span>
        </div>
      </div>

      {/* 4. Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Base Currency Filter */}
          <div className="flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-indigo-500" />
            <select
              value={selectedBaseFilter}
              onChange={(e) => setSelectedBaseFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Base Currencies</option>
              <option value="AUD">AUD — Australian Dollar</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="BDT">BDT — Bangladeshi Taka</option>
              <option value="CAD">CAD — Canadian Dollar</option>
              <option value="SGD">SGD — Singapore Dollar</option>
            </select>
          </div>

          {/* Source Filter */}
          <select
            value={selectedSourceFilter}
            onChange={(e) => setSelectedSourceFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 font-semibold"
          >
            <option value="all">All Sources</option>
            <option value="provider">Provider Feed (Platform FX)</option>
            <option value="manual_override">Manual Overrides Only</option>
            <option value="manual">Manual Entry Only</option>
          </select>

          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search currency pair code (e.g. AUD, BDT)..."
              className="w-full text-xs rounded-xl pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Refresh rates"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 5. Currency Pairs Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          Loading platform default exchange rates...
        </div>
      ) : filteredPairs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <Coins className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            No exchange rate pairs matching selected filters
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Try adjusting your search query, base currency filter, or sync rates from the provider.
          </p>
          <button
            type="button"
            onClick={handleSyncProvider}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Rates Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPairs.map((pair) => {
            const hasOverride = pair.overrideCount > 0;
            const current = pair.currentRate;
            const isLatestOverride = current?.source === 'manual_override';

            return (
              <div
                key={`${pair.baseCurrency}-${pair.quoteCurrency}`}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 space-y-3.5 hover:shadow-md transition-shadow relative overflow-hidden"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-sm border border-indigo-200/50">
                      {pair.baseCurrency} / {pair.quoteCurrency}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        {pair.baseCurrency} to {pair.quoteCurrency}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {pair.versionCount} version{pair.versionCount === 1 ? '' : 's'} recorded
                      </span>
                    </div>
                  </div>

                  {/* Status chip */}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      pair.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50'
                    }`}
                  >
                    {pair.status}
                  </span>
                </div>

                {/* Rate Display */}
                {current ? (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        1 {pair.quoteCurrency} =
                      </span>
                      <span className="font-mono font-black text-lg text-slate-900 dark:text-white">
                        {current.rate} <span className="text-xs font-normal text-slate-400">{pair.baseCurrency}</span>
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span>1 {pair.baseCurrency} =</span>
                      <span className="font-mono font-semibold">
                        {current.inverseRate || (1 / Number(current.rate)).toFixed(8)} {pair.quoteCurrency}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-850 rounded-xl">
                    No active rate in force
                  </div>
                )}

                {/* Metadata & Source Tags */}
                <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Effective: {current?.effectiveFrom || '2026-01-01'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isLatestOverride
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {isLatestOverride ? 'Manual Override' : (current?.providerName || current?.source || 'platform_default')}
                    </span>
                  </div>

                  {isLatestOverride && current?.overrideReason && (
                    <div className="text-[10px] text-amber-800 dark:text-amber-300 italic truncate bg-amber-50/50 dark:bg-amber-950/30 p-1 rounded border border-amber-200/50 dark:border-amber-900/40">
                      "{current.overrideReason}"
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setHistoryModalPair({ base: pair.baseCurrency, quote: pair.quoteCurrency })}
                    className="flex-1 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <History className="w-3.5 h-3.5 text-indigo-500" />
                    Rate History
                  </button>

                  <button
                    type="button"
                    onClick={() => setOverrideModalPair({ base: pair.baseCurrency, quote: pair.quoteCurrency })}
                    className="flex-1 py-1.5 text-xs font-bold rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                    Override
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rate History Modal */}
      {historyModalPair && (
        <RateHistoryModal
          isOpen={Boolean(historyModalPair)}
          onClose={() => setHistoryModalPair(null)}
          baseCurrency={historyModalPair.base}
          quoteCurrency={historyModalPair.quote}
          onOpenOverride={(base, quote) => setOverrideModalPair({ base, quote })}
        />
      )}

      {/* Manual Override Modal */}
      {overrideModalPair && (
        <ManualOverrideModal
          isOpen={Boolean(overrideModalPair)}
          onClose={() => setOverrideModalPair(null)}
          initialBase={overrideModalPair.base}
          initialQuote={overrideModalPair.quote}
          onSuccess={() => {
            setActionSuccessMsg(
              `Manual override applied for ${overrideModalPair.base} / ${overrideModalPair.quote}. Existing historical rates were preserved.`,
            );
            fetchData();
          }}
        />
      )}

      {/* Rate Resolver Simulator Sandbox Modal */}
      <RateResolverSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />
    </div>
  );
}
