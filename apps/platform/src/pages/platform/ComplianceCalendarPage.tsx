import { useEffect, useState } from 'react';
import type { CountrySummary, StateProvinceView } from '@hrm/shared-types';
import {
  CalendarClock,
  ChevronDown,
  Globe,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
} from 'lucide-react';
import { listCountries, listStates } from '@/lib/platform-countries-api';
import { ComplianceCalendarEditor } from '@/components/compliance-calendar/ComplianceCalendarEditor';

const ISO_FLAGS: Record<string, string> = {
  AU: '🇦🇺',
  AUS: '🇦🇺',
  BD: '🇧🇩',
  BGD: '🇧🇩',
  US: '🇺🇸',
  USA: '🇺🇸',
  GB: '🇬🇧',
  GBR: '🇬🇧',
  CA: '🇨🇦',
  CAN: '🇨🇦',
  NZ: '🇳🇿',
  NZL: '🇳🇿',
  SG: '🇸🇬',
  SGP: '🇸🇬',
};

export function ComplianceCalendarPage() {
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');
  const [states, setStates] = useState<StateProvinceView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCountries = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listCountries();
      setCountries(data);
      if (data.length > 0 && !selectedCountryId) {
        // Prefer Australia if available or default to first country
        const au = data.find((c) => c.isoCode.toUpperCase() === 'AUS' || c.isoCode.toUpperCase() === 'AU');
        setSelectedCountryId(au ? au.id : data[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load countries');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCountries();
  }, []);

  useEffect(() => {
    if (!selectedCountryId) return;
    listStates(selectedCountryId)
      .then((st) => setStates(st))
      .catch(() => setStates([]));
  }, [selectedCountryId]);

  const selectedCountry = countries.find((c) => c.id === selectedCountryId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Page Header with Country Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
              MODULES.md §02 • Compliance Calendar
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2">
            <CalendarClock className="w-7 h-7 text-indigo-600" />
            <span>Statutory Compliance Calendar</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Jurisdiction-specific compliance schedules, month and list views, tenant advance notice dispatch, and statutory retirement tracking.
          </p>
        </div>

        {/* Country Selector Dropdown */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-sm">
            <span className="text-xs font-bold text-slate-500 pl-2">Jurisdiction:</span>
            <select
              value={selectedCountryId}
              onChange={(e) => setSelectedCountryId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white border-0 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {countries.map((c) => {
                const flag = ISO_FLAGS[c.isoCode.toUpperCase()] || '🌐';
                return (
                  <option key={c.id} value={c.id}>
                    {flag} {c.name} ({c.isoCode})
                  </option>
                );
              })}
            </select>
          </div>

          <button
            type="button"
            onClick={loadCountries}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title="Refresh jurisdictions"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading && !selectedCountry ? (
        <div className="py-24 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-3">
            Loading compliance jurisdictions...
          </p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 p-6 text-center text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto">
          <p className="font-bold">{error}</p>
          <button
            onClick={loadCountries}
            className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-xl font-bold"
          >
            Retry
          </button>
        </div>
      ) : selectedCountry ? (
        <ComplianceCalendarEditor
          key={selectedCountry.id}
          country={selectedCountry}
          states={states}
          onRefresh={loadCountries}
        />
      ) : null}
    </div>
  );
}
