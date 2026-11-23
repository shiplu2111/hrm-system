import React, { useEffect, useState } from 'react';
import {
  X,
  Eye,
  Globe,
  Building2,
  Calendar,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import type {
  CountrySummary,
  EffectiveProvisioningTemplatesResponse,
  PlatformDefaultTemplate,
  PlatformTemplateCategory,
} from '@hrm/shared-types';
import { getEffectiveDefaultTemplates } from '@/lib/platform-countries-api';
import { TemplatePayloadViewer } from './TemplatePayloadViewer';

interface CategoryPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: PlatformTemplateCategory;
  categoryLabel: string;
  countries: CountrySummary[];
  initialCountryId?: string | null;
}

export function CategoryPreviewModal({
  isOpen,
  onClose,
  category,
  categoryLabel,
  countries,
  initialCountryId = null,
}: CategoryPreviewModalProps) {
  const [selectedCountryId, setSelectedCountryId] = useState<string>(
    initialCountryId || 'global',
  );
  const [effectiveData, setEffectiveData] = useState<EffectiveProvisioningTemplatesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchEffective = async (cId: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getEffectiveDefaultTemplates(
        cId === 'global' ? undefined : cId,
      );
      setEffectiveData(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to simulate template resolution');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEffective(selectedCountryId);
    }
  }, [isOpen, selectedCountryId]);

  if (!isOpen) return null;

  const resolvedTemplate: PlatformDefaultTemplate | undefined = effectiveData?.templates?.[category];
  const resolvedSource = effectiveData?.sources?.[category] || 'global';

  const selectedCountryObj = countries.find((c) => c.id === selectedCountryId);
  const jurisdictionLabel =
    selectedCountryId === 'global'
      ? 'Global Default (Universal Baseline)'
      : selectedCountryObj
        ? `${selectedCountryObj.name} (${selectedCountryObj.isoCode})`
        : 'Selected Jurisdiction';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-850/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Preview New Tenant Seed: {categoryLabel}
                </h3>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                  Stage C.0 Resolver
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Simulate how {categoryLabel.toLowerCase()} are resolved and seeded when a new tenant workspace is created.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prominent Tenant Provisioning Isolation Notice Banner */}
        <div className="px-5 py-3 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border-b border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Applies to new tenants only:</strong> This simulation reflects what newly provisioned tenants in the selected jurisdiction will receive. Existing tenants are unaffected.
            </span>
          </div>
          <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold shrink-0">
            Immutable Tenant Workspaces
          </span>
        </div>

        {/* Jurisdiction Selector Bar */}
        <div className="px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <label className="text-slate-600 dark:text-slate-400 font-semibold flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-indigo-500" />
              Simulate Provisioning For Jurisdiction:
            </label>
            <select
              value={selectedCountryId}
              onChange={(e) => setSelectedCountryId(e.target.value)}
              className="text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="global">🌐 Global Default (Cross-Country Baseline)</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.isoCode})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => fetchEffective(selectedCountryId)}
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            title="Re-run resolution simulation"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
              Resolving effective template rules for {jurisdictionLabel}...
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs">
              {errorMsg}
            </div>
          ) : resolvedTemplate ? (
            <div className="space-y-4">
              {/* Resolution Info Banner */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {resolvedTemplate.name}
                    </span>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      v{resolvedTemplate.version} Published
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        resolvedSource === 'country'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : resolvedSource === 'global'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                      }`}
                    >
                      Resolved via: {resolvedSource === 'country' ? 'Country Specific Override' : resolvedSource === 'global' ? 'Global Default Baseline' : 'Static Hardcoded Fallback'}
                    </span>
                  </div>

                  {resolvedTemplate.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {resolvedTemplate.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1 flex-wrap">
                    <span>Effective From: {resolvedTemplate.effectiveFrom}</span>
                    {resolvedTemplate.sourceReference && (
                      <span className="flex items-center gap-1 text-slate-500">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                        Source: {resolvedTemplate.sourceReference}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Target Jurisdiction</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white block mt-0.5">{jurisdictionLabel}</span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block mt-0.5">Seeded into Workspace</span>
                </div>
              </div>

              {/* Formatted Payload Preview */}
              <div>
                <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  Resolved Configuration Structure (Stage C.0 Seed)
                </h5>
                <TemplatePayloadViewer
                  category={category}
                  payload={resolvedTemplate.payload}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 text-xs">
              No effective template resolved for this category.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Seed payload is strictly cloned into tenant workspace database tables upon provisioning.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
