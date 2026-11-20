import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Clock,
  FilterX,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import {
  supportWorkflowStatus,
  type SupportTicketPriority,
  type SupportTicketRecord,
  type SupportWorkflowStatus,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { SummaryTile } from '@/components/ui/SummaryTile';
import {
  SUPPORT_PRIORITY_TONES,
  SUPPORT_WORKFLOW_DISPLAY,
} from '@/lib/support-labels';
import { formatDateTime, formatRelative } from '@/lib/webhooks-display';

type StatusFilter = 'all' | SupportWorkflowStatus;
type PriorityFilter = 'all' | SupportTicketPriority;

const PRIORITIES: SupportTicketPriority[] = ['low', 'medium', 'high', 'urgent'];

interface MySupportTicketsTabProps {
  tickets: SupportTicketRecord[];
  loading: boolean;
  onOpenNewTicket: () => void;
  onSelectTicket: (ticketId: string) => void;
  selectedTicketId: string | null;
}

export function MySupportTicketsTab({
  tickets,
  loading,
  onOpenNewTicket,
  onSelectTicket,
  selectedTicketId,
}: MySupportTicketsTabProps) {
  const { t } = useAppTranslation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');

  // KPI counts
  const counts = useMemo(() => {
    let open = 0;
    let inProgress = 0;
    let resolved = 0;

    for (const ticket of tickets) {
      const st = supportWorkflowStatus(ticket.status);
      if (st === 'open') open += 1;
      else if (st === 'in_progress') inProgress += 1;
      else if (st === 'resolved') resolved += 1;
    }

    return {
      total: tickets.length,
      open,
      inProgress,
      resolved,
    };
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const st = supportWorkflowStatus(ticket.status);
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;
      if (q) {
        const matchNumber = ticket.ticketNumber.toLowerCase().includes(q);
        const matchSubject = ticket.subject.toLowerCase().includes(q);
        const matchDesc = ticket.description.toLowerCase().includes(q);
        if (!matchNumber && !matchSubject && !matchDesc) return false;
      }
      return true;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  const hasActiveFilters = search.trim() !== '' || statusFilter !== 'all' || priorityFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <SummaryTile
          label={t('support.summaryTotal')}
          value={String(counts.total)}
          hint={t('support.allTicketsHint')}
          tone="neutral"
          icon={<Ticket className="h-5 w-5" />}
          onClick={() => setStatusFilter('all')}
        />

        <SummaryTile
          label={t('support.summaryOpen')}
          value={String(counts.open)}
          hint={t('support.openTicketsHint')}
          tone="accent"
          icon={<AlertCircle className="h-5 w-5" />}
          onClick={() => setStatusFilter(statusFilter === 'open' ? 'all' : 'open')}
        />

        <SummaryTile
          label={t('support.summaryInProgress')}
          value={String(counts.inProgress)}
          hint={t('support.inProgressTicketsHint')}
          tone="warning"
          icon={<Clock className="h-5 w-5" />}
          onClick={() =>
            setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')
          }
        />

        <SummaryTile
          label={t('support.summaryResolved')}
          value={String(counts.resolved)}
          hint={t('support.resolvedTicketsHint')}
          tone="success"
          icon={<RotateCcw className="h-5 w-5" />}
          onClick={() =>
            setStatusFilter(statusFilter === 'resolved' ? 'all' : 'resolved')
          }
        />
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('support.searchTicketsPlaceholder')}
              className="pl-9"
            />
          </div>

          <div className="w-36">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label={t('support.allStatuses')}
            >
              <option value="all">{t('support.allStatuses')}</option>
              <option value="open">{t('support.ticketStatus.open')}</option>
              <option value="in_progress">{t('support.ticketStatus.in_progress')}</option>
              <option value="resolved">{t('support.ticketStatus.resolved')}</option>
            </Select>
          </div>

          <div className="w-36">
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
              aria-label={t('support.allPriorities')}
            >
              <option value="all">{t('support.allPriorities')}</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`support.ticketPriority.${p}`)}
                </option>
              ))}
            </Select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs text-muted hover:text-primary"
            >
              <FilterX className="h-3.5 w-3.5" />
              {t('common.clear')}
            </Button>
          )}
        </div>

        <Button
          variant="primary"
          onClick={onOpenNewTicket}
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
          {t('support.newTicket')}
        </Button>
      </div>

      {/* Ticket List */}
      <div className="space-y-3">
        {filteredTickets.map((ticket) => {
          const workflow = supportWorkflowStatus(ticket.status);
          const workflowDisplay = SUPPORT_WORKFLOW_DISPLAY[workflow];
          const isSelected = ticket.id === selectedTicketId;

          return (
            <Card
              key={ticket.id}
              className={`transition-all hover:border-accent-300 dark:hover:border-accent-700 ${
                isSelected ? 'ring-2 ring-accent-500' : ''
              }`}
            >
              <CardBody className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
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

                    <button
                      type="button"
                      onClick={() => onSelectTicket(ticket.id)}
                      className="text-left text-sm font-semibold text-primary hover:text-accent-600 focus:outline-none dark:hover:text-accent-400"
                    >
                      {ticket.subject}
                    </button>

                    <p className="line-clamp-2 text-xs leading-relaxed text-secondary">
                      {ticket.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 pt-1 text-[11px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {t('support.created')}:{' '}
                          <span title={formatDateTime(ticket.createdAt)}>
                            {formatRelative(ticket.createdAt)}
                          </span>
                        </span>
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        <span>
                          {t('support.assignedTo')}:{' '}
                          <span className="font-medium text-secondary">
                            {ticket.assigneeName || t('support.unassignedStaff')}
                          </span>
                        </span>
                      </span>

                      {typeof ticket.messageCount === 'number' && (
                        <span className="inline-flex items-center gap-1 text-accent-600 dark:text-accent-400">
                          <MessageSquare className="h-3 w-3" />
                          <span>
                            {t(ticket.messageCount === 1 ? 'support.repliesCount' : 'support.repliesCount_other', {
                              count: ticket.messageCount,
                            })}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 pt-1 sm:pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectTicket(ticket.id)}
                      className="w-full sm:w-auto"
                    >
                      {t('support.viewTicket')}
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}

        {filteredTickets.length === 0 && !loading && (
          tickets.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title={t('support.emptyTicketsTitle')}
              description={t('support.emptyTicketsDesc')}
              action={{
                label: t('support.openNewTicket'),
                onClick: onOpenNewTicket,
                icon: Plus,
              }}
            />
          ) : (
            <EmptyState
              icon={Search}
              title={t('support.noTicketsMatching')}
              action={{
                label: t('common.clear'),
                onClick: clearFilters,
                icon: FilterX,
              }}
            />
          )
        )}
      </div>
    </div>
  );
}
