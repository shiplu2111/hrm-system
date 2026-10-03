import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { SubscriptionPlanTier, TenantSubscriptionView } from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Label, Textarea } from '@/components/ui/Form';
import { billingCopy as copy, planName } from '@/lib/billing-copy';
import { employeeUsage, isAtLimit } from '@/lib/plan-usage';
import { createSupportTicket } from '@/lib/support-api';
import { ApiError } from '@/lib/tenant-api-client';

interface Props {
  open: boolean;
  onClose: () => void;
  view: TenantSubscriptionView;
  targetPlanId: SubscriptionPlanTier;
  /** Explain that the employee limit is why this opened, e.g. in place of the Add Employee form. */
  showLimitNotice?: boolean;
}

function usageText(view: TenantSubscriptionView): string {
  const metric = employeeUsage(view);
  if (!metric) return '—';
  return metric.limit === null ? copy.usedUnlimited(metric.used) : copy.usageOf(metric.used, metric.limit);
}

export function UpgradeRequestModal({ open, onClose, view, targetPlanId, showLimitNotice = false }: Props) {
  const canRequest = usePermission('support', 'create');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNote('');
    setError(null);
    setTicketNumber(null);
  }, [open, targetPlanId]);

  const from = planName(view.planId);
  const to = planName(targetPlanId);
  const usage = usageText(view);
  const metric = employeeUsage(view);
  const atLimit = isAtLimit(metric?.level ?? 'ok');
  const limitNotice =
    showLimitNotice && atLimit && metric?.limit != null
      ? metric.level === 'reached'
        ? copy.prompt.reachedBody(metric.limit, from)
        : copy.prompt.exceededBody(metric.used, metric.limit, from)
      : null;

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      const ticket = await createSupportTicket({
        subject: copy.request.subject(from, to),
        description: copy.request.ticketBody({ from, to, usage, note: note.trim() }),
        priority: atLimit ? 'high' : 'medium',
      });
      setTicketNumber(ticket.ticketNumber);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.request.failed);
    } finally {
      setSending(false);
    }
  };

  const footer = ticketNumber || !canRequest ? (
    <Button variant="secondary" onClick={onClose}>
      {copy.request.close}
    </Button>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose} disabled={sending}>
        {copy.request.cancel}
      </Button>
      <Button variant="primary" onClick={() => void submit()} disabled={sending}>
        {sending ? copy.request.sending : copy.request.submit}
      </Button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title={copy.request.title(to)} size="sm" footer={footer}>
      {ticketNumber ? (
        <p role="status" className="flex items-start gap-2 text-sm text-success-700 dark:text-success-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          {copy.request.sent(ticketNumber)}
        </p>
      ) : (
        <div className="space-y-4">
          {limitNotice ? (
            <p className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              {limitNotice}
            </p>
          ) : null}
          <p className="text-sm text-secondary">{copy.request.body}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">{copy.request.current}</dt>
            <dd className="text-primary font-medium">{from}</dd>
            <dt className="text-muted">{copy.request.requested}</dt>
            <dd className="text-primary font-medium">{to}</dd>
            <dt className="text-muted">{copy.request.usage}</dt>
            <dd className="text-primary font-medium">{usage}</dd>
          </dl>
          {canRequest ? (
            <div>
              <Label htmlFor="upgrade-note">{copy.request.noteLabel}</Label>
              <Textarea
                id="upgrade-note"
                rows={3}
                value={note}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
                placeholder={copy.request.notePlaceholder}
              />
            </div>
          ) : (
            <p className="flex items-start gap-2 text-sm text-secondary">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted" aria-hidden />
              {copy.request.noPermission}
            </p>
          )}
          {error ? <p className="text-sm text-error-600">{error}</p> : null}
        </div>
      )}
    </Modal>
  );
}
