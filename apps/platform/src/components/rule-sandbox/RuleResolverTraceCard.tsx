import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  FileText,
  FlaskConical,
  Layers,
  Sparkles,
} from 'lucide-react';
import type {
  RuleSandboxResolvedCategory,
  RuleSandboxSimulationResult,
} from '@hrm/shared-types';

interface RuleResolverTraceCardProps {
  simulation: RuleSandboxSimulationResult;
}

export function RuleResolverTraceCard({ simulation }: RuleResolverTraceCardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('tax');
  const [expandedPayload, setExpandedPayload] = useState<boolean>(false);

  const categories = Object.values(simulation.resolvedCategories);
  const activeCat: RuleSandboxResolvedCategory | undefined =
    simulation.resolvedCategories[selectedCategory] || categories[0];

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/50 via-sky-50/30 to-transparent dark:from-indigo-950/20 dark:via-sky-950/10 dark:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center ring-1 ring-indigo-500/20">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Rule Resolver Chain Trace
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                  Deterministic
                </span>
                {simulation.isDraftTest && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/30">
                    <FlaskConical className="h-3 w-3" />
                    Draft Override Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Resolution chain evaluation order: Global → Country → State → Company Policy → Employee Contract (RULES.md §2).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 5-Layer Resolution Flow Visualization */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
          Chain Hierarchy & Precedence Levels
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {simulation.resolutionChainOverview.map((layer, idx) => (
            <div
              key={layer.level}
              className="relative p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>{layer.level}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                  {layer.status}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {layer.description}
                </p>
              </div>
              {idx < simulation.resolutionChainOverview.length - 1 && (
                <div className="hidden sm:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 text-slate-300 dark:text-slate-700">
                  <ChevronRight className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-5 pt-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.ruleType;
          return (
            <button
              key={cat.ruleType}
              type="button"
              onClick={() => setSelectedCategory(cat.ruleType)}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-2 ${
                isSelected
                  ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>{cat.ruleTypeLabel}</span>
              {cat.isDraftOverride ? (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                  Draft v{cat.resolvedVersionNumber}
                </span>
              ) : cat.resolvedVersionNumber != null ? (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  v{cat.resolvedVersionNumber}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Category Detail Panel */}
      {activeCat && (
        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Resolved {activeCat.ruleTypeLabel}
                </span>
                {activeCat.isDraftOverride ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
                    Version {activeCat.resolvedVersionNumber} · Draft Override
                  </span>
                ) : activeCat.resolvedVersionNumber != null ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                    Version {activeCat.resolvedVersionNumber} · Published
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Global Fallback Baseline
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                <span>
                  Effective:{' '}
                  <strong>
                    {activeCat.effectiveFrom || 'Standard Default'} →{' '}
                    {activeCat.effectiveTo || 'Present (Open-Ended)'}
                  </strong>
                </span>
                {activeCat.sourceReference && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                      <FileText className="h-3 w-3 text-slate-400" />
                      {activeCat.sourceReference}
                    </span>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExpandedPayload(!expandedPayload)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <Code2 className="h-3.5 w-3.5 text-indigo-500" />
              <span>{expandedPayload ? 'Hide' : 'Inspect'} Payload</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform ${
                  expandedPayload ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {activeCat.changeNote && (
            <div className="text-xs text-slate-600 dark:text-slate-300 italic px-1">
              “{activeCat.changeNote}”
            </div>
          )}

          {/* Expanded Raw Payload */}
          {expandedPayload && (
            <div className="p-4 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 overflow-x-auto text-[11px] font-mono leading-relaxed max-h-72">
              <pre>{JSON.stringify(activeCat.mergedPayload, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
