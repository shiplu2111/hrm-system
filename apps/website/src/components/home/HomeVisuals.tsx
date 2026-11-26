import { ArrowRight, CheckCircle2, Layers, Lock, ShieldCheck, Smartphone } from 'lucide-react';
import type { WebsiteDictionary } from '../../i18n';

export function AdminVisualPlaceholder({ visual }: { visual: WebsiteDictionary['home']['hero']['visual'] }) {
  return (
    <div className="surface-elevated rounded-2xl overflow-hidden border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))]">
      {/* Window Chrome */}
      <div className="px-4 py-3 border-b border-[rgb(var(--border-base))] bg-secondary-50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary-300" />
            <span className="w-2.5 h-2.5 rounded-full bg-secondary-300" />
            <span className="w-2.5 h-2.5 rounded-full bg-secondary-300" />
          </div>
          <span className="text-xs font-semibold text-[rgb(var(--text-primary))] ml-1">{visual.title}</span>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-2xs font-mono font-semibold bg-warning-50 text-warning-700 border border-warning-200">
          {visual.statusBadge}
        </span>
      </div>

      {/* Structural Wireframe Body */}
      <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-12 gap-4 bg-[rgb(var(--bg-base))]/50">
        {/* Sidebar Preview */}
        <div className="sm:col-span-4 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-3 space-y-1.5">
          {Object.entries(visual.sidebarItems).map(([key, label], index) => (
            <div
              key={key}
              className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-2 ${
                index === 4
                  ? 'bg-primary-50 text-primary-700 border border-primary-100'
                  : 'text-[rgb(var(--text-secondary))]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  index === 4 ? 'bg-primary-600' : 'bg-secondary-300'
                }`}
                aria-hidden="true"
              />
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Main Panel Wireframe */}
        <div className="sm:col-span-8 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-3">
              <p className="text-2xs font-medium text-[rgb(var(--text-muted))]">{visual.metricCards.headcount}</p>
              <p className="mt-1 font-mono text-sm font-semibold text-[rgb(var(--text-primary))]">
                {visual.metricPlaceholders.headcountValue}
              </p>
            </div>
            <div className="rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-3">
              <p className="text-2xs font-medium text-[rgb(var(--text-muted))]">{visual.metricCards.onLeave}</p>
              <p className="mt-1 font-mono text-sm font-semibold text-[rgb(var(--text-primary))]">
                {visual.metricPlaceholders.onLeaveValue}
              </p>
            </div>
            <div className="rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-3">
              <p className="text-2xs font-medium text-[rgb(var(--text-muted))]">{visual.metricCards.pendingPayroll}</p>
              <p className="mt-1 font-mono text-sm font-semibold text-primary-700">
                {visual.metricPlaceholders.pendingPayrollValue}
              </p>
            </div>
            <div className="rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-3">
              <p className="text-2xs font-medium text-[rgb(var(--text-muted))]">{visual.metricCards.approvals}</p>
              <p className="mt-1 font-mono text-sm font-semibold text-[rgb(var(--text-primary))]">
                {visual.metricPlaceholders.approvalsValue}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-3.5">
            <p className="text-2xs font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))] mb-2.5">
              {visual.pipelineLabel}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {visual.pipelineSteps.map((step, idx) => (
                <div key={step} className="inline-flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-sm text-2xs font-semibold border ${
                      step === 'Finalized'
                        ? 'bg-success-50 text-success-700 border-success-200'
                        : 'bg-secondary-50 text-secondary-700 border-secondary-200'
                    }`}
                  >
                    {step}
                  </span>
                  {idx < visual.pipelineSteps.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-secondary-400" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Honest Disclaimer Footer */}
      <div className="px-4 py-2.5 bg-secondary-50 border-t border-[rgb(var(--border-base))] text-xs text-[rgb(var(--text-muted))] text-center">
        {visual.caption}
      </div>
    </div>
  );
}

export function RuleChainVisual({
  data,
}: {
  data: WebsiteDictionary['home']['differentiators']['countryCore'];
}) {
  return (
    <div className="surface rounded-xl p-6 sm:p-7 space-y-4">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[rgb(var(--border-base))]">
        <div>
          <h4 className="text-sm font-semibold text-[rgb(var(--text-primary))]">{data.visualTitle}</h4>
          <p className="text-xs text-[rgb(var(--text-muted))] mt-0.5">{data.visualSubtitle}</p>
        </div>
        <Layers className="w-5 h-5 text-primary-600 shrink-0" aria-hidden="true" />
      </div>
      <ol className="space-y-2.5">
        {data.visualChain.map((item, idx) => (
          <li
            key={item.layer}
            className={`rounded-lg border p-3 ${
              idx === data.visualChain.length - 1
                ? 'bg-primary-50/70 border-primary-200'
                : 'bg-[rgb(var(--bg-base))]/60 border-[rgb(var(--border-base))]'
            }`}
          >
            <div className="text-xs font-semibold text-[rgb(var(--text-primary))]">{item.layer}</div>
            <div className="text-xs text-[rgb(var(--text-secondary))] mt-0.5">{item.detail}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function OfflineSyncVisual({
  data,
}: {
  data: WebsiteDictionary['home']['differentiators']['offlineAttendance'];
}) {
  return (
    <div className="surface rounded-xl p-6 sm:p-7 space-y-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[rgb(var(--border-base))]">
        <h4 className="text-sm font-semibold text-[rgb(var(--text-primary))]">{data.visualTitle}</h4>
        <Smartphone className="w-5 h-5 text-primary-600 shrink-0" aria-hidden="true" />
      </div>
      <div className="space-y-3">
        {data.visualSteps.map((step) => (
          <div
            key={step.title}
            className="flex items-start gap-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))]/60 p-3.5"
          >
            <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-[rgb(var(--text-primary))]">{step.title}</p>
              <p className="text-xs text-[rgb(var(--text-secondary))] mt-0.5">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PayrollRulesVisual({
  data,
}: {
  data: WebsiteDictionary['home']['differentiators']['payrollEngine'];
}) {
  return (
    <div className="surface rounded-xl p-6 sm:p-7 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[rgb(var(--border-base))]">
        <h4 className="text-sm font-semibold text-[rgb(var(--text-primary))]">{data.visualTitle}</h4>
        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-2xs font-semibold bg-warning-50 text-warning-700 border border-warning-200">
          {data.visualBadgeComingSoon}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-success-200 bg-success-50/40 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-success-700">
            {data.visualEarningsLabel}
          </p>
          <ul className="space-y-1.5 text-xs text-[rgb(var(--text-primary))]">
            {data.visualEarnings.map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="font-mono text-success-700 font-bold">+</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-secondary-200 bg-secondary-50/70 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-secondary-700">
            {data.visualDeductionsLabel}
          </p>
          <ul className="space-y-1.5 text-xs text-[rgb(var(--text-primary))]">
            {data.visualDeductions.map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="font-mono text-secondary-700 font-bold">&minus;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function AuditLogVisual({
  data,
}: {
  data: WebsiteDictionary['home']['differentiators']['auditTrail'];
}) {
  return (
    <div className="surface rounded-xl p-6 sm:p-7 space-y-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[rgb(var(--border-base))]">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary-600" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-[rgb(var(--text-primary))]">{data.visualTitle}</h4>
        </div>
        <ShieldCheck className="w-5 h-5 text-success-600 shrink-0" aria-hidden="true" />
      </div>
      <dl className="divide-y divide-[rgb(var(--border-base))] rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))]/50">
        {data.visualRows.map((row) => (
          <div key={row.field} className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 text-xs">
            <dt className="font-semibold text-[rgb(var(--text-muted))]">{row.field}</dt>
            <dd className="sm:col-span-2 font-mono text-[rgb(var(--text-primary))]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
