import { useState } from 'react';
import type {
  LeaveAccrualType,
  StatutoryLeaveCategory,
  StatutoryLeaveRuleItem,
} from '@hrm/shared-types';
import {
  Baby,
  Calendar,
  CheckCircle2,
  FileText,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  Info,
  Palmtree,
  Plus,
  RotateCcw,
  Sparkles,
  Stethoscope,
  Trash2,
  Users,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface StatutoryLeaveTableProps {
  leaves: StatutoryLeaveRuleItem[];
  isReadOnly?: boolean;
  countryIso: string;
  onChange: (leaves: StatutoryLeaveRuleItem[]) => void;
  onLoadPreset?: () => void;
}

const CATEGORY_ICONS: Record<StatutoryLeaveCategory, any> = {
  annual: Palmtree,
  sick: Stethoscope,
  maternity: Baby,
  paternity: Users,
  compassionate: HeartHandshake,
  unpaid: Calendar,
  study: GraduationCap,
  other: FileText,
};

const CATEGORY_COLORS: Record<StatutoryLeaveCategory, string> = {
  annual: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  sick: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  maternity: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800',
  paternity: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  compassionate: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  unpaid: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700',
  study: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
  other: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700',
};

const CATEGORY_LABELS: Record<StatutoryLeaveCategory, string> = {
  annual: 'Annual / Vacation Leave',
  sick: 'Sick & Carer\'s Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity / Partner Leave',
  compassionate: 'Compassionate / Bereavement',
  unpaid: 'Unpaid Leave of Absence',
  study: 'Study & Examination Leave',
  other: 'General Statutory Leave',
};

export function StatutoryLeaveTable({
  leaves,
  isReadOnly = false,
  countryIso,
  onChange,
  onLoadPreset,
}: StatutoryLeaveTableProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state for adding statutory leave type
  const [category, setCategory] = useState<StatutoryLeaveCategory>('annual');
  const [name, setName] = useState('');
  const [isPaid, setIsPaid] = useState(true);
  const [minimumEntitlementDays, setMinimumEntitlementDays] = useState<number>(20);
  const [accrualMethod, setAccrualMethod] = useState<LeaveAccrualType>('monthly');
  const [carryForwardAllowed, setCarryForwardAllowed] = useState(true);
  const [maxCarryForwardDays, setMaxCarryForwardDays] = useState<string>('');
  const [carryForwardExpiryMonths, setCarryForwardExpiryMonths] = useState<string>('');
  const [encashmentAllowed, setEncashmentAllowed] = useState(false);
  const [maxEncashmentDays, setMaxEncashmentDays] = useState<string>('');
  const [proRataApplicable, setProRataApplicable] = useState(true);
  const [notes, setNotes] = useState('');

  const handleOpenAddModal = (presetCategory?: StatutoryLeaveCategory) => {
    const cat = presetCategory || 'annual';
    setCategory(cat);
    setName(CATEGORY_LABELS[cat]);
    setIsPaid(cat !== 'unpaid');
    setMinimumEntitlementDays(cat === 'annual' ? 20 : cat === 'sick' ? 10 : cat === 'maternity' ? 84 : cat === 'paternity' ? 10 : cat === 'compassionate' ? 2 : 5);
    setAccrualMethod(cat === 'annual' || cat === 'sick' ? 'monthly' : 'on_hire');
    setCarryForwardAllowed(cat === 'annual' || cat === 'sick');
    setMaxCarryForwardDays('');
    setCarryForwardExpiryMonths('');
    setEncashmentAllowed(cat === 'annual');
    setMaxEncashmentDays(cat === 'annual' ? '10' : '');
    setProRataApplicable(cat === 'annual' || cat === 'sick');
    setNotes(countryIso === 'AUS' ? 'Fair Work Act 2009 National Employment Standards (NES)' : 'Statutory legal baseline');
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newItem: StatutoryLeaveRuleItem = {
      id: `stat-leave-${Date.now()}`,
      category,
      leaveType: category,
      name: name.trim(),
      isPaid,
      minimumEntitlementDays: Math.max(0, Number(minimumEntitlementDays) || 0),
      accrualMethod,
      carryForwardAllowed,
      maxCarryForwardDays:
        carryForwardAllowed && maxCarryForwardDays !== '' ? Number(maxCarryForwardDays) : null,
      carryForwardExpiryMonths:
        carryForwardAllowed && carryForwardExpiryMonths !== ''
          ? Number(carryForwardExpiryMonths)
          : null,
      encashmentAllowed,
      maxEncashmentDays:
        encashmentAllowed && maxEncashmentDays !== '' ? Number(maxEncashmentDays) : null,
      proRataApplicable,
      notes: notes.trim() || undefined,
    };

    onChange([...leaves, newItem]);
    setIsAddModalOpen(false);
  };

  const handleDeleteItem = (id: string) => {
    onChange(leaves.filter((l) => l.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Statutory Leave Entitlements & Legal Minimums ({leaves.length} Types)
          </h4>
          <p className="text-xs text-slate-500">
            Mandated legal baseline entitlements. Tenant companies may exceed these days in company policies, but cannot lawfully go below them.
          </p>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-2">
            {onLoadPreset && (
              <button
                type="button"
                onClick={onLoadPreset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/80 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 text-xs font-semibold shadow-2xs transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Load {countryIso === 'AUS' ? 'AU Fair Work' : 'Standard'} Preset</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-2xs transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Statutory Leave Type</span>
            </button>
          </div>
        )}
      </div>

      {leaves.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center bg-slate-50/50 dark:bg-slate-900/50">
          <Calendar className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            No statutory leave rules configured for this version.
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Click &quot;Load Preset&quot; or &quot;Add Statutory Leave Type&quot; above to establish statutory baselines.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3">Statutory Category & Name</th>
                <th className="px-3 py-3">Paid / Unpaid</th>
                <th className="px-3 py-3 font-mono">Legal Minimum</th>
                <th className="px-3 py-3">Accrual Method</th>
                <th className="px-3 py-3">Carry-Forward Rules</th>
                <th className="px-3 py-3">Encashment</th>
                <th className="px-3 py-3">Pro-Rata</th>
                {!isReadOnly && <th className="px-3 py-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {leaves.map((leave) => {
                const CatIcon = CATEGORY_ICONS[leave.category] || Calendar;
                const catClass = CATEGORY_COLORS[leave.category] || CATEGORY_COLORS.other;

                return (
                  <tr
                    key={leave.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${catClass}`}
                        >
                          <CatIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>{leave.name}</span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded border text-slate-500 bg-slate-50 dark:bg-slate-800">
                              {leave.category}
                            </span>
                          </div>
                          {leave.notes && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {leave.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      {leave.isPaid ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400">
                          Unpaid
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                        {leave.minimumEntitlementDays}{' '}
                        <span className="text-[10px] text-slate-500 font-normal">days/yr</span>
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <span className="capitalize text-slate-700 dark:text-slate-300">
                        {leave.accrualMethod === 'monthly'
                          ? 'Monthly Accrual'
                          : leave.accrualMethod === 'yearly'
                          ? 'Yearly Frontload'
                          : 'On-Hire Credit'}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-[11px]">
                      {leave.carryForwardAllowed ? (
                        <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          <span>
                            Allowed
                            {leave.maxCarryForwardDays !== null
                              ? ` (Max ${leave.maxCarryForwardDays}d)`
                              : ' (Unlimited)'}
                            {leave.carryForwardExpiryMonths !== null
                              ? ` · Exp: ${leave.carryForwardExpiryMonths}mo`
                              : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">No Carry-Forward</span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-[11px]">
                      {leave.encashmentAllowed ? (
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          Permitted
                          {leave.maxEncashmentDays !== null
                            ? ` (Max ${leave.maxEncashmentDays}d)`
                            : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400">Prohibited</span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {leave.proRataApplicable ? (
                        <span className="text-slate-600 dark:text-slate-400">Yes</span>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </td>

                    {!isReadOnly && (
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(leave.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                          title="Delete statutory leave type"
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
      )}

      {/* Add Statutory Leave Type Modal */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Statutory Leave Type (Legal Minimum)"
        size="lg"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Statutory Category *
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const cat = e.target.value as StatutoryLeaveCategory;
                  setCategory(cat);
                  setName(CATEGORY_LABELS[cat]);
                  setIsPaid(cat !== 'unpaid');
                }}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="annual">Annual / Vacation Leave</option>
                <option value="sick">Sick & Carer&apos;s Leave</option>
                <option value="maternity">Maternity Leave</option>
                <option value="paternity">Paternity / Partner Leave</option>
                <option value="compassionate">Compassionate / Bereavement</option>
                <option value="unpaid">Unpaid Leave of Absence</option>
                <option value="study">Study & Examination Leave</option>
                <option value="other">General Statutory Leave</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Display Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Annual Leave (NES)"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Legal Minimum Entitlement (Days) *
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                required
                value={minimumEntitlementDays}
                onChange={(e) => setMinimumEntitlementDays(parseFloat(e.target.value) || 0)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Accrual Method *
              </label>
              <select
                value={accrualMethod}
                onChange={(e) => setAccrualMethod(e.target.value as LeaveAccrualType)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="monthly">Monthly Pro-Rata Accrual</option>
                <option value="yearly">Yearly Frontload Crediting</option>
                <option value="on_hire">In Full Upon Hire</option>
              </select>
            </div>

            <div className="flex items-center gap-4 pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={isPaid}
                  onChange={(e) => setIsPaid(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Statutory Paid Leave</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={proRataApplicable}
                  onChange={(e) => setProRataApplicable(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Pro-Rata Part-Time</span>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={carryForwardAllowed}
                  onChange={(e) => setCarryForwardAllowed(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Statutory Carry-Forward Legally Permitted / Mandated</span>
              </label>
            </div>

            {carryForwardAllowed && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Max Carry-Forward Days (Leave empty for unlimited)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Unlimited"
                    value={maxCarryForwardDays}
                    onChange={(e) => setMaxCarryForwardDays(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Carry-Forward Expiry (Months, leave empty if never)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Never expires"
                    value={carryForwardExpiryMonths}
                    onChange={(e) => setCarryForwardExpiryMonths(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={encashmentAllowed}
                  onChange={(e) => setEncashmentAllowed(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Statutory Encashment / Cash-Out Allowed</span>
              </label>
            </div>

            {encashmentAllowed && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Max Encashment Days / Year (Leave empty for uncapped)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 10 (AU Fair Work Award standard)"
                    value={maxEncashmentDays}
                    onChange={(e) => setMaxEncashmentDays(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Statutory Legislation & NES Clause Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Fair Work Act 2009 (NES) §87: 4 weeks paid annual leave"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs"
            >
              Add Statutory Leave Type
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
