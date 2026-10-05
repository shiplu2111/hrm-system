import { Check, Minus } from 'lucide-react';
import { comparison, plans } from '@/lib/plans';

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto h-5 w-5 text-brand-600" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto h-5 w-5 text-slate-300" aria-label="Not included" />;
  return <span className="text-sm text-slate-700">{value}</span>;
}

export function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <caption className="sr-only">Plan comparison</caption>
        <thead>
          <tr className="border-b border-slate-200">
            <th scope="col" className="w-2/5 px-6 py-5 text-sm font-semibold text-slate-500">
              Features
            </th>
            {plans.map((plan) => (
              <th key={plan.id} scope="col" className="px-4 py-5 text-center text-base font-semibold text-slate-900">
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        {comparison.map((group) => (
          <tbody key={group.group}>
            <tr className="bg-slate-50">
              <th scope="colgroup" colSpan={plans.length + 1} className="px-6 py-3 text-sm font-semibold text-slate-900">
                {group.group}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label} className="border-t border-slate-100">
                <th scope="row" className="px-6 py-3.5 text-sm font-normal text-slate-700">
                  {row.label}
                </th>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-4 py-3.5 text-center">
                    <CellValue value={row.values[plan.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
