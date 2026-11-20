import type { ComponentType } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Construction,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { NavItem } from '@/config/navigation';

interface ComingSoonPlaceholderProps {
  item: NavItem;
  onNavigateHome: () => void;
}

export function ComingSoonPlaceholder({ item, onNavigateHome }: ComingSoonPlaceholderProps) {
  const Icon = item.icon;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-fade-in">
      <button
        onClick={onNavigateHome}
        className="inline-flex items-center gap-2 text-xs font-semibold text-secondary hover:text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Platform Overview
      </button>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 lg:p-12 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-sm">
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {item.label}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700">
                  <Construction className="h-3 w-3" />
                  Planned
                </span>
              </div>
              <p className="text-sm text-secondary mt-1">
                {item.description}
              </p>
            </div>
          </div>

          {item.plannedStage && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-semibold text-secondary border border-slate-200 dark:border-slate-700">
              <Calendar className="h-3.5 w-3.5 text-amber-500" />
              <span>Roadmap: {item.plannedStage}</span>
            </div>
          )}
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Capability Preview
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              This module is part of the Platform Operations control plane. When deployed, it will enable platform administrators to manage cross-tenant configurations and automated workflows.
            </p>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 space-y-2.5">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-200">
                Core Responsibilities:
              </div>
              <ul className="text-xs text-secondary space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Centralized management across all tenant environments</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Deterministic validation and immutable audit trails</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Enforced RBAC restrictions by role permission</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              Architecture Isolation
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              In accordance with <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">docs/RULES.md</code>, this module operates strictly in the unscoped platform schema with zero tenant leakage.
            </p>
            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
              <strong>Security Note:</strong> All platform staff actions in this module require an active TOTP 2FA session and audience token <code className="font-mono text-[11px] bg-indigo-100 dark:bg-indigo-900 px-1 rounded">aud: "platform"</code>.
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onNavigateHome}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-white transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
