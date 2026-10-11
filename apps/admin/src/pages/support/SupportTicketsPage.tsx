import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Inbox,
  Loader2,
  Lock,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  UserRound,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import {
  SUPPORT_WORKFLOW_STATUSES,
  supportNextStatuses,
  supportWorkflowStatus,
  type SupportAgent,
  type SupportQueueAssigneeFilter,
  type SupportQueueList,
  type SupportTicketDetail,
  type SupportTicketPriority,
  type SupportTicketRecord,
  type SupportWorkflowStatus,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  addSupportTicketMessage,
  getSupportTicket,
  listSupportAgents,
  listSupportQueue,
  updateSupportTicket,
} from '@/lib/support-api';
import {
  SUPPORT_PRIORITY_TONES,
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TRANSITION_LABELS,
  SUPPORT_WORKFLOW_DISPLAY,
} from '@/lib/support-labels';
import { ApiError } from '@/lib/tenant-api-client';
import { formatDateTime, formatRelative } from '@/lib/webhooks-display';

type StatusTab = SupportWorkflowStatus | 'all';

const PRIORITIES: SupportTicketPriority[] = ['urgent', 'high', 'medium', 'low'];
const PAGE_SIZE_OPTIONS = [10, 25, 50];

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function SupportTicketsPage() {
  const { can } = usePermissions();
  const canEdit = can('support', 'edit');
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('ticket');

  const [status, setStatus] = useState<StatusTab>('open');
  const [priority, setPriority] = useState<SupportTicketPriority | ''>('');
  const [assignee, setAssignee] = useState<SupportQueueAssigneeFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [queue, setQueue] = useState<SupportQueueList | null>(null);
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadQueue = useCallback(async () => {
    setError(null);
    try {
      setQueue(
        await listSupportQueue({
          status,
          priority: priority || undefined,
          assignee,
          search,
          page,
          pageSize,
        }),
      );
    } catch (err) {
      setError(errorMessage(err, 'Could not load the ticket queue'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, priority, assignee, search, page, pageSize]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!canEdit) return;
    listSupportAgents()
      .then(setAgents)
      .catch(() => setAgents([]));
  }, [canEdit]);

  const selectTicket = (ticketId: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (ticketId) next.set('ticket', ticketId);
    else next.delete('ticket');
    setSearchParams(next, { replace: true });
  };

  const changeStatusTab = (tab: StatusTab) => {
    setStatus(tab);
    setPage(1);
  };

  const counts = queue?.counts ?? { open: 0, in_progress: 0, resolved: 0 };
  const allCount = counts.open + counts.in_progress + counts.resolved;
  const filtersActive = Boolean(priority || assignee !== 'all' || search);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading tickets…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary">Support Tickets</h1>
          <p className="mt-0.5 text-sm text-secondary">
            Help requests raised by admins and employees. Tickets move from Open to In progress when an agent picks
            them up, and to Resolved once answered. A reply from the requester reopens a resolved ticket.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setRefreshing(true);
            void loadQueue();
          }}
          disabled={refreshing}
          className="xl:shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SUPPORT_WORKFLOW_STATUSES.map((value) => (
          <StatusTabCard
            key={value}
            active={status === value}
            label={SUPPORT_WORKFLOW_DISPLAY[value].label}
            hint={SUPPORT_WORKFLOW_DISPLAY[value].hint}
            tone={SUPPORT_WORKFLOW_DISPLAY[value].tone}
            count={counts[value]}
            onClick={() => changeStatusTab(value)}
          />
        ))}
        <StatusTabCard
          active={status === 'all'}
          label="All tickets"
          hint={filtersActive ? 'Matching the current filters' : 'Every ticket in your company'}
          tone="neutral"
          count={allCount}
          onClick={() => changeStatusTab('all')}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section
          className={`surface flex min-w-0 flex-col rounded-xl border border-base shadow-card ${
            selectedId ? 'hidden lg:flex' : ''
          }`}
        >
          <div className="space-y-2 border-b border-base p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search number, subject or requester"
                className="pl-9"
                aria-label="Search tickets"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value as SupportTicketPriority | '');
                  setPage(1);
                }}
                aria-label="Filter by priority"
              >
                <option value="">Any priority</option>
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {SUPPORT_TICKET_PRIORITY_LABELS[value]}
                  </option>
                ))}
              </Select>
              <Select
                value={assignee}
                onChange={(e) => {
                  setAssignee(e.target.value as SupportQueueAssigneeFilter);
                  setPage(1);
                }}
                aria-label="Filter by assignee"
              >
                <option value="all">Anyone</option>
                <option value="me">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
              </Select>
            </div>
          </div>

          {queue && queue.items.length > 0 ? (
            <ul className="flex-1 divide-y divide-[rgb(var(--border-base))]">
              {queue.items.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  selected={ticket.id === selectedId}
                  onSelect={() => selectTicket(ticket.id)}
                />
              ))}
            </ul>
          ) : (
            <div className="flex flex-1 flex-col items-center gap-2 p-10 text-center">
              <Inbox className="h-8 w-8 text-muted" />
              <p className="text-sm text-secondary">
                {filtersActive
                  ? 'No tickets match these filters.'
                  : status === 'open'
                    ? 'No open tickets. The queue is clear.'
                    : 'No tickets here yet.'}
              </p>
            </div>
          )}

          {queue && queue.total > 0 ? (
            <Pagination
              page={queue.page}
              pageSize={queue.pageSize}
              totalItems={queue.total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          ) : null}
        </section>

        <section className={`min-w-0 ${selectedId ? '' : 'hidden lg:block'}`}>
          {selectedId ? (
            <TicketDetailPane
              key={selectedId}
              ticketId={selectedId}
              agents={agents}
              canEdit={canEdit}
              onBack={() => selectTicket(null)}
              onChanged={() => void loadQueue()}
            />
          ) : (
            <div className="surface flex h-full min-h-[320px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-base p-10 text-center">
              <MessageSquare className="h-8 w-8 text-muted" />
              <p className="text-sm text-secondary">Select a ticket to read the conversation and reply.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusTabCard({
  active,
  label,
  hint,
  tone,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  tone: 'neutral' | 'warning' | 'accent' | 'success' | 'error';
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`surface rounded-xl border px-4 py-3 text-left shadow-card transition-colors ${
        active
          ? 'border-accent-500 ring-2 ring-accent-500/20'
          : 'border-base hover:border-accent-300 dark:hover:border-accent-700'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <StatusPill tone={tone}>{label}</StatusPill>
        <span className="text-lg font-semibold tabular-nums text-primary">{count.toLocaleString()}</span>
      </div>
      <p className="mt-1.5 truncate text-xs text-secondary">{hint}</p>
    </button>
  );
}

function TicketRow({
  ticket,
  selected,
  onSelect,
}: {
  ticket: SupportTicketRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const workflow = supportWorkflowStatus(ticket.status);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full px-4 py-3 text-left transition-colors ${
          selected
            ? 'bg-accent-50/70 dark:bg-accent-950/30'
            : 'hover:bg-[rgb(var(--bg-hover))]'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted">{ticket.ticketNumber}</span>
          <div className="flex items-center gap-1.5">
            <StatusPill tone={SUPPORT_PRIORITY_TONES[ticket.priority]}>
              {SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]}
            </StatusPill>
            <StatusPill tone={SUPPORT_WORKFLOW_DISPLAY[workflow].tone}>
              {SUPPORT_WORKFLOW_DISPLAY[workflow].label}
            </StatusPill>
          </div>
        </div>
        <p className="mt-1 truncate text-sm font-medium text-primary">{ticket.subject}</p>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-secondary">
          <span className="truncate">
            {ticket.requesterName ?? 'Unknown requester'} ·{' '}
            {ticket.assigneeName ? (
              <span>{ticket.assigneeName}</span>
            ) : (
              <span className="text-warning-700 dark:text-warning-300">Unassigned</span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-2 text-muted">
            {ticket.messageCount ? (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="h-3 w-3" />
                {ticket.messageCount}
              </span>
            ) : null}
            <span title={formatDateTime(ticket.updatedAt)}>{formatRelative(ticket.updatedAt)}</span>
          </span>
        </div>
      </button>
    </li>
  );
}

function TicketDetailPane({
  ticketId,
  agents,
  canEdit,
  onBack,
  onChanged,
}: {
  ticketId: string;
  agents: SupportAgent[];
  canEdit: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { user } = usePermissions();
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<'reply' | 'internal'>('reply');
  const [reply, setReply] = useState('');
  const [resolveOpen, setResolveOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSupportTicket(ticketId)
      .then((row) => !cancelled && setTicket(row))
      .catch((err) => !cancelled && setError(errorMessage(err, 'Could not load the ticket')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const run = async (key: string, action: () => Promise<SupportTicketDetail>) => {
    setBusy(key);
    setError(null);
    try {
      setTicket(await action());
      onChanged();
      return true;
    } catch (err) {
      setError(errorMessage(err, 'Could not update the ticket'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const assigneeOptions = useMemo(() => {
    if (!ticket?.assignedToUserId || agents.some((a) => a.id === ticket.assignedToUserId)) return agents;
    return [
      ...agents,
      { id: ticket.assignedToUserId, name: ticket.assigneeName ?? 'Former agent', email: '' },
    ];
  }, [agents, ticket?.assignedToUserId, ticket?.assigneeName]);

  if (loading) {
    return (
      <div className="surface flex min-h-[320px] items-center justify-center rounded-xl border border-base text-secondary shadow-card">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading ticket…
      </div>
    );
  }
  if (!ticket) {
    return (
      <div className="surface space-y-3 rounded-xl border border-base p-6 shadow-card">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to queue
        </Button>
        <p className="text-sm text-error-700">{error ?? 'Ticket not found.'}</p>
      </div>
    );
  }

  const workflow = supportWorkflowStatus(ticket.status);
  const nextStatuses = supportNextStatuses(ticket.status).filter((value) => value !== workflow);
  const me = user?.id ?? null;

  const sendMessage = async () => {
    const body = reply.trim();
    if (!body) return;
    const ok = await run('reply', () =>
      addSupportTicketMessage(ticket.id, { body, isInternal: mode === 'internal' }),
    );
    if (ok) setReply('');
  };

  const replyAndResolve = async () => {
    const note = reply.trim();
    if (!note) return;
    const ok = await run('reply-resolve', () =>
      updateSupportTicket(ticket.id, { status: 'resolved', note }),
    );
    if (ok) setReply('');
  };

  return (
    <div className="surface flex flex-col rounded-xl border border-base shadow-card">
      <div className="space-y-3 border-b border-base p-5">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 lg:hidden">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to queue
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted">{ticket.ticketNumber}</p>
            <h2 className="mt-0.5 text-lg font-semibold text-primary">{ticket.subject}</h2>
            <p className="mt-1 text-xs text-secondary">
              Raised by <span className="font-medium text-primary">{ticket.requesterName ?? 'Unknown'}</span>
              {ticket.requesterEmail && ticket.requesterEmail !== ticket.requesterName
                ? ` (${ticket.requesterEmail})`
                : ''}{' '}
              · {formatDateTime(ticket.createdAt)}
            </p>
          </div>
          <StatusPill tone={SUPPORT_PRIORITY_TONES[ticket.priority]}>
            {SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]} priority
          </StatusPill>
        </div>

        <StatusStepper current={workflow} resolvedAt={ticket.resolvedAt} />

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            {nextStatuses.map((value) =>
              value === 'resolved' ? (
                <Button key={value} size="sm" onClick={() => setResolveOpen(true)} disabled={busy !== null}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                </Button>
              ) : (
                <Button
                  key={value}
                  variant={value === 'in_progress' ? (workflow === 'resolved' ? 'outline' : 'primary') : 'outline'}
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void run(value, () => updateSupportTicket(ticket.id, { status: value }))}
                >
                  {workflow === 'resolved' ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" /> Reopen
                    </>
                  ) : (
                    SUPPORT_TRANSITION_LABELS[value]
                  )}
                </Button>
              ),
            )}
            {busy && busy !== 'reply' && busy !== 'reply-resolve' ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted" />
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
            {error}
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <div className="grid gap-3 border-b border-base p-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="ticket-priority">Priority</Label>
            <Select
              id="ticket-priority"
              value={ticket.priority}
              disabled={busy !== null}
              onChange={(e) => {
                const value = e.target.value as SupportTicketPriority;
                void run('priority', () => updateSupportTicket(ticket.id, { priority: value }));
              }}
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {SUPPORT_TICKET_PRIORITY_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="ticket-assignee">Assignee</Label>
              {me && ticket.assignedToUserId !== me && agents.some((a) => a.id === me) ? (
                <button
                  type="button"
                  className="text-xs font-medium text-accent-600 hover:text-accent-700 disabled:opacity-50"
                  disabled={busy !== null}
                  onClick={() =>
                    void run('assignee', () => updateSupportTicket(ticket.id, { assignedToUserId: me }))
                  }
                >
                  Assign to me
                </button>
              ) : null}
            </div>
            <Select
              id="ticket-assignee"
              value={ticket.assignedToUserId ?? ''}
              disabled={busy !== null}
              onChange={(e) => {
                const value = e.target.value || null;
                void run('assignee', () => updateSupportTicket(ticket.id, { assignedToUserId: value }));
              }}
            >
              <option value="">Unassigned</option>
              {assigneeOptions.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                  {agent.id === me ? ' (you)' : ''}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}

      <div className="max-h-[52vh] space-y-3 overflow-y-auto p-5 scrollbar-thin">
        <Message
          authorName={ticket.requesterName ?? 'Requester'}
          role="Requester"
          createdAt={ticket.createdAt}
          body={ticket.description}
        />
        {ticket.messages.map((message) => (
          <Message
            key={message.id}
            authorName={message.authorName ?? (message.fromStaff ? 'Support' : 'Requester')}
            role={message.isInternal ? 'Internal note' : message.fromStaff ? 'Support' : 'Requester'}
            createdAt={message.createdAt}
            body={message.body}
            internal={message.isInternal}
            staff={message.fromStaff}
          />
        ))}
      </div>

      {canEdit ? (
        <div className="space-y-2 border-t border-base p-5">
          <div className="inline-flex rounded-lg border border-base p-0.5">
            {(
              [
                { id: 'reply', label: 'Reply to requester', icon: UserRound },
                { id: 'internal', label: 'Internal note', icon: Lock },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === option.id
                    ? option.id === 'internal'
                      ? 'bg-warning-500 text-white shadow-sm'
                      : 'bg-accent-600 text-white shadow-sm'
                    : 'text-secondary hover:bg-[rgb(var(--bg-hover))]'
                }`}
              >
                <option.icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            ))}
          </div>
          <Textarea
            rows={4}
            maxLength={5000}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={
              mode === 'internal'
                ? 'Only support agents see internal notes.'
                : `Write to ${ticket.requesterName ?? 'the requester'}…`
            }
            className={mode === 'internal' ? 'border-warning-300 bg-warning-50/40 dark:bg-warning-950/10' : ''}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              {mode === 'internal'
                ? 'Internal notes never change the ticket status.'
                : workflow === 'open'
                  ? `Replying moves the ticket to In progress${ticket.assignedToUserId ? '' : ' and assigns it to you'}.`
                  : workflow === 'resolved'
                    ? 'The ticket stays resolved unless the requester replies.'
                    : 'The requester gets an in-app notification.'}
            </p>
            <div className="flex gap-2">
              {mode === 'reply' && workflow !== 'resolved' ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!reply.trim() || busy !== null}
                  onClick={() => void replyAndResolve()}
                >
                  <Check className="h-3.5 w-3.5" />
                  {busy === 'reply-resolve' ? 'Sending…' : 'Reply & resolve'}
                </Button>
              ) : null}
              <Button size="sm" disabled={!reply.trim() || busy !== null} onClick={() => void sendMessage()}>
                {busy === 'reply' ? 'Sending…' : mode === 'internal' ? 'Add note' : 'Send reply'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ResolveModal
        open={resolveOpen}
        ticketNumber={ticket.ticketNumber}
        requesterName={ticket.requesterName ?? 'the requester'}
        onClose={() => setResolveOpen(false)}
        onResolve={async (note) => {
          const ok = await run('resolve', () =>
            updateSupportTicket(ticket.id, { status: 'resolved', note: note || undefined }),
          );
          if (ok) setResolveOpen(false);
        }}
        busy={busy === 'resolve'}
      />
    </div>
  );
}

function StatusStepper({
  current,
  resolvedAt,
}: {
  current: SupportWorkflowStatus;
  resolvedAt: string | null;
}) {
  const currentIndex = SUPPORT_WORKFLOW_STATUSES.indexOf(current);
  return (
    <ol className="flex items-center gap-2" aria-label="Ticket status">
      {SUPPORT_WORKFLOW_STATUSES.map((value, index) => {
        const done = index < currentIndex || (value === 'resolved' && current === 'resolved');
        const active = index === currentIndex;
        return (
          <li key={value} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                done
                  ? 'bg-success-500 text-white'
                  : active
                    ? 'bg-accent-600 text-white ring-4 ring-accent-500/20'
                    : 'bg-[rgb(var(--bg-muted))] text-muted'
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className="min-w-0">
              <span
                className={`block truncate text-xs font-medium ${active ? 'text-primary' : 'text-secondary'}`}
                aria-current={active ? 'step' : undefined}
              >
                {SUPPORT_WORKFLOW_DISPLAY[value].label}
              </span>
              {value === 'resolved' && resolvedAt && current === 'resolved' ? (
                <span className="block truncate text-[11px] text-muted">{formatDateTime(resolvedAt)}</span>
              ) : null}
            </span>
            {index < SUPPORT_WORKFLOW_STATUSES.length - 1 ? (
              <span
                className={`h-px flex-1 ${index < currentIndex ? 'bg-success-400' : 'bg-[rgb(var(--border-base))]'}`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function Message({
  authorName,
  role,
  createdAt,
  body,
  internal = false,
  staff = false,
}: {
  authorName: string;
  role: string;
  createdAt: string;
  body: string;
  internal?: boolean;
  staff?: boolean;
}) {
  const initials = authorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <div className="flex gap-3">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          internal
            ? 'bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-200'
            : staff
              ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-200'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
        }`}
        aria-hidden
      >
        {initials || '?'}
      </span>
      <div
        className={`min-w-0 flex-1 rounded-lg border px-3 py-2 ${
          internal
            ? 'border-warning-200 bg-warning-50/60 dark:border-warning-800 dark:bg-warning-950/20'
            : 'border-base bg-[rgb(var(--bg-muted))]/30'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="font-semibold text-primary">{authorName}</span>
          <span className={internal ? 'inline-flex items-center gap-1 text-warning-700 dark:text-warning-300' : 'text-muted'}>
            {internal ? <Lock className="h-3 w-3" /> : null}
            {role}
          </span>
          <span className="text-muted" title={formatDateTime(createdAt)}>
            · {formatRelative(createdAt)}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-primary">{body}</p>
      </div>
    </div>
  );
}

function ResolveModal({
  open,
  ticketNumber,
  requesterName,
  busy,
  onClose,
  onResolve,
}: {
  open: boolean;
  ticketNumber: string;
  requesterName: string;
  busy: boolean;
  onClose: () => void;
  onResolve: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={`Resolve ${ticketNumber}`}
      description={`${requesterName} is notified. If they reply, the ticket reopens automatically.`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void onResolve(note.trim())} disabled={busy}>
            <CheckCircle2 className="h-4 w-4" /> {busy ? 'Resolving…' : 'Resolve ticket'}
          </Button>
        </>
      }
    >
      <Label htmlFor="resolve-note">Resolution note (optional)</Label>
      <Textarea
        id="resolve-note"
        rows={4}
        maxLength={5000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Explain what was done. This is posted as a reply the requester can see."
      />
    </Modal>
  );
}
