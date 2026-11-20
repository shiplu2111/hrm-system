import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Clock,
  HelpCircle,
  Info,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  supportWorkflowStatus,
  type SupportTicketDetail,
  type SupportTicketPriority,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { StatusPill } from '@/components/ui/StatusPill';
import { addSupportTicketMessage, getSupportTicket } from '@/lib/support-api';
import {
  SUPPORT_PRIORITY_TONES,
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_WORKFLOW_DISPLAY,
} from '@/lib/support-labels';
import { ApiError } from '@/lib/tenant-api-client';
import { formatDateTime, formatRelative } from '@/lib/webhooks-display';

interface SupportTicketDetailModalProps {
  ticketId: string | null;
  open: boolean;
  onClose: () => void;
  onTicketUpdated?: () => void;
}

export function SupportTicketDetailModal({
  ticketId,
  open,
  onClose,
  onTicketUpdated,
}: SupportTicketDetailModalProps) {
  const { t } = useAppTranslation();
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !ticketId) {
      setTicket(null);
      setError(null);
      setReply('');
      setReplyError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getSupportTicket(ticketId)
      .then((data) => {
        if (active) {
          setTicket(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof ApiError ? err.message : t('errors.loadHelp'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, ticketId, t]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticket || !reply.trim() || sending) return;

    setSending(true);
    setReplyError(null);

    try {
      const updated = await addSupportTicketMessage(ticket.id, {
        body: reply.trim(),
      });
      setTicket(updated);
      setReply('');
      onTicketUpdated?.();
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      setReplyError(err instanceof ApiError ? err.message : t('errors.sendReply'));
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const workflow = ticket ? supportWorkflowStatus(ticket.status) : 'open';
  const workflowDisplay = SUPPORT_WORKFLOW_DISPLAY[workflow];
  const isResolved = workflow === 'resolved';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ticket ? `${ticket.ticketNumber} · ${ticket.subject}` : t('support.ticketDetails')}
      size="xl"
    >
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 p-4 text-center text-sm text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
          <AlertCircle className="mx-auto mb-2 h-6 w-6" />
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={onClose} className="mt-3">
            {t('common.close')}
          </Button>
        </div>
      ) : ticket ? (
        <div className="space-y-4">
          {/* Header Info */}
          <div className="rounded-lg border border-base bg-[rgb(var(--bg-surface-raised,_var(--bg-surface))] p-4 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-muted">
                {ticket.ticketNumber}
              </span>
              <StatusPill tone={SUPPORT_PRIORITY_TONES[ticket.priority]}>
                {t(`support.ticketPriority.${ticket.priority}`)}
              </StatusPill>
              <StatusPill tone={workflowDisplay.tone}>
                {t(`support.ticketStatus.${workflow}`)}
              </StatusPill>
            </div>
            <h3 className="text-base font-semibold text-primary">{ticket.subject}</h3>
            <div className="mt-2.5 flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted" />
                <span>
                  {t('support.created')}:{' '}
                  <span className="font-medium text-primary">
                    {formatDateTime(ticket.createdAt)}
                  </span>
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-muted" />
                <span>
                  {t('support.assignedTo')}:{' '}
                  <span className="font-medium text-primary">
                    {ticket.assigneeName || t('support.unassignedStaff')}
                  </span>
                </span>
              </span>

              {ticket.resolvedAt && (
                <span className="inline-flex items-center gap-1.5 text-success-700 dark:text-success-400">
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>
                    {t('support.resolved')}:{' '}
                    <span className="font-medium">
                      {formatDateTime(ticket.resolvedAt)}
                    </span>
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Conversation History */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t('support.conversation')}
            </h4>

            <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
              {/* Initial Request by Employee */}
              <div className="rounded-lg border border-base bg-[rgb(var(--bg-surface))] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-base pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      <User className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-semibold text-primary">
                      {ticket.requesterName || t('support.you')}
                    </span>
                    <Badge tone="neutral" className="text-[10px]">
                      {t('support.originalInquiry')}
                    </Badge>
                  </div>
                  <span
                    className="text-[11px] text-muted"
                    title={formatDateTime(ticket.createdAt)}
                  >
                    {formatRelative(ticket.createdAt)}
                  </span>
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-primary">
                  {ticket.description}
                </div>
              </div>

              {/* Follow-up messages (requester & staff) */}
              {ticket.messages.map((msg) => {
                const isStaff = Boolean(msg.fromStaff);
                return (
                  <div
                    key={msg.id}
                    className={`rounded-lg border p-4 shadow-sm transition-colors ${
                      isStaff
                        ? 'border-accent-200 bg-accent-50/60 dark:border-accent-800/60 dark:bg-accent-950/20'
                        : 'border-base bg-[rgb(var(--bg-surface))]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-base/70 pb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full ${
                            isStaff
                              ? 'bg-accent-600 text-white'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {isStaff ? (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          ) : (
                            <User className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span className="text-xs font-semibold text-primary">
                          {isStaff
                            ? msg.authorName || t('support.staffResponse')
                            : msg.authorName || t('support.you')}
                        </span>
                        {isStaff ? (
                          <Badge tone="accent" className="text-[10px]">
                            {t('support.staffResponse')}
                          </Badge>
                        ) : (
                          <Badge tone="neutral" className="text-[10px]">
                            {t('support.you')}
                          </Badge>
                        )}
                      </div>
                      <span
                        className="text-[11px] text-muted"
                        title={formatDateTime(msg.createdAt)}
                      >
                        {formatRelative(msg.createdAt)}
                      </span>
                    </div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-primary">
                      {msg.body}
                    </div>
                  </div>
                );
              })}

              {ticket.messages.length === 0 && (
                <div className="rounded-lg border border-dashed border-base p-4 text-center text-xs text-muted">
                  {t('support.noRepliesYet')}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Resolved warning notice */}
          {isResolved && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/80 dark:bg-amber-950/30 dark:text-amber-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">{t('support.resolvedNotice')}</p>
                <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                  {t('support.reopenNotice')}
                </p>
              </div>
            </div>
          )}

          {/* Reply Form */}
          <form onSubmit={(e) => void handleSendReply(e)} className="space-y-3 pt-1">
            {replyError && (
              <div className="rounded-lg border border-error-200 bg-error-50 p-2 text-xs text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
                {replyError}
              </div>
            )}

            <div>
              <Textarea
                rows={3}
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value);
                  if (replyError) setReplyError(null);
                }}
                placeholder={t('support.typeReplyPlaceholder')}
                disabled={sending}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">
                {isResolved ? (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <RotateCcw className="h-3 w-3" />
                    {t('support.reopenNotice')}
                  </span>
                ) : null}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={sending}
                >
                  {t('common.close')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={sending || !reply.trim()}
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t('support.sendingReply')}
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      {t('support.sendReply')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </Modal>
  );
}
