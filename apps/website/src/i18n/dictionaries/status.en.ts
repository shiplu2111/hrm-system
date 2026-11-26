export const statusEn = {
  meta: {
    title: 'System Status',
    description:
      'Live operational status across CMSN-HR API, web application, mobile sync, and notification services, with 90-day uptime history and incident notices.',
  },
  hero: {
    eyebrow: 'Service Reliability',
    title: 'System Status',
    subtitle:
      'Current operational state across core customer-facing services, 90-day availability history, and verified staff incident updates.',
  },
  overall: {
    operational: 'All Systems Operational',
    degraded: 'Partial Service Degradation',
    outage: 'Service Outage Detected',
    maintenance: 'Scheduled Maintenance in Progress',
    operationalSubtitle: 'All core customer-facing services are running normally.',
    degradedSubtitle:
      'One or more platform services are operating in a degraded state. Our engineering team is actively monitoring.',
    outageSubtitle:
      'A service disruption is currently affecting one or more components. See active incident updates below.',
    maintenanceSubtitle:
      'Scheduled platform maintenance is active. Temporary delays may occur during the maintenance window.',
    lastUpdatedLabel: 'Last checked',
    autoRefreshNote: 'Refreshes automatically every {{seconds}}s',
    refreshButton: 'Refresh now',
    refreshingButton: 'Refreshing…',
    unavailableFallback: 'Live status telemetry is temporarily unavailable. Please retry in a moment.',
  },
  states: {
    operational: 'Operational',
    degraded: 'Degraded',
    outage: 'Outage',
    maintenance: 'Maintenance',
  },
  components: {
    heading: 'Current Component Status',
    subtitle: '90-day daily availability bars reflect verified incident and maintenance history.',
    uptimeSuffix: 'uptime (90 days)',
    ninetyDaysAgo: '90 days ago',
    today: 'Today',
    legend: {
      operational: 'Operational',
      degraded: 'Degraded',
      maintenance: 'Maintenance',
      outage: 'Outage',
    },
    tooltipDayIncidents: '{{date}} — {{state}} ({{uptime}}% · {{count}} incident)',
    tooltipDayIncidentsPlural: '{{date}} — {{state}} ({{uptime}}% · {{count}} incidents)',
    tooltipDayClean: '{{date}} — {{state}} ({{uptime}}%)',
  },
  incidents: {
    activeHeading: 'Active Incidents',
    activeEmpty: 'No active incidents at this time.',
    historyHeading: 'Incident History',
    historySubtitle: 'Completed incident reports and timelines published by platform staff.',
    historyEmpty: 'No past incidents recorded in the recent reporting window.',
    startedLabel: 'Started',
    resolvedLabel: 'Resolved',
    durationLabel: 'Duration',
    durationOngoing: 'Ongoing',
    durationMinutes: '{{minutes}} min',
    timelineHeading: 'Status Updates',
    statuses: {
      investigating: 'Investigating',
      identified: 'Identified',
      monitoring: 'Monitoring',
      resolved: 'Resolved',
    },
    severities: {
      minor: 'Minor',
      major: 'Major',
      critical: 'Critical',
      maintenance: 'Maintenance',
    },
  },
  maintenanceBanner: {
    scheduledTitle: 'Upcoming Scheduled Maintenance',
    activeTitle: 'Scheduled Maintenance Active',
    windowLabel: 'Window',
  },
  helpFooter: {
    question: 'Experiencing an issue with your workspace?',
    helpCta: 'Visit Help Center',
    contactCta: 'Contact Support',
  },
} as const;
