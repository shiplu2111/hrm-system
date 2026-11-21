import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Filter,
  Info,
  Loader2,
  Lock,
  Search,
  Sparkles,
} from 'lucide-react';
import type { PlatformPlanDetailView } from '@hrm/shared-types';
import { togglePlanFeature } from '@/lib/plans-api';

interface FeatureMatrixGridProps {
  plans: PlatformPlanDetailView[];
  onPlanUpdated: () => void;
  canEdit: boolean;
}

interface FeatureRowDef {
  key: string;
  name: string;
  category: 'Core HR & Time' | 'Workforce' | 'Payroll & Finance' | 'Platform & Security';
  description: string;
}

const FEATURE_DEFINITIONS: FeatureRowDef[] = [
  {
    key: 'core_hr',
    name: 'Core HR & Employee Directory',
    category: 'Core HR & Time',
    description: 'Employee profiles, personal docs, company hierarchy & teams',
  },
  {
    key: 'attendance',
    name: 'Time & Attendance Tracking',
    category: 'Core HR & Time',
    description: 'Clock-in/out, GPS geofencing, biometric device sync, break monitor',
  },
  {
    key: 'leave',
    name: 'Leave & Absence Management',
    category: 'Core HR & Time',
    description: 'Leave policies, balance tracking, accruals, multi-level approvals',
  },
  {
    key: 'roster',
    name: 'Shift Planning & Rostering',
    category: 'Workforce',
    description: 'Weekly schedule planning, shift swaps, open shifts, coverage heatmaps',
  },
  {
    key: 'timesheets',
    name: 'Timesheets & Overtime',
    category: 'Workforce',
    description: 'Daily/weekly timesheets, manager approvals, OT multiplier rules',
  },
  {
    key: 'basic_payroll',
    name: 'Standard Payroll Processing',
    category: 'Payroll & Finance',
    description: 'Automated salary calculations, tax withholdings, PDF payslips',
  },
  {
    key: 'custom_payroll_rules',
    name: 'Custom Payroll Rule Engine',
    category: 'Payroll & Finance',
    description: 'Tenant-specific custom allowances, formulas, statutory overrides',
  },
  {
    key: 'advanced_reports',
    name: 'Advanced Analytics & Reports',
    category: 'Platform & Security',
    description: 'Custom metric builder, scheduled CSV/Excel exports, executive dashboards',
  },
  {
    key: 'api_access',
    name: 'REST API & Webhooks Access',
    category: 'Platform & Security',
    description: 'Developer API tokens, automated event webhooks, third-party integrations',
  },
  {
    key: 'sso',
    name: 'Single Sign-On (SAML / SSO)',
    category: 'Platform & Security',
    description: 'Okta, Azure AD, Google Workspace SAML 2.0 corporate authentication',
  },
  {
    key: 'advanced_workflow',
    name: 'Advanced Automated Workflows',
    category: 'Platform & Security',
    description: 'Conditional approval paths, multi-approver chains, webhooks triggers',
  },
];

export function FeatureMatrixGrid({
  plans,
  onPlanUpdated,
  canEdit,
}: FeatureMatrixGridProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [togglingKeys, setTogglingKeys] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sort plans by rank ascending
  const sortedPlans = [...plans].sort((a, b) => a.rank - b.rank);

  // Filter features
  const filteredFeatures = FEATURE_DEFINITIONS.filter((feat) => {
    const matchesSearch =
      feat.name.toLowerCase().includes(search.toLowerCase()) ||
      feat.key.toLowerCase().includes(search.toLowerCase()) ||
      feat.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || feat.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', 'Core HR & Time', 'Workforce', 'Payroll & Finance', 'Platform & Security'];

  const handleToggle = async (planId: string, featureKey: string, currentEnabled: boolean) => {
    if (!canEdit) return;
    const opKey = `${planId}-${featureKey}`;
    if (togglingKeys[opKey]) return;

    try {
      setTogglingKeys((prev) => ({ ...prev, [opKey]: true }));
      setErrorMessage(null);

      await togglePlanFeature(planId, featureKey, !currentEnabled);
      onPlanUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to toggle feature flag.');
    } finally {
      setTogglingKeys((prev) => {
        const next = { ...prev };
        delete next[opKey];
        return next;
      });
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-4 w-4" /> Feature Matrix Grid
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
            Commercial Tier Entitlements
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Rows represent platform capabilities; columns represent active plans. Toggle flags directly to control tenant feature gates in real time.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search features..."
              className="h-9 w-full sm:w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 text-xs outline-none focus:border-indigo-400"
            />
          </div>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs outline-none focus:border-indigo-400"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorMessage && (
        <div className="m-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Interactive Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase font-bold text-slate-500">
              <th className="px-5 py-4 w-1/3">Platform Capability</th>
              {sortedPlans.map((plan) => {
                const enabledCount = (plan.features ?? []).filter((f) => f.enabled).length;
                return (
                  <th key={plan.id} className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                        {plan.name}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            plan.isActive
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                          }`}
                        >
                          {plan.isActive ? 'Public' : 'Hidden'}
                        </span>
                        <span className="text-[10px] text-slate-400 lowercase font-normal">
                          {enabledCount} active
                        </span>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {filteredFeatures.map((feature) => (
              <tr
                key={feature.key}
                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
              >
                <td className="px-5 py-3.5">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {feature.name}
                      </span>
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                        {feature.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      {feature.description}
                    </p>
                  </div>
                </td>

                {sortedPlans.map((plan) => {
                  const featureRecord = (plan.features ?? []).find(
                    (f) => f.featureKey === feature.key,
                  );
                  const isEnabled = featureRecord ? featureRecord.enabled : false;
                  const opKey = `${plan.id}-${feature.key}`;
                  const isToggling = Boolean(togglingKeys[opKey]);

                  return (
                    <td key={plan.id} className="px-4 py-3.5 text-center align-middle">
                      <div className="flex justify-center items-center">
                        {isToggling ? (
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                        ) : (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              disabled={!canEdit}
                              onChange={() => handleToggle(plan.id, featureKeyDef(feature.key), isEnabled)}
                              className="sr-only peer"
                              aria-label={`Toggle ${feature.name} for ${plan.name}`}
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                          </label>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 px-5">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          <span>
            Feature changes take effect immediately for new tenant sessions. Evaluated by <code>hasFeature(tenantId, featureKey)</code>.
          </span>
        </div>
        <div>
          Showing {filteredFeatures.length} of {FEATURE_DEFINITIONS.length} capability gates
        </div>
      </div>
    </div>
  );
}

function featureKeyDef(key: string): string {
  return key;
}
