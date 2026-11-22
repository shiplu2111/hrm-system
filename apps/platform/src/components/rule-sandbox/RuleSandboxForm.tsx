import { useEffect, useState } from 'react';
import {
  Calendar,
  DollarSign,
  FileCode2,
  FlaskConical,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  User,
} from 'lucide-react';
import type {
  CountrySummary,
  RuleSandboxDraftCandidate,
  RuleSandboxEmployeeProfile,
  RuleSandboxSimulationInput,
  StateProvinceView,
} from '@hrm/shared-types';
import { getRuleSandboxDraftCandidates } from '@/lib/platform-countries-api';

interface RuleSandboxFormProps {
  countries: CountrySummary[];
  selectedCountryId: string;
  onSelectCountryId: (id: string) => void;
  states: StateProvinceView[];
  selectedStateId: string | null;
  onSelectStateId: (id: string | null) => void;
  calculationDate: string;
  onChangeCalculationDate: (d: string) => void;
  selectedDraftVersionId: string | null;
  onSelectDraftVersionId: (id: string | null) => void;
  profile: RuleSandboxEmployeeProfile;
  onChangeProfile: (p: RuleSandboxEmployeeProfile) => void;
  onRunSimulation: () => void;
  loading: boolean;
}

interface ProfilePreset {
  id: string;
  name: string;
  description: string;
  profile: RuleSandboxEmployeeProfile;
}

const PRESETS: ProfilePreset[] = [
  {
    id: 'standard-full-time',
    name: 'Standard Full-Time',
    description: 'Base $8,500/mo · 10h Weekday OT · 4h Weekend OT · 1d Unpaid Leave',
    profile: {
      baseSalary: 8500,
      payFrequency: 'monthly',
      standardHoursWorked: 160,
      overtime: {
        weekdayHours: 10,
        weekendHours: 4,
        holidayHours: 0,
        nightHours: 0,
      },
      leave: {
        paidLeaveDays: 1,
        unpaidLeaveDays: 1,
      },
      filingStatus: 'single',
      voluntaryPensionRate: 0,
    },
  },
  {
    id: 'shift-worker',
    name: 'Shift Worker & Penalties',
    description: 'Base $5,500/mo · 15h Weekday · 8h Weekend · 4h Holiday · 6h Night',
    profile: {
      baseSalary: 5500,
      payFrequency: 'monthly',
      standardHoursWorked: 160,
      overtime: {
        weekdayHours: 15,
        weekendHours: 8,
        holidayHours: 4,
        nightHours: 6,
      },
      leave: {
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
      },
      filingStatus: 'single',
      voluntaryPensionRate: 2,
    },
  },
  {
    id: 'executive',
    name: 'High-Earner Executive',
    description: 'Base $20,000/mo · 0h Overtime · Married filing status · Top Bracket',
    profile: {
      baseSalary: 20000,
      payFrequency: 'monthly',
      standardHoursWorked: 160,
      overtime: {
        weekdayHours: 0,
        weekendHours: 0,
        holidayHours: 0,
        nightHours: 0,
      },
      leave: {
        paidLeaveDays: 2,
        unpaidLeaveDays: 0,
      },
      filingStatus: 'married',
      voluntaryPensionRate: 5,
    },
  },
  {
    id: 'casual-part-time',
    name: 'Part-Time / Casual',
    description: 'Base $3,200/mo · 6h Weekday OT · Low tax tier',
    profile: {
      baseSalary: 3200,
      payFrequency: 'monthly',
      standardHoursWorked: 80,
      overtime: {
        weekdayHours: 6,
        weekendHours: 0,
        holidayHours: 0,
        nightHours: 0,
      },
      leave: {
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
      },
      filingStatus: 'single',
      voluntaryPensionRate: 0,
    },
  },
];

export function RuleSandboxForm({
  countries,
  selectedCountryId,
  onSelectCountryId,
  states,
  selectedStateId,
  onSelectStateId,
  calculationDate,
  onChangeCalculationDate,
  selectedDraftVersionId,
  onSelectDraftVersionId,
  profile,
  onChangeProfile,
  onRunSimulation,
  loading,
}: RuleSandboxFormProps) {
  const [draftCandidates, setDraftCandidates] = useState<RuleSandboxDraftCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(false);

  // Fetch draft candidates whenever selected country or state changes
  useEffect(() => {
    if (!selectedCountryId) return;
    let isCurrent = true;
    setLoadingCandidates(true);
    getRuleSandboxDraftCandidates(selectedCountryId, selectedStateId)
      .then((candidates) => {
        if (isCurrent) setDraftCandidates(candidates);
      })
      .catch(() => {
        if (isCurrent) setDraftCandidates([]);
      })
      .finally(() => {
        if (isCurrent) setLoadingCandidates(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [selectedCountryId, selectedStateId]);

  const selectedCountry = countries.find((c) => c.id === selectedCountryId);
  const currency = selectedCountry?.currency || 'USD';

  const applyPreset = (preset: ProfilePreset) => {
    onChangeProfile({ ...preset.profile });
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5 space-y-6">
      {/* 1. Jurisdiction & Effective Timing Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-indigo-500" />
          <h4 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
            1. Jurisdiction & Effective Calculation Date
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Country */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Country Jurisdiction *
            </label>
            <select
              value={selectedCountryId}
              onChange={(e) => onSelectCountryId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.isoCode}) — {c.currency}
                </option>
              ))}
            </select>
          </div>

          {/* State / Province */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              State / Province Subdivision
            </label>
            <select
              value={selectedStateId || ''}
              onChange={(e) => onSelectStateId(e.target.value || null)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">National / Federal (All Subdivisions)</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Calculation Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Calculation Date (Authoritative) *
            </label>
            <input
              type="date"
              value={calculationDate}
              onChange={(e) => onChangeCalculationDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* 2. Pre-Publish Draft Version Override Section */}
      <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h4 className="font-bold text-xs text-amber-900 dark:text-amber-200 uppercase tracking-wider text-[11px]">
              2. Test an Unpublished Draft Version (Pre-Publish Dry Run)
            </h4>
          </div>
          {loadingCandidates && (
            <span className="text-[10px] text-amber-600 animate-pulse font-medium">
              Checking draft rules...
            </span>
          )}
        </div>
        <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mb-3 leading-relaxed">
          Select a draft or pending rule version to test its mathematical impact on tax, overtime, and take-home pay before approving and publishing it to live tenants.
        </p>

        <select
          value={selectedDraftVersionId || ''}
          onChange={(e) => onSelectDraftVersionId(e.target.value || null)}
          className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
        >
          <option value="">
            ✓ None (Resolve Currently Published Statutory Baselines)
          </option>
          {draftCandidates.map((c) => (
            <option key={c.id} value={c.id}>
              [TEST DRAFT] {c.ruleTypeLabel} · Version {c.version} ({c.status.toUpperCase()}) — Effective {c.effectiveFrom} {c.changeNote ? `— "${c.changeNote.slice(0, 45)}..."` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Sample Employee Profile & Presets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-indigo-500" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
              3. Sample Employee Profile Parameters
            </h4>
          </div>
          <div className="text-[11px] font-semibold text-slate-400">
            Quick Presets:
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 hover:bg-indigo-50 hover:border-indigo-300 dark:hover:bg-indigo-950/40 dark:hover:border-indigo-800 text-left transition group"
            >
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                {p.name}
              </div>
              <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                {p.description}
              </div>
            </button>
          ))}
        </div>

        {/* Profile Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          {/* Base Salary */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Base Salary ({currency} / month) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                {currency}
              </span>
              <input
                type="number"
                min="0"
                step="100"
                value={profile.baseSalary}
                onChange={(e) =>
                  onChangeProfile({ ...profile, baseSalary: Number(e.target.value) || 0 })
                }
                className="w-full pl-12 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Filing Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Tax Filing Status
            </label>
            <select
              value={profile.filingStatus || 'single'}
              onChange={(e) => onChangeProfile({ ...profile, filingStatus: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="single">Single / Individual Standard</option>
              <option value="married">Married / Joint</option>
              <option value="head_of_household">Head of Household</option>
            </select>
          </div>

          {/* Voluntary Pension Rate */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Voluntary Pension Contribution (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={profile.voluntaryPensionRate || 0}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  voluntaryPensionRate: Number(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Overtime Breakdown */}
          <div className="sm:col-span-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Overtime Hours Logged in Period
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Weekday OT (h)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={profile.overtime?.weekdayHours || 0}
                  onChange={(e) =>
                    onChangeProfile({
                      ...profile,
                      overtime: {
                        ...profile.overtime,
                        weekdayHours: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Weekend OT (h)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={profile.overtime?.weekendHours || 0}
                  onChange={(e) =>
                    onChangeProfile({
                      ...profile,
                      overtime: {
                        ...profile.overtime,
                        weekendHours: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Holiday OT (h)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={profile.overtime?.holidayHours || 0}
                  onChange={(e) =>
                    onChangeProfile({
                      ...profile,
                      overtime: {
                        ...profile.overtime,
                        holidayHours: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Night Shift (h)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={profile.overtime?.nightHours || 0}
                  onChange={(e) =>
                    onChangeProfile({
                      ...profile,
                      overtime: {
                        ...profile.overtime,
                        nightHours: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Leave Taken */}
          <div className="sm:col-span-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Leave Taken in Period
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Paid Leave Days
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={profile.leave?.paidLeaveDays || 0}
                  onChange={(e) =>
                    onChangeProfile({
                      ...profile,
                      leave: {
                        ...profile.leave,
                        paidLeaveDays: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Unpaid Leave Days
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={profile.leave?.unpaidLeaveDays || 0}
                  onChange={(e) =>
                    onChangeProfile({
                      ...profile,
                      leave: {
                        ...profile.leave,
                        unpaidLeaveDays: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Sick Leave Days
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={profile.leave?.sickLeaveDays || 0}
                  onChange={(e) =>
                    onChangeProfile({
                      ...profile,
                      leave: {
                        ...profile.leave,
                        sickLeaveDays: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onRunSimulation}
          disabled={loading || !selectedCountryId}
          className="w-full h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/25 transition disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <span>Resolving Rules & Computing Breakdown...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-white" />
              <span>Run Resolver & Calculate (Dry Run Simulation)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
