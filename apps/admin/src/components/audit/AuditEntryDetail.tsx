import { useMemo, useState } from 'react';
import { History, ShieldCheck } from 'lucide-react';
import type { AuditLogEntry } from '@hrm/shared-types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SidePanel } from '@/components/ui/SidePanel';
import { auditCopy } from '@/lib/audit-copy';
import {
  actorLabel,
  diffAuditValues,
  formatAuditTimestamp,
  formatAuditValue,
  humanizeKey,
  type FieldChangeKind,
} from '@/lib/audit-log';
import { auditActionTone } from './audit-tones';

const changeRowTone: Record<FieldChangeKind, string> = {
  changed: 'bg-warning-50/60 dark:bg-warning-950/20',
  added: 'bg-success-50/60 dark:bg-success-950/20',
  removed: 'bg-error-50/60 dark:bg-error-950/20',
  unchanged: '',
};

interface AuditEntryDetailProps {
  entry: AuditLogEntry | null;
  onClose: () => void;
  onShowRecordHistory: (recordId: string) => void;
}

export function AuditEntryDetail({ entry, onClose, onShowRecordHistory }: AuditEntryDetailProps) {
  const copy = auditCopy.detail;
  const [showUnchanged, setShowUnchanged] = useState(false);

  const changes = useMemo(() => (entry ? diffAuditValues(entry) : []), [entry]);
  const unchangedCount = changes.filter((c) => c.kind === 'unchanged').length;
  const visibleChanges = showUnchanged ? changes : changes.filter((c) => c.kind !== 'unchanged');

  if (!entry) return null;

  const meta: { label: string; value: string; mono?: boolean }[] = [
    { label: copy.when, value: formatAuditTimestamp(entry.createdAt) },
    {
      label: copy.user,
      value: [actorLabel(entry.actor, auditCopy.unknownUser), entry.actor.name ? entry.actor.email : null]
        .filter(Boolean)
        .join(' · '),
    },
    { label: copy.module, value: humanizeKey(entry.module) },
    { label: copy.recordId, value: entry.recordId, mono: true },
    { label: copy.ipAddress, value: entry.ipAddress ?? copy.notRecorded, mono: Boolean(entry.ipAddress) },
    { label: copy.device, value: entry.device ?? copy.notRecorded },
  ];

  return (
    <SidePanel
      open
      size="lg"
      onClose={onClose}
      title={copy.title}
      description={`${auditCopy.actions[entry.action]} · ${humanizeKey(entry.module)}`}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="secondary" size="sm" onClick={() => onShowRecordHistory(entry.recordId)}>
            <History className="h-4 w-4" /> {copy.recordHistory}
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            {copy.close}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Badge tone={auditActionTone[entry.action]} dot>
            {auditCopy.actions[entry.action]}
          </Badge>
        </div>

        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
          {meta.map((item) => (
            <div key={item.label} className="contents">
              <dt className="text-xs font-medium text-muted sm:pt-0.5">{item.label}</dt>
              <dd className={`break-all text-sm text-primary ${item.mono ? 'font-mono text-xs sm:pt-0.5' : ''}`}>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="audit-changes" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 id="audit-changes" className="text-xs font-semibold uppercase tracking-wide text-muted">
              {copy.changes}
            </h3>
            {unchangedCount > 0 && (
              <button
                type="button"
                onClick={() => setShowUnchanged((v) => !v)}
                className="text-xs font-medium text-accent-600 hover:underline dark:text-accent-300"
              >
                {showUnchanged ? copy.hideUnchanged : copy.showUnchanged(unchangedCount)}
              </button>
            )}
          </div>

          {changes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-base px-4 py-6 text-center text-sm text-muted">
              {copy.noValues}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-base">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))] text-left text-xs font-semibold uppercase text-secondary">
                    <th className="w-[30%] px-3 py-2">{copy.field}</th>
                    <th className="px-3 py-2">{copy.before}</th>
                    <th className="px-3 py-2">{copy.after}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {visibleChanges.map((change) => (
                    <tr key={change.key} className={changeRowTone[change.kind]}>
                      <td className="px-3 py-2 align-top">
                        <div className="text-primary">{humanizeKey(change.key)}</div>
                        <div className="truncate font-mono text-[11px] text-muted">{change.key}</div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <pre className={`whitespace-pre-wrap break-words font-sans text-xs ${change.kind === 'changed' || change.kind === 'removed' ? 'text-error-700 line-through decoration-error-400/60 dark:text-error-300' : 'text-secondary'}`}>
                          {formatAuditValue(change.before, copy.empty)}
                        </pre>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <pre className={`whitespace-pre-wrap break-words font-sans text-xs ${change.kind === 'changed' || change.kind === 'added' ? 'font-medium text-success-700 dark:text-success-300' : 'text-secondary'}`}>
                          {formatAuditValue(change.after, copy.empty)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <ShieldCheck className="h-3.5 w-3.5" /> {copy.redactedNote}
          </p>
        </section>
      </div>
    </SidePanel>
  );
}
