import type { PayrollCalculationLine, PayrollCalculationPreview } from '@hrm/shared-types';
import { formatMoney, formatRate, payrollCopy } from '@/lib/payroll-copy';

function lineBasis(line: PayrollCalculationLine): string {
  if (line.calculationType === 'percentage' && line.percentage !== null) {
    return `${formatRate(line.percentage)}% × ${formatMoney(line.baseAmount)}`;
  }
  if (line.calculationType === 'formula') return line.formulaDescription ?? payrollCopy.calcType.formula;
  if ((line.payBasis === 'daily' || line.payBasis === 'hourly') && line.rate && line.units) {
    return payrollCopy.structures.lineTimeBased(formatMoney(line.rate), line.units, line.payBasis);
  }
  return payrollCopy.calcType.fixed;
}

/** Earnings and deductions side by side, each with its lines and total. */
export function PayBreakdownTables({ preview }: { preview: PayrollCalculationPreview }) {
  const sections: Array<{ title: string; lines: PayrollCalculationLine[]; total: string }> = [
    { title: payrollCopy.common.earnings, lines: preview.earnings, total: preview.grossPay },
    { title: payrollCopy.common.deductions, lines: preview.deductions, total: preview.totalDeductions },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {sections.map((section) => (
        <div key={section.title} className="rounded-lg border border-base overflow-hidden">
          <div className="px-4 py-2 bg-[rgb(var(--bg-muted))] text-xs font-semibold text-secondary">{section.title}</div>
          {section.lines.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">{payrollCopy.common.none}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {section.lines.map((line) => (
                  <tr key={line.salaryStructureId}>
                    <td className="px-4 py-2">
                      <div className="text-primary">{line.componentName}</div>
                      <div className="text-xs text-muted">{lineBasis(line)}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-primary">{formatMoney(line.amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="px-4 py-2 text-secondary">{payrollCopy.common.total}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-primary">{formatMoney(section.total)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
