import type { MinimumTaxConfig } from '@hrm/shared-types';
import { DollarSign, ShieldAlert, Sliders } from 'lucide-react';

interface MinimumTaxSectionProps {
  config: MinimumTaxConfig;
  currency: string;
  isReadOnly?: boolean;
  onChange: (config: MinimumTaxConfig) => void;
}

export function MinimumTaxSection({
  config,
  currency,
  isReadOnly = false,
  onChange,
}: MinimumTaxSectionProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Minimum Tax Floor & Statutory Ceilings</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            If statutory tax liability after progressive brackets and rebates falls below this floor, the minimum tax is levied.
          </p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            disabled={isReadOnly}
            checked={config.enabled}
            onChange={(e) =>
              onChange({
                ...config,
                enabled: e.target.value === 'true' || e.target.checked,
              })
            }
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
          />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Enforce Minimum Tax Floor
          </span>
        </label>
      </div>

      {config.enabled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Minimum Statutory Tax Amount ({currency}) *
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-sans text-xs">
                $
              </span>
              <input
                type="number"
                disabled={isReadOnly}
                min={0}
                step="any"
                value={config.amount}
                onChange={(e) =>
                  onChange({
                    ...config,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0.00"
                className="w-full h-8 pl-6 pr-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Statutory Exemption / Legal Rationale
            </label>
            <input
              type="text"
              disabled={isReadOnly}
              value={config.description || ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  description: e.target.value,
                })
              }
              placeholder="e.g. Finance Act Section 82 minimum withholding floor"
              className="w-full h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
