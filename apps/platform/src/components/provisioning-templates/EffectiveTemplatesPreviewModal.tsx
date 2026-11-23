import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  FileCheck,
  FileText,
  Globe,
  Info,
  Layers,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  CountrySummary,
  EffectiveProvisioningTemplatesResponse,
  PlatformTemplateCategory,
} from '@hrm/shared-types';
import { getEffectiveDefaultTemplates } from '@/lib/platform-countries-api';
import { TemplatePayloadViewer } from './TemplatePayloadViewer';

interface EffectiveTemplatesPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  countries: CountrySummary[];
  initialCountryId?: string | null;
}

const CATEGORY_TABS: {
  key: PlatformTemplateCategory;
  label: string;
  icon: any;
}[] = [
  { key: 'document_types', label: 'Document Types', icon: FileText },
  { key: 'leave_policies', label: 'Leave Policies', icon: Calendar },
  { key: 'notification_templates', label: 'Notifications', icon: Sparkles },
  { key: 'default_roles', label: 'Default Roles & RBAC', icon: Layers },
  { key: 'onboarding_checklists', label: 'Onboarding Checklist', icon: FileCheck },
];

export function EffectiveTemplatesPreviewModal({
  isOpen,
  onClose,
  countries,
  initialCountryId = null,
}: EffectiveTemplatesPreviewModalProps) {
  if (!isOpen) return null;

  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(initialCountryId);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EffectiveProvisioningTemplatesResponse | null>(null);
  const [activeCategory, setActiveCategory] = useState<PlatformTemplateCategory>('document_types');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchEffective = async (cId: string | null) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getEffectiveDefaultTemplates(cId ?? undefined);
      setData(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resolve effective templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEffective(selectedCountryId);
  }, [selectedCountryId]);

  const activeTemplate = data?.templates?.[activeCategory];
  const activeSource = data?.sources?.[activeCategory] ?? 'system_fallback';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 border border-indigo-200/50">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Stage C.0 Resolver
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Tenant Provisioning Seed Preview
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Simulate and inspect which template versions will be seeded when a brand-new tenant is provisioned in this jurisdiction.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Country Selector & Resolution Summary */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Select Jurisdiction:
            </span>
            <select
              value={selectedCountryId ?? 'global'}
              onChange={(e) =>
                setSelectedCountryId(e.target.value === 'global' ? null : e.target.value)
              }
              className="text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="global">🌐 Global Default (Cross-Jurisdiction)</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.isoCode})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Resolution Chain:</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold">
              Country published → Global published → System fallback
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              Resolving effective provisioning templates...
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          ) : (
            <>
              {/* Category Nav Tabs */}
              <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
                {CATEGORY_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeCategory === tab.key;
                  const source = data?.sources?.[tab.key] ?? 'system_fallback';
                  const tmpl = data?.templates?.[tab.key];

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveCategory(tab.key)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : source === 'country'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : source === 'global'
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        v{tmpl?.version ?? 1} • {source}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Template Metadata Banner */}
              {activeTemplate ? (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {activeTemplate.name}
                      </span>
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/50">
                        v{activeTemplate.version} Published
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          activeSource === 'country'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : activeSource === 'global'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        Source: {activeSource.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {activeTemplate.description && (
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                        {activeTemplate.description}
                      </p>
                    )}
                  </div>

                  <div className="text-right text-[11px] text-slate-400 font-mono">
                    Effective From: {activeTemplate.effectiveFrom}
                  </div>
                </div>
              ) : null}

              {/* Template Payload Viewer */}
              <TemplatePayloadViewer
                category={activeCategory}
                payload={activeTemplate?.payload}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>
              Changing a default template affects only tenants created afterwards, never existing tenants.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
