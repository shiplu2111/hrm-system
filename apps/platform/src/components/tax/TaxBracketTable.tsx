import { useMemo } from 'react';
import type { TaxBracketRow, TaxBracketValidationError } from '@hrm/shared-types';
import {
  calculateCumulativeFixedAmounts,
  validateTaxBrackets,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Info,
  Plus,
  Trash2,
} from 'lucide-react';

interface TaxBracketTableProps {
  brackets: TaxBracketRow[];
  currency: string;
  isReadOnly?: boolean;
  onChange: (brackets: TaxBracketRow[]) => void;
}

export function TaxBracketTable({
  brackets,
  currency,
  isReadOnly = false,
  onChange,
}: TaxBracketTableProps) {
  // Validate brackets in real-time
  const validation = useMemo(() => validateTaxBrackets(brackets), [brackets]);

  const getRowError = (index: number): TaxBracketValidationError | undefined => {
    return validation.errors.find((e) => e.index === index);
  };

  const handleUpdateRow = (
    index: number,
    field: keyof TaxBracketRow,
    value: any,
  ) => {
    if (isReadOnly) return;
    const updated = brackets.map((row, i) => {
      if (i !== index) return row;
      return {
        ...row,
        [field]: value,
      };
    });
    onChange(updated);
  };

  const handleAddRow = () => {
    if (isReadOnly) return;
    const lastRow = brackets[brackets.length - 1];
    let nextFrom = 0;
    if (lastRow) {
      if (lastRow.to !== null && lastRow.to !== undefined) {
        nextFrom = lastRow.to;
      } else {
        // Last row was open-ended, give it a ceiling first
        nextFrom = lastRow.from + 50000;
        lastRow.to = nextFrom;
      }
    }

    const newRow: TaxBracketRow = {
      from: nextFrom,
      to: null, // New last row is open-ended
      rate: lastRow ? Math.min(lastRow.rate + 5, 50) : 10,
      fixedAmount: 0,
    };

    const newBrackets = [...brackets, newRow];
    // Automatically recalculate fixed amounts
    const withFixedAmounts = calculateCumulativeFixedAmounts(newBrackets);
    onChange(withFixedAmounts);
  };

  const handleDeleteRow = (index: number) => {
    if (isReadOnly || brackets.length <= 1) return;
    const filtered = brackets.filter((_, i) => i !== index);
    // If the new last row had a finite 'to' and user wants contiguous or open-ended:
    onChange(filtered);
  };

  const handleAutoCalculateFixedAmounts = () => {
    if (isReadOnly) return;
    const recalculated = calculateCumulativeFixedAmounts(brackets);
    onChange(recalculated);
  };

  return (
    <div className="space-y-4">
      {/* Validation Status Summary Banner */}
      <div
        className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 transition-colors ${
          validation.isValid
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300'
            : 'bg-amber-50/80 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300'
        }`}
      >
        {validation.isValid ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-bold">
              {validation.isValid
                ? 'Statutory Bracket Sequence Valid'
                : 'Inline Validation Warning: Bracket Sequence Non-Compliant'}
            </span>
            <span className="font-mono text-[11px] font-semibold opacity-75">
              {brackets.length} {brackets.length === 1 ? 'Tier' : 'Tiers'} Configured
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed">
            {validation.isValid
              ? 'All brackets are strictly contiguous, ascending, and non-overlapping. The final bracket is properly open-ended.'
              : validation.summaryError}
          </p>
        </div>
      </div>

      {/* Bracket Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-2.5 px-3 w-12 text-center">Tier</th>
              <th className="py-2.5 px-3 min-w-[140px]">
                Lower Threshold (From {currency})
              </th>
              <th className="py-2.5 px-3 min-w-[160px]">
                Upper Threshold (To {currency})
              </th>
              <th className="py-2.5 px-3 w-32">Marginal Rate (%)</th>
              <th className="py-2.5 px-3 min-w-[150px]">
                Fixed / Base Tax ({currency})
              </th>
              <th className="py-2.5 px-3 min-w-[130px]">Tier Spread</th>
              {!isReadOnly && (
                <th className="py-2.5 px-3 w-12 text-center">Action</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
            {brackets.map((row, idx) => {
              const isLast = idx === brackets.length - 1;
              const rowErr = getRowError(idx);
              const isOpenEnded = row.to === null || row.to === undefined;

              const spread =
                row.to !== null && row.to !== undefined && row.to > row.from
                  ? row.to - row.from
                  : null;

              return (
                <tr
                  key={idx}
                  className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                    rowErr
                      ? 'bg-red-50/40 dark:bg-red-950/20'
                      : ''
                  }`}
                >
                  {/* Tier Number */}
                  <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                    #{idx + 1}
                  </td>

                  {/* From Threshold */}
                  <td className="py-2.5 px-3">
                    <div className="relative flex items-center">
                      <span className="absolute left-2.5 text-slate-400 font-sans text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        disabled={isReadOnly || idx > 0} // First row from is editable; subsequent contiguous rows derive from previous to
                        min={0}
                        step="any"
                        value={row.from}
                        onChange={(e) =>
                          handleUpdateRow(
                            idx,
                            'from',
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className={`w-full h-8 pl-6 pr-2 rounded-lg border text-xs font-mono font-bold focus:outline-none focus:ring-1 ${
                          isReadOnly || idx > 0
                            ? 'bg-slate-100 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:ring-indigo-500'
                        }`}
                      />
                    </div>
                  </td>

                  {/* To Threshold */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      {isOpenEnded ? (
                        <div className="flex-1 flex items-center justify-between h-8 px-3 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-xs font-sans font-bold">
                          <span>No Ceiling (Open-Ended)</span>
                          <span className="text-[10px] font-mono">∞</span >
                        </div>
                      ) : (
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 text-slate-400 font-sans text-xs">
                            $
                          </span>
                          <input
                            type="number"
                            disabled={isReadOnly}
                            min={row.from + 1}
                            step="any"
                            value={row.to ?? ''}
                            onChange={(e) => {
                              const val =
                                e.target.value === ''
                                  ? null
                                  : parseFloat(e.target.value);
                              handleUpdateRow(idx, 'to', val);
                              // Keep subsequent contiguous rows in sync
                              if (val !== null && brackets[idx + 1]) {
                                const nextRows = [...brackets];
                                nextRows[idx].to = val;
                                nextRows[idx + 1].from = val;
                                onChange(nextRows);
                              }
                            }}
                            className={`w-full h-8 pl-6 pr-2 rounded-lg border text-xs font-mono font-bold focus:outline-none focus:ring-1 ${
                              rowErr?.field === 'to'
                                ? 'border-red-400 bg-red-50/50 text-red-900 focus:ring-red-500'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-indigo-500'
                            }`}
                          />
                        </div>
                      )}

                      {/* Open-ended toggle on last bracket */}
                      {isLast && !isReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isOpenEnded) {
                              // Set finite ceiling
                              handleUpdateRow(idx, 'to', row.from + 50000);
                            } else {
                              // Make open ended
                              handleUpdateRow(idx, 'to', null);
                            }
                          }}
                          title={
                            isOpenEnded
                              ? 'Change to finite ceiling'
                              : 'Make open-ended'
                          }
                          className="px-2 py-1 text-[10px] font-sans font-bold rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition whitespace-nowrap"
                        >
                          {isOpenEnded ? 'Add Limit' : 'Open-Ended'}
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Marginal Rate (%) */}
                  <td className="py-2.5 px-3">
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        disabled={isReadOnly}
                        min={0}
                        max={100}
                        step="0.01"
                        value={row.rate}
                        onChange={(e) =>
                          handleUpdateRow(
                            idx,
                            'rate',
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className={`w-full h-8 pl-2.5 pr-6 rounded-lg border text-xs font-mono font-bold focus:outline-none focus:ring-1 ${
                          rowErr?.field === 'rate'
                            ? 'border-red-400 bg-red-50/50 text-red-900'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-indigo-500'
                        }`}
                      />
                      <span className="absolute right-2 text-slate-400 font-sans font-bold text-xs">
                        %
                      </span>
                    </div>
                  </td>

                  {/* Fixed / Base Amount */}
                  <td className="py-2.5 px-3">
                    <div className="relative flex items-center">
                      <span className="absolute left-2.5 text-slate-400 font-sans text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        disabled={isReadOnly}
                        min={0}
                        step="any"
                        value={row.fixedAmount}
                        onChange={(e) =>
                          handleUpdateRow(
                            idx,
                            'fixedAmount',
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-full h-8 pl-6 pr-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </td>

                  {/* Spread / Tier Width */}
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                    {spread !== null ? (
                      <span>+${spread.toLocaleString()}</span>
                    ) : (
                      <span className="text-indigo-500 font-semibold">
                        Open Ceiling
                      </span>
                    )}
                  </td>

                  {/* Row Delete */}
                  {!isReadOnly && (
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        disabled={brackets.length <= 1}
                        onClick={() => handleDeleteRow(idx)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition disabled:opacity-30 disabled:hover:text-slate-400"
                        title="Delete bracket row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Row-Level Specific Errors Callout */}
      {validation.errors.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {validation.errors.map((err, eIdx) => (
            <div
              key={eIdx}
              className="flex items-center gap-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table Action Bar */}
      {!isReadOnly && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Info className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span>
              Contiguous rule: Each tier starts exactly where previous tier
              ends. Final tier may remain open-ended.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-calculate fixed amounts */}
            <button
              type="button"
              onClick={handleAutoCalculateFixedAmounts}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 transition shadow-xs"
              title="Auto-calculate cumulative fixed tax amounts from preceding bracket thresholds and rates"
            >
              <Calculator className="h-3.5 w-3.5 text-indigo-500" />
              <span>Auto-Calculate Base Taxes</span>
            </button>

            {/* Add Next Bracket */}
            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Bracket Tier</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
