import type { AuditLogAction } from '@hrm/shared-types';

/**
 * User-facing strings for the audit log viewer.
 * Kept in one catalogue so they can move into the i18n layer without touching components.
 */
export const auditCopy = {
  title: 'Audit log',
  description:
    'Every recorded change in your workspace — who did what, to which record, and when. Entries cannot be edited or deleted.',
  loadError: 'Could not load the audit log.',
  filtersError: 'Filter options could not be loaded; you can still filter by record ID and date.',
  noTenant: 'The audit log is only available inside a company workspace.',
  noAccessTitle: 'You don’t have access to the audit log',
  noAccessDescription:
    'Audit history is limited to HR Admins, Payroll Admins and Company Owners. Ask one of them if you need a record checked.',

  filters: {
    module: 'Module',
    allModules: 'All modules',
    user: 'User',
    allUsers: 'All users',
    action: 'Action',
    allActions: 'All actions',
    recordId: 'Record ID',
    recordIdPlaceholder: 'Paste a record ID',
    recordIdInvalid: 'Enter a full record ID (UUID).',
    from: 'From',
    to: 'To',
    rangeInvalid: '“From” must be on or before “To”.',
    quickRanges: 'Quick date ranges',
    clear: 'Clear filters',
    removeFilter: (label: string) => `Remove filter ${label}`,
    presets: {
      today: 'Today',
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
      '90d': 'Last 90 days',
    },
  },

  actions: {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    approve: 'Approved',
    finalize: 'Finalized',
    reject: 'Rejected',
    suspend: 'Suspended',
    restore: 'Restored',
  } satisfies Record<AuditLogAction, string>,

  columns: {
    time: 'When',
    user: 'User',
    action: 'Action',
    module: 'Module',
    record: 'Record',
    changes: 'Changes',
  },

  unknownUser: 'Unknown user',
  filterByUser: (name: string) => `Show only entries by ${name}`,
  filterByRecord: 'Show this record’s full history',
  copyRecordId: 'Copy record ID',
  copied: 'Copied',
  viewDetails: 'View details',
  changeSummary: (n: number) => (n === 0 ? 'No field changes' : `${n} field${n === 1 ? '' : 's'} changed`),
  createdSummary: (n: number) => `${n} field${n === 1 ? '' : 's'} recorded`,
  deletedSummary: 'Record removed',

  emptyTitle: 'No audit entries yet',
  emptyDescription: 'Changes to employees, payroll, leave, settings and roles will appear here as they happen.',
  noMatchesTitle: 'No entries match these filters',
  noMatchesDescription: 'Try a wider date range or remove a filter.',

  detail: {
    title: 'Audit entry',
    when: 'When',
    user: 'User',
    action: 'Action',
    module: 'Module',
    recordId: 'Record ID',
    ipAddress: 'IP address',
    device: 'Device',
    notRecorded: 'Not recorded',
    changes: 'Changes',
    field: 'Field',
    before: 'Before',
    after: 'After',
    showUnchanged: (n: number) => `Show ${n} unchanged field${n === 1 ? '' : 's'}`,
    hideUnchanged: 'Hide unchanged fields',
    noValues: 'No field values were recorded for this entry.',
    empty: '—',
    redactedNote: 'Passwords and secrets are hidden; bank, tax and ID numbers are masked.',
    recordHistory: 'Show full history of this record',
    close: 'Close',
  },
};
