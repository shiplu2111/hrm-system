import { useState } from 'react';
import type {
  StatutoryFundCategory,
  StatutoryFundItem,
} from '@hrm/shared-types';
import {
  Activity,
  HeartPulse,
  Landmark,
  Plus,
  Shield,
  Trash2,
  Umbrella,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface StatutoryFundsTableProps {
  funds: StatutoryFundItem[];
  currency: string;
  isReadOnly?: boolean;
  onChange: (funds: StatutoryFundItem[]) => void;
  onAutoSumRates?: () => void;
}

const CATEGORY_ICONS: Record<StatutoryFundCategory, any> = {
  pension: Landmark,
  health: HeartPulse,
  unemployment: Umbrella,
  disability: Activity,
  accident: Shield,
  maternity: HeartPulse,
  provident: Landmark,
  other: Shield,
};

const CATEGORY_LABELS: Record<StatutoryFundCategory, string> = {
  pension: 'Pension / Superannuation',
  health: 'Health Insurance / Medical',
  unemployment: 'Unemployment Insurance',
  disability: 'Disability & Incapacity',
  accident: 'Work Injury & Workers Comp',
  maternity: 'Maternity / Paternity Fund',
  provident: 'Statutory Provident Fund',
  other: 'General Statutory Social Fund',
};

export function StatutoryFundsTable({
  funds,
  currency,
  isReadOnly = false,
  onChange,
  onAutoSumRates,
}: StatutoryFundsTableProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New fund form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<StatutoryFundCategory>('pension');
  const [employeeRate, setEmployeeRate] = useState<number>(0);
  const [employerRate, setEmployerRate] = useState<number>(10);
  const [wageFloor, setWageFloor] = useState<string>('');
  const [wageCeiling, setWageCeiling] = useState<string>('');
  const [contributionBase, setContributionBase] = useState<'gross' | 'basic'>('gross');
  const [preTax, setPreTax] = useState(true);
  const [administratorName, setAdministratorName] = useState('');
  const [description, setDescription] = useState('');

  const handleAddFund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    const newFund: StatutoryFundItem = {
      id: `fund-${Date.now()}`,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      category,
      employeeRate: Math.max(0, Math.min(100, employeeRate)),
      employerRate: Math.max(0, Math.min(100, employerRate)),
      wageFloor: wageFloor !== '' ? parseFloat(wageFloor) : null,
      wageCeiling: wageCeiling !== '' ? parseFloat(wageCeiling) : null,
      contributionBase,
      preTax,
      administratorName: administratorName.trim() || undefined,
      description: description.trim() || undefined,
    };

    onChange([...funds, newFund]);
    setIsAddModalOpen(false);

    // Reset form
    setName('');
    setCode('');
    setCategory('pension');
    setEmployeeRate(0);
    setEmployerRate(10);
    setWageFloor('');
    setWageCeiling('');
    setAdministratorName('');
    setDescription('');
  };

  const handleDeleteFund = (id: string) => {
    if (isReadOnly) return;
    onChange(funds.filter((f) => f.id !== id));
  };

  const totalEmployeeRate = funds.reduce((acc, f) => acc + (f.employeeRate || 0), 0);
  const totalEmployerRate = funds.reduce((acc, f) => acc + (f.employerRate || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Statutory Component Breakdown / Sub-Funds</span>
          </h4>
          <p className="text-[11px] text-slate-500">
            For multi-tier social safety nets with distinct statutory schemes (e.g. US OASDI vs Medicare, Singapore CPF accounts).
          </p>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-2">
            {funds.length > 0 && onAutoSumRates && (
              <button
                type="button"
                onClick={onAutoSumRates}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
                title="Sum sub-fund rates into top-level scheme rates"
              >
                Auto-Sum Total Rates
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Sub-Fund</span>
            </button>
          </div>
        )}
      </div>

      {funds.length === 0 ? (
        <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 text-xs">
          <p className="font-semibold">No multi-component sub-funds configured.</p>
          <p className="text-[11px] mt-0.5 text-slate-400">
            Standard single-rate social contribution rules will apply using the primary rates above.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <th className="py-2.5 px-3">Sub-Fund / Component</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Employee Rate</th>
                <th className="py-2.5 px-3 text-right">Employer Rate</th>
                <th className="py-2.5 px-3">Wage Floor / Ceiling ({currency})</th>
                <th className="py-2.5 px-3">Tax Treatment</th>
                {!isReadOnly && <th className="py-2.5 px-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {funds.map((fund) => {
                const IconComponent = CATEGORY_ICONS[fund.category] || Shield;
                return (
                  <tr key={fund.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                          <IconComponent className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{fund.name}</span>
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                              {fund.code}
                            </span>
                          </div>
                          {fund.administratorName && (
                            <span className="text-[10px] text-slate-400 block">{fund.administratorName}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                      {CATEGORY_LABELS[fund.category] || fund.category}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {fund.employeeRate}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {fund.employerRate}%
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {fund.wageFloor ? `Floor: $${fund.wageFloor.toLocaleString()}` : 'No Floor'} •{' '}
                      {fund.wageCeiling ? `Cap: $${fund.wageCeiling.toLocaleString()}` : 'Uncapped ∞'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          fund.preTax
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {fund.preTax ? 'Pre-Tax' : 'Post-Tax'}
                      </span>
                    </td>
                    {!isReadOnly && (
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteFund(fund.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                          title="Delete sub-fund"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 font-bold text-xs">
                <td colSpan={2} className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                  Combined Total Statutory Rates ({funds.length} Components):
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-white">
                  {totalEmployeeRate.toFixed(2)}%
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                  {totalEmployerRate.toFixed(2)}%
                </td>
                <td colSpan={isReadOnly ? 2 : 3} className="py-2.5 px-3 text-[11px] text-slate-400 italic">
                  Summed statutory liability across all sub-schemes
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add Sub-Fund Modal */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Statutory Component / Sub-Fund"
        size="md"
      >
        <form onSubmit={handleAddFund} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Sub-Fund Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Old Age & Survivors Insurance (OASDI)"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Fund Code *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. OASDI"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Statutory Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as StatutoryFundCategory)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Statutory Administrator Agency
              </label>
              <input
                type="text"
                value={administratorName}
                onChange={(e) => setAdministratorName(e.target.value)}
                placeholder="e.g. Social Security Administration"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Employee Rate (%) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min={0}
                  max={100}
                  step="0.01"
                  value={employeeRate}
                  onChange={(e) => setEmployeeRate(parseFloat(e.target.value) || 0)}
                  className="w-full h-8 pl-2.5 pr-6 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                  %
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Employer Rate (%) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min={0}
                  max={100}
                  step="0.01"
                  value={employerRate}
                  onChange={(e) => setEmployerRate(parseFloat(e.target.value) || 0)}
                  className="w-full h-8 pl-2.5 pr-6 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                  %
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Wage Floor / Min Base ({currency})
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={wageFloor}
                onChange={(e) => setWageFloor(e.target.value)}
                placeholder="Optional minimum wage floor"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Wage Ceiling / Max Cap ({currency})
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={wageCeiling}
                onChange={(e) => setWageCeiling(e.target.value)}
                placeholder="e.g. 168600 (or leave empty for uncapped)"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Contribution Base
              </label>
              <select
                value={contributionBase}
                onChange={(e) => setContributionBase(e.target.value as 'gross' | 'basic')}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="gross">Gross Salary / Total Earnings</option>
                <option value="basic">Basic Salary Only</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={preTax}
                  onChange={(e) => setPreTax(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Pre-Tax Deduction (Reduces Taxable Income)
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Description & Notes
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Mandatory statutory pension retirement insurance tier"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs"
            >
              Add Sub-Fund
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
