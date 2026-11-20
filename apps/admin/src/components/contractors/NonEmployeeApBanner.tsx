import type { ReactNode } from 'react';
import {
  Building2,
  FileSpreadsheet,
  Landmark,
  ReceiptText,
  SlidersHorizontal,
} from 'lucide-react';
import { useNav } from '@/context/NavContext';

interface NonEmployeeApBannerProps {
  activeScreen: 'directory' | 'payment-terms' | 'invoices';
  title: string;
  subtitle: string;
  actions?: ReactNode;
}

/** Distinct B2B Accounts Payable banner separating external contractors from employee payroll. */
export function NonEmployeeApBanner({
  activeScreen,
  title,
  subtitle,
  actions,
}: NonEmployeeApBannerProps) {
  const { navigate } = useNav();

  return (
    <div className="rounded-xl border border-teal-300/80 dark:border-teal-800/70 border-l-4 border-l-teal-600 bg-gradient-to-r from-teal-50/90 via-white to-amber-50/70 dark:from-teal-950/35 dark:via-slate-900 dark:to-amber-950/20 p-4 lg:p-5 space-y-4 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-sm">
            {activeScreen === 'directory' ? (
              <Building2 className="h-5 w-5" />
            ) : (
              <ReceiptText className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-primary tracking-tight">{title}</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100/90 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-900 dark:border-amber-700/70 dark:bg-amber-950/60 dark:text-amber-200">
                <Landmark className="h-3 w-3" />
                Non-Employee AP Ledger
              </span>
            </div>
            <p className="text-sm text-secondary mt-0.5">{subtitle}</p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-dashed border-teal-200 dark:border-teal-800/60">
        <div className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-teal-200/80 dark:border-teal-800/70 bg-white/80 dark:bg-slate-900/70 p-1">
          <button
            type="button"
            onClick={() => navigate('vendors-contractors')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeScreen === 'directory'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-secondary hover:text-primary hover:bg-teal-50/80 dark:hover:bg-teal-950/40'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Contractors & Vendors
          </button>
          <button
            type="button"
            onClick={() => navigate('contractor-payment-terms')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeScreen === 'payment-terms'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-secondary hover:text-primary hover:bg-teal-50/80 dark:hover:bg-teal-950/40'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Payment Terms Setup
          </button>
          <button
            type="button"
            onClick={() => navigate('contractor-invoices')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeScreen === 'invoices'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-secondary hover:text-primary hover:bg-teal-50/80 dark:hover:bg-teal-950/40'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Invoices & Payment Batches
          </button>
        </div>

        <p className="text-[11px] font-medium text-teal-800 dark:text-teal-300">
          Isolated from Employee Payroll Runs &amp; Salary Structures — settled via contract terms &amp; B2B AP batches
        </p>
      </div>
    </div>
  );
}

