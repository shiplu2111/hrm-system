import type { NotificationChannelKey, NotificationEventType, NotificationRecipientRole } from '@hrm/shared-types';

export type NotificationEventGroup = 'time' | 'approvals' | 'pay' | 'contracts' | 'people' | 'safety';

/**
 * User-facing strings for the notification & SMTP settings screen.
 * Kept in one catalogue so they can move into the i18n layer without touching components.
 */
export const notificationSettingsCopy = {
  title: 'Notifications & email',
  description:
    'Choose how each event reaches people and which email server sends it. Everything here is stored per company and applies to the next notification — no restart or redeploy.',
  tabs: {
    label: 'Notification settings sections',
    events: 'Events & channels',
    smtp: 'Email server (SMTP)',
  },
  selectCompany: 'Select a company to configure notifications.',
  readOnly: 'You can view these settings. Changing them needs the Settings edit permission.',
  lastUpdated: (when: string) => `Last changed ${when}`,
  neverChanged: 'Using the default settings',

  events: {
    loadError: 'Could not load notification settings.',
    retry: 'Try again',
    realtimeTitle: 'Live in-app delivery (WebSocket)',
    realtimeBody:
      'Shows a live toast to people who are online. Every in-app notification is still saved to the notification center, so nothing is lost if this is off or the connection drops.',
    realtimeOff: 'Live delivery is off — in-app notifications appear quietly in the notification center only.',
    channelStatus: 'Channel status',
    inAppStatus: 'Always available',
    emailReady: 'Company SMTP configured',
    emailMissing: 'No company SMTP — emails will fail',
    pushReady: 'Push provider configured',
    pushMissing: 'Push provider not configured — push is skipped',
    configureSmtp: 'Set up SMTP',
    columns: {
      event: 'Event',
      active: 'On',
      inApp: 'In-app',
      live: 'Live toast',
      push: 'Push',
      email: 'Email',
      recipients: 'Who receives it',
    },
    channelHints: {
      inApp: 'Saved to the notification center in the web and mobile apps.',
      live: 'Pops up immediately for people who are online. Needs In-app.',
      push: 'Mobile push notification (Firebase).',
      email: 'Sent through the company SMTP server.',
    } satisfies Record<NotificationChannelKey | 'live', string>,
    toggleEvent: (label: string) => `Send ${label} notifications`,
    toggleChannel: (label: string, channel: string) => `${label}: ${channel}`,
    liveNeedsInApp: 'Turn on In-app to use live toasts.',
    liveMasterOff: 'Live delivery is turned off for the company.',
    eventOff: 'This event is turned off.',
    emailNoSmtp: 'Email is on, but no company SMTP is configured, so these emails will fail.',
    pushNotConfigured: 'Push is on, but no push provider is configured, so push is skipped.',
    noChannel: 'No channel selected — nobody will be notified.',
    modified: 'Changed from default',
    restoreDefaults: 'Restore defaults',
    restoreConfirm: 'Reset every event to its default channels? You can still review before saving.',
    unsaved: (n: number) => `${n} unsaved ${n === 1 ? 'change' : 'changes'}`,
    discard: 'Discard',
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Notification settings saved. They apply to the next notification.',
    effectNote: 'Recipients and wording are fixed per event for now; this screen controls whether and how each event is delivered.',
  },

  smtp: {
    loadError: 'Could not load SMTP settings.',
    title: 'Company email server',
    body:
      'Payslips and notification emails are sent from your own domain through this server. The password is encrypted at rest and never shown again after saving.',
    statusConfigured: 'Configured',
    statusMissing: 'Not configured',
    missingBody:
      'Until this is set up, email notifications and payslip emails for this company can’t be delivered.',
    host: 'SMTP host',
    hostPlaceholder: 'smtp.yourcompany.com',
    port: 'Port',
    security: 'Encryption',
    securityOptions: {
      tls: 'Required',
      none: 'None — not recommended',
    },
    securityHint: (port: number) =>
      port === 465 ? 'Port 465 connects over SSL/TLS.' : 'The connection upgrades with STARTTLS (port 587 is typical).',
    securityNoneHint: 'Credentials and payslips would travel unencrypted.',
    username: 'Username',
    usernamePlaceholder: 'mailer@yourcompany.com',
    password: 'Password or app password',
    passwordSaved: 'Saved',
    passwordReplace: 'Replace',
    passwordKeep: 'Keep saved password',
    passwordPlaceholder: 'Enter the SMTP password',
    passwordReentry: 'Re-enter the password — the saved one is only used with the host and username it was saved for.',
    fromAddress: 'From address',
    fromAddressPlaceholder: 'payroll@yourcompany.com',
    fromName: 'From name',
    fromNamePlaceholder: 'Your Company HR',
    errors: {
      host: 'Enter the SMTP host.',
      port: 'Use a port between 1 and 65535.',
      fromAddress: 'Enter a valid email address.',
      fromName: 'Enter the sender name.',
      password: 'Enter the SMTP password.',
      toEmail: 'Enter a valid email address.',
    },
    save: 'Save SMTP settings',
    saving: 'Saving…',
    discard: 'Discard',
    saved: 'SMTP settings saved. The next email uses them.',
    unsaved: 'Unsaved changes',
    testTitle: 'Send a test email',
    testBody:
      'Checks the server with the values above, including unsaved changes, before you rely on it for payslips.',
    testRecipient: 'Send to',
    testSend: 'Send test email',
    testSending: 'Sending…',
    testSent: (to: string) => `Test email sent to ${to}. Check the inbox (and spam folder).`,
    testUnsavedNote: 'Testing unsaved values — save them once the test succeeds.',
  },

  groups: {
    time: 'Leave & attendance',
    approvals: 'Approvals',
    pay: 'Payroll & expenses',
    contracts: 'Contracts & certifications',
    people: 'People & engagement',
    safety: 'Health & safety',
  } satisfies Record<NotificationEventGroup, string>,

  eventMeta: {
    'leave.approved': { group: 'time', label: 'Leave approved', description: 'A leave request is fully approved.' },
    'leave.rejected': { group: 'time', label: 'Leave rejected', description: 'A leave request is rejected.' },
    'attendance.late': { group: 'time', label: 'Late clock-in', description: 'An employee clocks in after their shift start.' },
    'approval.pending': {
      group: 'approvals',
      label: 'Approval needed',
      description: 'A contract renewal, expense claim or timesheet is waiting on an approver.',
    },
    'payroll.finalized': { group: 'pay', label: 'Payslip ready', description: 'A pay run is finalized and payslips are issued.' },
    'expense.approved': { group: 'pay', label: 'Expense claim approved', description: 'An expense claim is approved for reimbursement.' },
    'expense.rejected': { group: 'pay', label: 'Expense claim rejected', description: 'An expense claim is rejected.' },
    'contract.expiring': { group: 'contracts', label: 'Contract expiring', description: 'An employment contract enters its expiry window.' },
    'contract.renewal.approved': { group: 'contracts', label: 'Contract renewal approved', description: 'A contract renewal completes approval.' },
    'contract.renewal.rejected': { group: 'contracts', label: 'Contract renewal rejected', description: 'A contract renewal is rejected.' },
    'certification.expiring': { group: 'contracts', label: 'Certification expiring', description: 'A certification enters its expiry window.' },
    'onboarding.welcome': { group: 'people', label: 'Onboarding welcome', description: 'A new hire’s onboarding checklist is ready.' },
    'kudos.received': { group: 'people', label: 'Kudos received', description: 'A colleague recognizes an employee.' },
    'interview.scheduled': {
      group: 'people',
      label: 'Interview scheduled',
      description: 'An employee is booked as the interviewer for a candidate round.',
    },
    'safety.incident.reported': {
      group: 'safety',
      label: 'Safety incident reported',
      description: 'A workplace incident is reported.',
    },
  } satisfies Record<NotificationEventType, { group: NotificationEventGroup; label: string; description: string }>,

  recipients: {
    subject_employee: 'The employee',
    manager: 'Their manager',
    hr_admin: 'HR admins',
  } satisfies Record<NotificationRecipientRole, string>,
  directRecipients: 'The current approver',
} as const;
