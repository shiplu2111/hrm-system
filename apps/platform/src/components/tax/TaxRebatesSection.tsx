import { useState } from 'react';
import type { TaxRebateAllowance, TaxRebateType } from '@hrm/shared-types';
import {
  Coins,
  HelpCircle,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface TaxRebatesSectionProps {
  rebates: TaxRebateAllowance[];
  currency: string;
  isReadOnly?: boolean;
  onChange: (rebates: TaxRebateAllowance[]) => void;
}

export function TaxRebatesSection({
  rebates,
  currency,
  isReadOnly = false,
  onChange,
}: TaxRebatesSectionProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<TaxRebateType>('fixed_amount');
  const [amount, setAmount] = useState<number>(500);
  const [threshold, setThreshold] = useState<number | ''>('');
  const [phaseOutRate, setPhaseOutRate] = useState<number | ''>('');
  const [description, setDescription] = useState('');

  const handleOpenAddModal = () => {
    setName('');
    setCode('');
    setType('fixed_amount');
    setAmount(700);
    setThreshold('');
    setPhaseOutRate('');
    setDescription('');
    setIsAddModalOpen(true);
  };

  const handleAddRebate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    const newRebate: TaxRebateAllowance = {
      id: `rebate-${Date.now()}`,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      type,
      amount: Number(amount) || 0,
      threshold: threshold !== '' ? Number(threshold) : null,
      phaseOutRate: phaseOutRate !== '' ? Number(phaseOutRate) : null,
      description: description.trim() || undefined,
    };

    onChange([...rebates, newRebate]);
    setIsAddModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (isReadOnly) return;
    onChange(rebates.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Statutory Rebates, Offsets & Personal Allowances</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure statutory reductions (e.g. Low Income Tax Offset, Personal Relief, Dependent Credits) applied during payroll tax calculation.
          </p>
        </div>

        {!isReadOnly && (
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100/70 transition shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Rebate / Offset</span>
          </button>
        )}
      </div>

      {rebates.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400">
          <p className="text-xs font-semibold">No statutory tax offsets or rebates configured.</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Standard progressive tax will calculate without statutory credits.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Name & Code</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Amount ({currency})</th>
                <th className="py-2.5 px-3">Phase-Out Threshold</th>
                <th className="py-2.5 px-3">Description</th>
                {!isReadOnly && <th className="py-2.5 px-3 w-12 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {rebates.map((rebate) => (
                <tr key={rebate.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {rebate.name}
                      </span>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {rebate.code}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="capitalize px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                      {rebate.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ${rebate.amount.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {rebate.threshold ? (
                      <span>
                        Starts at ${rebate.threshold.toLocaleString()}
                        {rebate.phaseOutRate ? ` (-${(rebate.phaseOutRate * 100).toFixed(2)}%/$)` : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400">No Phase-Out</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                    {rebate.description || '—'}
                  </td>
                  {!isReadOnly && (
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(rebate.id)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Rebate Modal */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Statutory Rebate or Allowance"
        size="md"
      >
        <form onSubmit={handleAddRebate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Rebate Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Low Income Tax Offset"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Statutory Code *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. LITO"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Credit Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TaxRebateType)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="fixed_amount">Fixed Amount Offset</option>
                <option value="tapered">Tapered / Phased-Out Above Threshold</option>
                <option value="percentage">Percentage Offset</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Maximum Credit Amount ({currency}) *
              </label>
              <input
                type="number"
                required
                min={0}
                step="any"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {type === 'tapered' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Phase-Out Start Threshold ({currency})
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="e.g. 37500"
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Taper Rate (cents per $ or decimal)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  value={phaseOutRate}
                  onChange={(e) => setPhaseOutRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="e.g. 0.015 (1.5 cents)"
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Statutory Background / Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Income Tax Assessment Act 1997 s.61-115"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition"
            >
              Add Rebate
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
