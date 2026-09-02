import { useState } from 'react';
import {
  Printer,
  Download,
  FileText,
  Building2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  Send,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Form';
import { samplePayslip, sampleFinalSettlementPayslip, type PayslipData } from '@/data/payrollData';

export function PayslipPage() {
  const [isFinalSettlement, setIsFinalSettlement] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('August 2024');

  const slip: PayslipData = isFinalSettlement ? sampleFinalSettlementPayslip : samplePayslip;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1000px] mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-primary">Payslip & Settlement Preview</h1>
          <p className="text-sm text-secondary mt-0.5">
            Compliant, printable employee salary slips and full & final settlement statements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="surface border border-base rounded-lg p-1 flex items-center gap-1">
            <button
              onClick={() => setIsFinalSettlement(false)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                !isFinalSettlement
                  ? 'bg-accent-600 text-white shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Standard Payslip
            </button>
            <button
              onClick={() => setIsFinalSettlement(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                isFinalSettlement
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Final Settlement (Exit)
            </button>
          </div>

          <Button variant="secondary" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* Payslip Document Preview (Printable Sheet) */}
      <div className="surface border border-base rounded-2xl shadow-xl overflow-hidden print:border-none print:shadow-none p-6 sm:p-8 space-y-6 bg-surface">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-base pb-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-accent-600 flex items-center justify-center text-white shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary">Nexus HR Technologies Inc.</h2>
              <p className="text-xs text-secondary">
                100 Market St, Suite 400, San Francisco, CA 94105 · Employer ID: EIN-98-401928
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className="flex sm:justify-end">
              {isFinalSettlement ? (
                <span className="px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-bold uppercase tracking-wider border border-rose-300 dark:border-rose-800">
                  Full & Final Settlement
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-accent-100 dark:bg-accent-950/50 text-accent-700 dark:text-accent-300 text-xs font-bold uppercase tracking-wider border border-accent-300 dark:border-accent-800">
                  Monthly Payslip
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-muted mt-1.5">Slip #: {slip.payslipNumber}</div>
            <div className="text-xs text-secondary mt-0.5">Pay Date: {slip.payDate}</div>
          </div>
        </div>

        {/* Employee Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[rgb(var(--bg-muted))] text-xs">
          <div>
            <span className="text-muted block">Employee Name</span>
            <span className="font-bold text-primary text-sm">{slip.employeeName}</span>
          </div>
          <div>
            <span className="text-muted block">Employee ID</span>
            <span className="font-semibold text-primary font-mono">{slip.employeeId}</span>
          </div>
          <div>
            <span className="text-muted block">Designation</span>
            <span className="font-semibold text-primary">{slip.designation}</span>
          </div>
          <div>
            <span className="text-muted block">Department</span>
            <span className="font-semibold text-primary">{slip.department}</span>
          </div>

          <div>
            <span className="text-muted block">Date of Joining</span>
            <span className="text-secondary">{slip.joiningDate}</span>
          </div>
          <div>
            <span className="text-muted block">Bank Account</span>
            <span className="font-mono text-secondary">{slip.accountNumber}</span>
          </div>
          <div>
            <span className="text-muted block">PAN / SSN #</span>
            <span className="font-mono text-secondary">{slip.panOrSsn}</span>
          </div>
          <div>
            <span className="text-muted block">Pay Period</span>
            <span className="text-secondary">{slip.period}</span>
          </div>
        </div>

        {/* Attendance Summary Bar */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs p-2 rounded-lg border border-base">
          <div>
            <span className="text-muted">Working Days: </span>
            <strong className="text-primary">{slip.workingDays}</strong>
          </div>
          <div>
            <span className="text-muted">Leaves Taken: </span>
            <strong className="text-primary">{slip.leavesTaken}</strong>
          </div>
          <div>
            <span className="text-muted">Loss of Pay Days: </span>
            <strong className="text-primary">{slip.lossOfPayDays}</strong>
          </div>
        </div>

        {/* Settlement Specific Banner */}
        {isFinalSettlement && slip.settlementDetails && (
          <div className="surface border border-rose-500/30 bg-rose-50/20 dark:bg-rose-950/20 rounded-xl p-4 text-xs space-y-2">
            <div className="font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider text-[11px]">
              Exit Clearance & Severance Summary
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>Last Working Day: <strong className="text-primary">{slip.settlementDetails.lastWorkingDay}</strong></div>
              <div>Leave Encashment: <strong className="text-primary">${slip.settlementDetails.leaveEncashment}</strong></div>
              <div>Gratuity (Statutory): <strong className="text-primary">${slip.settlementDetails.gratuity}</strong></div>
              <div>Asset Clearance: <strong className="text-success-600">✓ Completed</strong></div>
            </div>
          </div>
        )}

        {/* Earnings & Deductions Dual Table */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Earnings Table */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-success-700 dark:text-success-300 uppercase tracking-wider border-b border-base pb-2 flex items-center justify-between">
              <span>Earnings</span>
              <span>Amount ($)</span>
            </div>
            <div className="divide-y divide-[rgb(var(--border-base))] text-xs">
              {slip.earnings.map((e) => (
                <div key={e.label} className="py-2 flex items-center justify-between">
                  <span className="text-secondary">{e.label}</span>
                  <span className="font-medium text-primary">${e.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t-2 border-base flex items-center justify-between font-bold text-sm text-primary">
              <span>Gross Earnings</span>
              <span className="text-success-600 dark:text-success-400">
                ${slip.grossEarnings.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Deductions Table */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-error-700 dark:text-error-300 uppercase tracking-wider border-b border-base pb-2 flex items-center justify-between">
              <span>Deductions</span>
              <span>Amount ($)</span>
            </div>
            <div className="divide-y divide-[rgb(var(--border-base))] text-xs">
              {slip.deductions.map((d) => (
                <div key={d.label} className="py-2 flex items-center justify-between">
                  <span className="text-secondary">{d.label}</span>
                  <span className="font-medium text-error-600">-${d.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t-2 border-base flex items-center justify-between font-bold text-sm text-primary">
              <span>Total Deductions</span>
              <span className="text-error-600">
                -${slip.totalDeductions.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Net Pay Callout Footer */}
        <div className="surface border-2 border-success-500/40 rounded-2xl p-5 bg-success-50/20 dark:bg-success-950/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs text-secondary font-medium">Net Take-Home Pay (Disbursed)</div>
            <div className="text-xs font-medium text-muted mt-0.5">{slip.netPayInWords}</div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-success-600 dark:text-success-400">
            ${slip.netPay.toLocaleString()}
          </div>
        </div>

        {/* YTD Summary Bar */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-base text-xs text-center text-muted">
          <div>YTD Gross: <strong className="text-primary">${slip.ytdGross.toLocaleString()}</strong></div>
          <div>YTD Tax Paid: <strong className="text-primary">${slip.ytdTax.toLocaleString()}</strong></div>
          <div>YTD Net Pay: <strong className="text-primary">${slip.ytdNet.toLocaleString()}</strong></div>
        </div>

        {/* Signatures Footer */}
        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-base text-xs text-secondary">
          <div>
            <div className="h-10 border-b border-dashed border-base" />
            <span className="block mt-1">Employer Authorized Signatory</span>
          </div>
          <div className="text-right">
            <div className="h-10 border-b border-dashed border-base" />
            <span className="block mt-1">Employee Acknowledgement</span>
          </div>
        </div>
      </div>
    </div>
  );
}

