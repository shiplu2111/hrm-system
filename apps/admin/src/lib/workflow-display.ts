import { WORKFLOW_ROUTING_MODES, type WorkflowDefinitionRecord } from '@hrm/shared-types';
import type { StatusPillTone } from '@/components/ui/StatusPill';
import { formatDate } from './payroll-copy';
import { WORKFLOW_MODULES, amountComparisonText, moduleRoutingText } from './workflow-api';

export interface WorkflowStatusDisplay {
  label: string;
  tone: StatusPillTone;
  /** Why new requests do or don't follow this workflow. */
  detail: string;
}

export function workflowStatusDisplay(record: WorkflowDefinitionRecord): WorkflowStatusDisplay {
  const module = WORKFLOW_MODULES[record.entityType];
  const amountTrigger =
    record.triggerConfig?.type === 'amount_threshold' && record.triggerConfig.value != null
      ? record.triggerConfig
      : null;
  const amountMatch = WORKFLOW_ROUTING_MODES[record.entityType] === 'amount_match';

  switch (record.routingStatus) {
    case 'in_use':
      return {
        label: 'In use',
        tone: 'success',
        detail: amountTrigger
          ? `New claims ${amountComparisonText(amountTrigger.operator, amountTrigger.value ?? 0)} follow this workflow, unless a higher amount workflow also matches.`
          : amountMatch
            ? 'New claims that no amount workflow matches follow this workflow.'
            : `New ${module.requests} follow this workflow.`,
      };
    case 'inactive':
      return { label: 'Off', tone: 'neutral', detail: "Turned off, so new requests don't use it." };
    case 'scheduled':
      return {
        label: 'Scheduled',
        tone: 'accent',
        detail: `Starts applying on ${formatDate(record.effectiveFrom)}.`,
      };
    case 'ended':
      return {
        label: 'Ended',
        tone: 'neutral',
        detail: `Stopped applying after ${formatDate(record.effectiveTo)}.`,
      };
    case 'not_default':
      return {
        label: 'Not used',
        tone: 'warning',
        detail: `Only the default workflow is used for ${module.requests}. Make this the default to use it.`,
      };
    case 'overridden': {
      const other = record.routingOverriddenBy?.name ?? 'Another workflow';
      return {
        label: 'Not used',
        tone: 'warning',
        detail: amountTrigger
          ? `${other} has the same amount trigger and takes priority.`
          : amountMatch
            ? `${other} is the default, so claims that no amount workflow matches follow it instead.`
            : `${other} is used instead.`,
      };
    }
    default:
      return { label: 'Not applied', tone: 'neutral', detail: moduleRoutingText(record.entityType) };
  }
}

export function usageText(record: WorkflowDefinitionRecord): string {
  if (record.instanceCount === 0) return 'Not used yet';
  const total = `${record.instanceCount} request${record.instanceCount === 1 ? '' : 's'}`;
  return record.pendingInstanceCount > 0 ? `${total} · ${record.pendingInstanceCount} pending` : total;
}
