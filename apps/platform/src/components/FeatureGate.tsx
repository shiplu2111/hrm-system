import React from 'react';
import { ArrowUpRight, Lock, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

export interface FeatureGateEntitlement {
  feature: string;
  enabled: boolean;
  source: string;
  planCode: string;
  reason?: string | null;
}

export interface FeatureGateProps {
  feature: string;
  entitlement?: FeatureGateEntitlement;
  title?: string;
  description?: string;
  children: React.ReactNode;
  onUpgradePlan?: () => void;
  onGrantOverride?: () => void;
  disabledOverlay?: boolean;
}

export function FeatureGate({
  feature,
  entitlement,
  title = 'Feature Gated by Plan: Enterprise Tier Required',
  description = 'Custom Domains & White-label Branding is an Enterprise plan feature. This tenant does not have this capability enabled on their current subscription tier.',
  children,
  onUpgradePlan,
  onGrantOverride,
  disabledOverlay = true,
}: FeatureGateProps) {
  const isEnabled = entitlement?.enabled ?? true;
  const isOverridden = entitlement?.source === 'tenant_override';
  const isRollout = entitlement?.source === 'flag_rollout';

  if (!isEnabled) {
    return (
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 text-slate-900 dark:text-slate-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <Lock className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                    {title}
                  </h4>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <ShieldAlert className="h-3 w-3" />
                    Locked: {entitlement?.planCode?.toUpperCase() || 'STARTER'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Feature: {feature}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  {description}
                </p>
                {entitlement?.reason && (
                  <p className="text-[11px] font-mono text-amber-600 dark:text-amber-400/90 pt-0.5">
                    Evaluator note: {entitlement.reason}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-start shrink-0 pt-1 sm:pt-0">
              {onGrantOverride && (
                <button
                  type="button"
                  onClick={onGrantOverride}
                  className="px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Grant Override
                </button>
              )}
              {onUpgradePlan && (
                <button
                  type="button"
                  onClick={onUpgradePlan}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-sm transition"
                >
                  Upgrade Plan
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {disabledOverlay ? (
          <div className="relative">
            <div className="pointer-events-none opacity-45 filter blur-[0.5px]">
              {children}
            </div>
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-900/10 dark:bg-slate-950/20 backdrop-blur-[1px] rounded-2xl pointer-events-none">
              <div className="h-12 w-12 rounded-2xl bg-slate-900/80 dark:bg-slate-800/90 border border-slate-700 flex items-center justify-center text-amber-400 shadow-xl mb-2">
                <Lock className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Controls Locked by FeatureGate
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Upgrade tenant or grant a platform override to edit DNS & custom domains
              </p>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isOverridden && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>
              <strong>Platform Override Active:</strong> Custom Domains entitlement granted via manual platform override.
            </span>
          </div>
          {onGrantOverride && (
            <button
              type="button"
              onClick={onGrantOverride}
              className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Manage Override
            </button>
          )}
        </div>
      )}

      {isRollout && (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300">
          <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
          <span>
            <strong>Rollout Ring Active:</strong> Enrolled via gradual platform rollout bucket.
          </span>
        </div>
      )}

      {children}
    </div>
  );
}
