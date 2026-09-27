import type { LifecycleEventRecord, LifecycleEventType } from '@hrm/shared-types';
import {
  TrendingUp,
  ArrowRightLeft,
  DollarSign,
  CheckCircle2,
  Ban,
  LogOut,
  RotateCcw,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import type { TimelineItem, TimelineTone } from '@/components/ui/Timeline';

const EVENT_LABELS: Record<LifecycleEventType, string> = {
  promotion: 'Promotion',
  transfer: 'Transfer',
  salary_revision: 'Salary revision',
  probation: 'Probation update',
  confirmation: 'Confirmation',
  suspension: 'Suspension',
  resignation: 'Resignation',
  termination: 'Termination',
  rehire: 'Rehire',
  performance_review: 'Performance review',
};

const EVENT_ICONS: Record<LifecycleEventType, LucideIcon> = {
  promotion: TrendingUp,
  transfer: ArrowRightLeft,
  salary_revision: DollarSign,
  probation: CheckCircle2,
  confirmation: CheckCircle2,
  suspension: Ban,
  resignation: LogOut,
  termination: LogOut,
  rehire: RotateCcw,
  performance_review: ClipboardList,
};

const EVENT_TONES: Record<LifecycleEventType, TimelineTone> = {
  promotion: 'success',
  transfer: 'accent',
  salary_revision: 'accent',
  probation: 'warning',
  confirmation: 'success',
  suspension: 'warning',
  resignation: 'neutral',
  termination: 'error',
  rehire: 'success',
  performance_review: 'accent',
};

function summarizeDetails(event: LifecycleEventRecord): string {
  const d = event.details;
  if (typeof d.notes === 'string' && d.notes.trim()) {
    return d.notes.trim();
  }

  switch (event.eventType) {
    case 'salary_revision':
      if (d.previousAmount != null && d.newAmount != null) {
        return `Adjusted from ${d.previousAmount} to ${d.newAmount}${d.currency ? ` ${d.currency}` : ''}`;
      }
      break;
    case 'suspension':
    case 'termination':
    case 'resignation':
      if (typeof d.reason === 'string' && d.reason) return d.reason;
      break;
    case 'probation':
      if (typeof d.newProbationEndDate === 'string') {
        return `Probation extended to ${d.newProbationEndDate}`;
      }
      break;
    case 'confirmation':
      if (typeof d.confirmationDate === 'string') {
        return `Confirmed on ${d.confirmationDate}`;
      }
      break;
    case 'rehire':
      if (typeof d.newHireDate === 'string') {
        return `Rehired effective ${d.newHireDate}`;
      }
      break;
    default:
      break;
  }

  return 'Recorded in employee history';
}

export function lifecycleEventsToTimelineItems(
  events: LifecycleEventRecord[],
): TimelineItem[] {
  return [...events]
    .sort((a, b) => {
      const dateCmp = a.effectiveDate.localeCompare(b.effectiveDate);
      if (dateCmp !== 0) return dateCmp;
      return a.createdAt.localeCompare(b.createdAt);
    })
    .map((event) => ({
      id: event.id,
      title: EVENT_LABELS[event.eventType] ?? event.eventType,
      subtitle: summarizeDetails(event),
      date: event.effectiveDate,
      meta: `Recorded ${new Date(event.createdAt).toLocaleDateString()}`,
      tone: EVENT_TONES[event.eventType] ?? 'neutral',
      icon: EVENT_ICONS[event.eventType],
    }));
}

export { EVENT_LABELS };
