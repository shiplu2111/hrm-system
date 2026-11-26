export type FeaturePhaseStatus = 'live' | 'coming_soon';

export interface FeatureDetailBlock {
  id: string;
  title: string;
  description: string;
  phaseStatus: FeaturePhaseStatus;
  phaseLabel: string;
  bullets: readonly string[];
  imageSlot: {
    badge: string;
    caption: string;
    previewLines: readonly string[];
  };
}

export interface FeaturePageSpec {
  slug: 'payroll' | 'attendance' | 'leave' | 'recruitment' | 'self-service' | 'reports' | 'workflows';
  title: string;
  shortTitle: string;
  eyebrow: string;
  headline: string;
  summary: string;
  phaseStatus: FeaturePhaseStatus;
  phaseBadge: string;
  phaseNotice?: string;
  moduleRefs: string;
  whoItIsFor: {
    heading: string;
    audience: string;
    outcomes: readonly string[];
  };
  blocks: readonly FeatureDetailBlock[];
  relatedSlugs: readonly ('payroll' | 'attendance' | 'leave' | 'recruitment' | 'self-service' | 'reports' | 'workflows')[];
  cta: {
    eyebrow: string;
    title: string;
    description: string;
    primaryLabel: string;
    secondaryLabel: string;
  };
}

export const featuresEn = {
  overview: {
    metaTitle: 'Product Features Overview — HR, Attendance & Payroll',
    metaDescription:
      'Explore live Phase 1 HR, payroll, attendance, leave, self-service, and reporting modules alongside upcoming Phase 2 capabilities.',
    eyebrow: 'Modular HR & Payroll Platform',
    title: 'Every Module Built Around Country Compliance & Financial Control',
    subtitle:
      'Start with core HR, attendance, leave, and deterministic payroll today. Upcoming Phase 2 capabilities are transparently labelled Coming soon.',
    liveGroupHeading: 'Available Now — Core MVP Platform (Phase 1)',
    liveGroupSubtitle: 'Ready for production deployment per PHASES.md.',
    upcomingGroupHeading: 'On the Roadmap — Extended Modules (Phase 2)',
    upcomingGroupSubtitle: 'Planned extensions clearly marked Coming soon — not sold as currently live.',
    badgeLive: 'Available now · Phase 1',
    badgeComingSoon: 'Coming soon · Phase 2',
    exploreFeatureCta: 'Explore feature details',
    previewRoadmapCta: 'View planned scope',
    cta: {
      eyebrow: 'See CMSN-HR in Action',
      title: 'Explore how core modules connect from clock-in to locked payroll.',
      description:
        'Start a 14-day trial workspace or schedule a walkthrough tailored to your country and workforce.',
      primaryLabel: 'Start free trial',
      secondaryLabel: 'Book a demo',
    },
  },
  detail: {
    breadcrumbHome: 'Home',
    breadcrumbFeatures: 'Features',
    whoItIsForEyebrow: 'Who It Is For',
    relatedHeading: 'Related Features',
    relatedSubtitle: 'Explore connected modules across the CMSN-HR platform.',
    imageSlotPendingPrefix: 'UI Screenshot Slot',
    comingSoonBannerTitle: 'Roadmap Module — Not Yet Live',
    liveStatusPill: 'Live · Phase 1',
    comingSoonPill: 'Coming soon · Phase 2',
  },
  pages: {
    payroll: {
      slug: 'payroll',
      title: 'Payroll & Statutory Tax',
      shortTitle: 'Payroll',
      eyebrow: 'Modules §16, §18, §19, §20 & §42',
      headline: 'Deterministic Payroll Processing, Statutory Tax, Simulation & Full Audit Trail',
      summary:
        'Run multi-frequency payroll with effective-dated country tax brackets, preview net pay before committing, generate payslips and bank files, and lock finalized runs with a complete audit trail.',
      phaseStatus: 'live',
      phaseBadge: 'Available now · Phase 1',
      moduleRefs: 'Modules §16, §17, §18, §19, §20, §42',
      whoItIsFor: {
        heading: 'Built for payroll officers, finance leads, and business owners',
        audience:
          'Teams running weekly, fortnightly, semi-monthly, or monthly payroll across one or multiple jurisdictions who need reproducible calculations and strict financial locks.',
        outcomes: [
          'Eliminate manual tax-slab spreadsheet lookups across pay cycles.',
          'Catch anomalies with what-if simulation before final approval.',
          'Preserve historical payroll integrity whenever tax laws update.',
        ],
      },
      blocks: [
        {
          id: 'tax-brackets',
          title: 'Country-Configurable Tax Engine & Brackets',
          description:
            'Resolve income tax slabs, rebates, minimum tax rules, and social security defaults through the effective-dated hierarchy from Country and State down to Employee Tax Profiles.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Supports country tax years, statutory tax slabs, and rebates (Modules §20).',
            'Generates employee tax certificates and statutory filing reports.',
            'Effective-dated rule versions keep prior runs untouched when rates change.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · TAX ENGINE]',
            caption: 'Tax slab & country rule version configuration view (Modules §20)',
            previewLines: ['Hierarchy: Country → Tax Year → Brackets', 'Effective dating: effective_from / effective_to', 'Outputs: Tax certificate & filing summary'],
          },
        },
        {
          id: 'simulation-pipeline',
          title: 'What-If Simulation & Multi-Stage Approval Flow',
          description:
            'Preview net pay across the entire run without committing ledger changes, then move runs smoothly through Draft → Calculated → Under Review → Approved → Finalized → Paid.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Pre-commit payroll simulation compares gross, deductions, and net totals (Modules §18).',
            'Pulls approved attendance, overtime, leave deductions, and salary structures automatically.',
            'Supports retroactive adjustments and payroll reconciliation workflows.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · PAYROLL SIMULATION]',
            caption: 'Payroll calculation review & variance check interface (Modules §18)',
            previewLines: ['Pipeline: Draft → Calculated → Review → Approved → Finalized', 'Mode: Non-destructive "what-if" preview', 'Inputs: Attendance + Leave + Overtime + Structures'],
          },
        },
        {
          id: 'payslips-payments',
          title: 'Payslip Generation & Bank Payment Batches',
          description:
            'Automatically generate itemized payslips and bank transfer files once payroll is finalized, with delivery across PDF, email, and employee self-service.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Itemized earnings, deductions, and gross/net breakdown per employee (Modules §19).',
            'Bank transfer batch file generation with transaction reference tracking.',
            'Dedicated final settlement payslips for resignation or termination.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · PAYSLIP & BANK BATCH]',
            caption: 'Employee payslip preview & payment batch status screen (Modules §19)',
            previewLines: ['Delivery: PDF, Email & My Space / Mobile', 'Batches: Bank transfer export & status tracking', 'Offboarding: Full & final settlement line items'],
          },
        },
        {
          id: 'audit-lock',
          title: 'Finalization Locks & Immutable Payroll Audit Trail',
          description:
            'Once finalized, payroll runs freeze completely. Every modification or post-finalization adjustment is recorded with actor, reason, old/new diffs, and IP/timestamp.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Finalized rows are strictly immutable; corrections create linked adjustment records (Modules §18).',
            'Every create, update, or deletion on payroll tables writes to audit logs (Modules §42).',
            'Masks sensitive bank account and tax ID numbers in read views.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · PAYROLL AUDIT LOG]',
            caption: 'Append-only payroll audit diff viewer (Modules §42)',
            previewLines: ['Log fields: User, Action, Record ID, Old/New Diff, Timestamp', 'Policy: Locked finalized run protection', 'Adjustments: Linked payroll_adjustments'],
          },
        },
        {
          id: 'formula-builder',
          title: 'Visual Formula Builder, Loans & Benefits Administration',
          description:
            'Extended Phase 2 payroll tooling adding a drag-and-drop formula builder for custom conditional pay logic, automated employee loan recovery, and benefit plan enrollment.',
          phaseStatus: 'coming_soon',
          phaseLabel: 'Coming soon · Phase 2',
          bullets: [
            'Visual conditional formula chain editor (Modules §17 — Coming soon).',
            'Loan & salary advance installment schedules linked to payroll (Modules §22 — Coming soon).',
            'Superannuation & health/life benefit enrollment tracking (Modules §21 — Coming soon).',
          ],
          imageSlot: {
            badge: '[COMING SOON · PHASE 2 PREVIEW]',
            caption: 'Planned Phase 2 visual payroll formula & loan modules (PHASES.md)',
            previewLines: ['Status: Phase 2 Roadmap (Not yet live)', 'Scope: Formula UI (§17), Benefits (§21), Loans (§22)'],
          },
        },
      ],
      relatedSlugs: ['attendance', 'leave', 'reports'],
      cta: {
        eyebrow: 'Ready for Reproducible Payroll',
        title: 'Run your next payroll cycle with simulation previews and locked audit trails.',
        description: 'Start a 14-day trial workspace or schedule a payroll walkthrough for your country.',
        primaryLabel: 'Start free trial',
        secondaryLabel: 'Book a demo',
      },
    },
    attendance: {
      slug: 'attendance',
      title: 'Attendance & Roster',
      shortTitle: 'Attendance',
      eyebrow: 'Modules §10, §12, §15 & §33',
      headline: 'Offline-First Mobile Clock-In, GPS Geofencing & Shift Roster Scheduling',
      summary:
        'Capture accurate working hours across offices, factories, and field sites—even offline—with break tracking, overtime caps, shift swaps, and device verification.',
      phaseStatus: 'live',
      phaseBadge: 'Available now · Phase 1',
      moduleRefs: 'Modules §10, §11, §12, §15, §32, §33',
      whoItIsFor: {
        heading: 'Built for operations managers, shift supervisors, and distributed crews',
        audience:
          'Businesses managing fixed, rotating, or overnight shifts as well as field employees working in areas with unreliable cellular or Wi-Fi connectivity.',
        outcomes: [
          'Never lose clock-in punches when staff lose connectivity.',
          'Prevent buddy punching and out-of-zone clock-ins with geofencing & device binding.',
          'Feed verified regular hours, breaks, and overtime straight into payroll.',
        ],
      },
      blocks: [
        {
          id: 'offline-clockin',
          title: 'Offline-First Mobile Clock-In & Break Management',
          description:
            'Employees punch in/out and log lunch or custom breaks without internet access. Client-generated UUIDs guarantee idempotent syncing without duplicate rows.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Supports offline-first mobile, web portal, and CSV attendance import (Modules §10; hardware biometric gateways coming soon).',
            'Tracks gross vs net working hours across lunch and custom breaks.',
            'Handles missed-punch regularization and attendance correction approvals.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · OFFLINE ATTENDANCE]',
            caption: 'Attendance log & sync-status review screen (Modules §10, §32)',
            previewLines: ['Modes: Mobile Offline UUID, Web Portal, CSV Import', 'States: Present, Late, Early Leave, Half Day, WFH', 'Audit: Clock-skew anomaly detection'],
          },
        },
        {
          id: 'geofencing-security',
          title: 'GPS Geofencing & Authorized Device Binding',
          description:
            'Define office or site coordinates with custom radius thresholds to warn or block out-of-zone punches, paired with registered employee device controls.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Location radius policies block or flag out-of-zone clock-in attempts (Modules §33).',
            'Device registration tracks approved mobile hardware and flags multiple-device logins.',
            'Admins can revoke compromised devices immediately.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · GEOFENCE & DEVICES]',
            caption: 'Branch geofence radius & registered devices panel (Modules §33)',
            previewLines: ['Policy: Latitude/Longitude + Radius meters', 'Enforcement: Block or Warn on out-of-zone punch', 'Security: Allowed devices per employee'],
          },
        },
        {
          id: 'shift-roster',
          title: 'Shift Master & Multi-Pattern Roster Scheduling',
          description:
            'Configure fixed, rotating, night, split, flexible, and overnight shifts with custom grace periods, minimum hours, and employee shift-swap requests.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Assign employees to shifts by date and work location (Modules §12).',
            'Configurable late, early-leave, break, and weekend rules per shift.',
            'Built-in shift swap workflows and automated schedule change notifications.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · SHIFT ROSTER]',
            caption: 'Weekly employee shift roster & swap approval view (Modules §12)',
            previewLines: ['Shift Types: Fixed, Rotating, Night, Split, Flexible, Overnight', 'Rules: Grace periods & minimum working hours', 'Self-Service: 14-day roster & swap requests'],
          },
        },
        {
          id: 'overtime-rules',
          title: 'Automated Overtime Detection & Rate Multipliers',
          description:
            'Detect overtime automatically against shift schedules or route manual overtime claims through manager approvals with configurable caps.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Separate overtime multipliers for weekday, weekend, holiday, and night hours (Modules §15).',
            'Enforce maximum overtime limits/caps by policy.',
            'Approved overtime hours pass cleanly into payroll calculation.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · OVERTIME RULES]',
            caption: 'Overtime policy & approval queue view (Modules §15)',
            previewLines: ['Multipliers: Weekday / Weekend / Holiday / Night', 'Guardrails: Configurable monthly/weekly OT caps', 'Flow: Auto-detected or manual request approval'],
          },
        },
        {
          id: 'timesheets-phase2',
          title: 'Project & Task Timesheets (Billable vs Non-Billable)',
          description:
            'Track project and task hours across teams with billable utilization splits and bulk timesheet approval queues.',
          phaseStatus: 'coming_soon',
          phaseLabel: 'Coming soon · Phase 2',
          bullets: [
            'Log start/end time and breaks against specific projects and tasks (Modules §11 — Coming soon).',
            'Separate billable vs non-billable totals per employee and project.',
            'Bulk approve or reject up to 100 entries with mandatory rejection reasons.',
          ],
          imageSlot: {
            badge: '[COMING SOON · PHASE 2 TIMESHEETS]',
            caption: 'Planned Phase 2 project timesheet approval queue (PHASES.md)',
            previewLines: ['Status: Phase 2 Roadmap (Not yet live)', 'Scope: Project & Task Timesheets (Modules §11)'],
          },
        },
      ],
      relatedSlugs: ['self-service', 'payroll', 'leave'],
      cta: {
        eyebrow: 'Accurate Time & Shift Tracking',
        title: 'Capture every shift and field punch reliably—online or offline.',
        description: 'Launch a free trial workspace or request a guided demo of mobile geofencing.',
        primaryLabel: 'Start free trial',
        secondaryLabel: 'Book a demo',
      },
    },
    leave: {
      slug: 'leave',
      title: 'Leave & Holidays',
      shortTitle: 'Leave & Holidays',
      eyebrow: 'Modules §13 & §14',
      headline: 'Configurable Leave Policies, Accruals & Country Holiday Calendars',
      summary:
        'Automate annual, sick, parental, and custom leave entitlements with carry-forward rules, multi-step approvals, and branch-level holiday calendars.',
      phaseStatus: 'live',
      phaseBadge: 'Available now · Phase 1',
      moduleRefs: 'Modules §13, §14, §24',
      whoItIsFor: {
        heading: 'Built for HR managers, department heads, and multi-region teams',
        audience:
          'Organizations operating across countries or states that need accurate accrual math, probation restrictions, and local public holiday inheritance.',
        outcomes: [
          'Replace manual spreadsheet leave balances with live policy-driven calculations.',
          'Prevent scheduling conflicts with country, state, and branch holiday calendars.',
          'Sync approved unpaid leave directly into monthly payroll deductions.',
        ],
      },
      blocks: [
        {
          id: 'leave-policies',
          title: 'Leave Types, Accruals, Carry-Forward & Encashment',
          description:
            'Define Annual, Sick, Personal, Unpaid, Maternity/Paternity, Compassionate, or custom leave types with granular accrual and probation rules.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Supports monthly, yearly, or on-hire accrual schedules (Modules §13).',
            'Configure carry-forward caps, expiry windows, half-day leave, and negative balance limits.',
            'Enforce probation period restrictions and final-settlement leave encashment.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · LEAVE POLICIES]',
            caption: 'Leave type & accrual policy configuration screen (Modules §13)',
            previewLines: ['Types: Annual, Sick, Parental, Unpaid, Custom', 'Rules: Accrual, Carry-forward, Half-day, Probation lock'],
          },
        },
        {
          id: 'leave-approvals',
          title: 'Multi-Step Leave Requests & Balance Previews',
          description:
            'Employees preview their exact available balance before applying, while requests route cleanly through manager and HR approval chains.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Configurable multi-step routing: Employee → Manager → HR (Modules §13).',
            'Real-time balance preview prevents over-booking during application (Modules §24).',
            'Instant notifications on request submission, approval, or rejection.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · LEAVE APPROVALS]',
            caption: 'Manager leave approval queue & balance summary (Modules §13)',
            previewLines: ['Flow: Employee → Manager → HR', 'Visibility: Team overlap & live balance preview'],
          },
        },
        {
          id: 'holiday-calendars',
          title: 'Layered Country, State, Company & Branch Holiday Calendars',
          description:
            'Inherit statutory public holidays from country and state/province templates while adding company-wide or branch-specific holidays and overrides.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Supports Country, State/Province, Company, and Branch holiday scopes (Modules §14).',
            'Allow employee-specific calendar overrides where shift patterns require.',
            'Automatically excludes holidays from deducted leave days and triggers holiday OT rates.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · HOLIDAY CALENDARS]',
            caption: 'Multi-level holiday calendar configuration (Modules §14)',
            previewLines: ['Layers: Country → State/Province → Company → Branch', 'Integration: Linked to Leave days & Holiday OT'],
          },
        },
        {
          id: 'leave-payroll-sync',
          title: 'Leave Balance Reporting & Payroll Deduction Sync',
          description:
            'Export leave utilization and remaining balances at any point in time, and reflect approved unpaid leave automatically inside payroll calculation.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Unpaid leave days flow straight into payroll deductions without re-entry (Modules §16, §18).',
            'Track department leave balances, pending requests, and encashment liabilities.',
            'Full audit history of manual balance adjustments and approvals.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · LEAVE REPORTS]',
            caption: 'Leave balance tracking & unpaid deduction summary (Modules §13, §38)',
            previewLines: ['Payroll Link: Approved Unpaid Leave → Deduction', 'Reporting: Entitlements, Taken, Remaining, Encashed'],
          },
        },
      ],
      relatedSlugs: ['attendance', 'self-service', 'payroll'],
      cta: {
        eyebrow: 'Streamlined Time Off',
        title: 'Automate leave accruals and holiday rules across every branch.',
        description: 'Try CMSN-HR free for 14 days or talk with our team about your country calendar setup.',
        primaryLabel: 'Start free trial',
        secondaryLabel: 'Book a demo',
      },
    },
    recruitment: {
      slug: 'recruitment',
      title: 'Recruitment & Onboarding',
      shortTitle: 'Recruitment & Onboarding',
      eyebrow: 'Phase 2 Roadmap · Modules §07 & §08',
      headline: 'Applicant Tracking, Multi-Round Interviews & Automated Onboarding Checklists',
      summary:
        'Planned Phase 2 extension connecting job requisitions, interview scoring, offer approvals, and role-based onboarding/offboarding checklists directly to Employee Core.',
      phaseStatus: 'coming_soon',
      phaseBadge: 'Coming soon · Phase 2',
      phaseNotice:
        'Per PHASES.md, Recruitment / ATS (Module 07) and Onboarding / Offboarding (Module 08) are Phase 2 roadmap modules and are not yet enabled for self-serve live workspaces.',
      moduleRefs: 'Modules §06, §07, §08, §27 (Phase 2)',
      whoItIsFor: {
        heading: 'Designed for HR teams, internal recruiters, and hiring managers',
        audience:
          'Growing companies planning to replace fragmented spreadsheets and email hiring threads with structured requisition approvals and automated day-one onboarding.',
        outcomes: [
          'Convert approved candidates straight into active employee records without retyping data.',
          'Track required onboarding documents, policy acceptances, and asset handovers.',
          'Handle structured offboarding clearances, asset returns, and final settlement.',
        ],
      },
      blocks: [
        {
          id: 'job-requisitions-ats',
          title: 'Job Requisitions & Candidate Pipeline',
          description:
            'Publish open requisitions tied to departments and vacant org-chart positions, store parsed CVs, and screen applicants in a centralized database.',
          phaseStatus: 'coming_soon',
          phaseLabel: 'Coming soon · Phase 2',
          bullets: [
            'Job requisition, position, and description templates (Modules §07 — Coming soon).',
            'Candidate database, application tracking, and CV/resume storage.',
            'Screening stages integrated with RBAC recruiter permissions.',
          ],
          imageSlot: {
            badge: '[COMING SOON · PHASE 2 ATS]',
            caption: 'Planned Phase 2 job requisition & candidate pipeline view (Modules §07)',
            previewLines: ['Status: Phase 2 Roadmap (Not yet live)', 'Stages: Requisition → Screening → Interview → Offer → Hired'],
          },
        },
        {
          id: 'interviews-offers',
          title: 'Multi-Round Interviews, Scoring & Offer Conversion',
          description:
            'Coordinate Technical, HR, and Management interview rounds with structured scoring, generate offer letters for approval, and convert hires into employee profiles.',
          phaseStatus: 'coming_soon',
          phaseLabel: 'Coming soon · Phase 2',
          bullets: [
            'Structured multi-round interview scheduling, scorecards, and feedback (Modules §07 — Coming soon).',
            'Offer letter generation and approval workflow routing.',
            'One-click Candidate → Employee conversion on hire.',
          ],
          imageSlot: {
            badge: '[COMING SOON · PHASE 2 OFFERS]',
            caption: 'Planned Phase 2 interview scoring & offer approval view (Modules §07)',
            previewLines: ['Status: Phase 2 Roadmap (Not yet live)', 'Rounds: Technical → HR → Management → Final Decision'],
          },
        },
        {
          id: 'onboarding-checklists',
          title: 'Automated Onboarding Checklists & Document Verification',
          description:
            'Apply company checklist templates automatically on hire to track required document uploads, verification workflows, policy acceptances, and IT provisioning.',
          phaseStatus: 'coming_soon',
          phaseLabel: 'Coming soon · Phase 2',
          bullets: [
            'Configurable checklist templates with start-date-based due offsets (Modules §08 — Coming soon).',
            'Supports document collection, policy acceptance, asset provisioning, and manual tasks.',
            'Links documents already on file automatically and tracks completion progress.',
          ],
          imageSlot: {
            badge: '[COMING SOON · PHASE 2 ONBOARDING]',
            caption: 'Planned Phase 2 employee onboarding checklist tracker (Modules §08)',
            previewLines: ['Status: Phase 2 Roadmap (Not yet live)', 'Task types: Document, Policy Acceptance, Provisioning, Manual'],
          },
        },
        {
          id: 'offboarding-assets',
          title: 'Structured Offboarding, Asset Return & Final Settlement',
          description:
            'Automate clearance steps when resignations or terminations occur, tracking company asset returns, access revocation, exit interviews, and final settlement lines.',
          phaseStatus: 'coming_soon',
          phaseLabel: 'Coming soon · Phase 2',
          bullets: [
            'Asset register tracks laptops, phones, SIMs, and ID cards through handover and return (Modules §27 — Coming soon).',
            'Revokes portal accounts and refresh tokens cleanly upon exit.',
            'Generates final_settlement payroll adjustment without mutating past runs (Modules §08).',
          ],
          imageSlot: {
            badge: '[COMING SOON · PHASE 2 OFFBOARDING]',
            caption: 'Planned Phase 2 offboarding tracker & asset register (Modules §08, §27)',
            previewLines: ['Status: Phase 2 Roadmap (Not yet live)', 'Clearance: Asset Return + Access Revocation + Final Settlement'],
          },
        },
      ],
      relatedSlugs: ['self-service', 'workflows', 'reports'],
      cta: {
        eyebrow: 'Phase 2 Roadmap Preview',
        title: 'Interested in early access as Recruitment & Onboarding ships?',
        description:
          'You can start today with Phase 1 Employee Core & Bulk CSV Onboarding, or book a roadmap briefing with our team.',
        primaryLabel: 'Book a demo',
        secondaryLabel: 'Explore live Phase 1 features',
      },
    },
    'self-service': {
      slug: 'self-service',
      title: 'Employee Self-Service & Mobile App',
      shortTitle: 'Self-Service & Mobile',
      eyebrow: 'Modules §24 & §32',
      headline: 'Web "My Space" & Native Mobile App for Every Employee',
      summary:
        'Give employees instant access to clock in/out offline, view their 14-day roster, check leave balances, and download payslips without emailing HR.',
      phaseStatus: 'live',
      phaseBadge: 'Available now · Phase 1',
      moduleRefs: 'Modules §24, §32, §34',
      whoItIsFor: {
        heading: 'Built for employees, frontline shift staff, and lean HR teams',
        audience:
          'Organizations wanting to eliminate repetitive HR inquiries for payslips, shift times, and leave balances across both desktop and mobile.',
        outcomes: [
          'Employees reach clock-in/out within one tap on mobile—even offline.',
          'Strict role scoping keeps employee logins restricted exclusively to My Space.',
          'Instant PDF payslips and live leave balance previews reduce HR admin tickets.',
        ],
      },
      blocks: [
        {
          id: 'mobile-app-clockin',
          title: 'One-Tap Mobile Clock-In, Breaks & Offline Sync',
          description:
            'Purpose-built native mobile experience allowing field and shift workers to punch in/out and log breaks offline with SQLite queueing and idempotent server sync.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Persistent visibility of offline vs synced queue status (Modules §32 & UI Guidelines §6).',
            'Scoped JWT session authentication and registered device binding protect employee access.',
            'Push reminders for shift start, break end, clock-out, and roster updates (Modules §34).',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · MOBILE APP]',
            caption: 'Native iOS/Android employee dashboard & offline clock-in card (Modules §32)',
            previewLines: ['Primary Action: 1-tap Clock In / Out + Break toggle', 'Sync Badge: Offline queue counter & sync state', 'Security: JWT session & device binding'],
          },
        },
        {
          id: 'my-space-portal',
          title: '"My Space" Web Self-Service & 14-Day Roster',
          description:
            'Inside the unified web app, employees land directly on My Space (/my) with today’s shift, clock-in controls, upcoming holidays, and a 14-day roster view.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Enforced data_scope = own isolates employee views from admin screens (Modules §24).',
            'View next 14 days of assigned shifts and submit shift-swap requests.',
            'Submit attendance correction requests and overtime claims online.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · MY SPACE DASHBOARD]',
            caption: 'Employee My Space web dashboard & 14-day roster view (Modules §24)',
            previewLines: ['Routes: /my/profile, /my/attendance, /my/leave, /my/roster, /my/payslips', 'Isolation: Strict OWN_SCOPE access guard'],
          },
        },
        {
          id: 'payslips-leave-ess',
          title: 'Payslip Downloads, Tax Docs & Leave Applications',
          description:
            'Employees download itemized monthly payslips and tax documents anytime, and submit or cancel leave requests against real-time balance previews.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Live leave balance preview updates as dates are selected (Modules §24).',
            'Download historical PDF payslips and annual tax certificates (Modules §19, §20).',
            'Profile update requests and employee document upload.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · ESS PAYSLIPS]',
            caption: 'Employee self-service payslip archive & leave request drawer (Modules §24)',
            previewLines: ['Payslips: Itemized earnings/deductions + PDF export', 'Leave: Live entitlement preview before submit'],
          },
        },
        {
          id: 'ess-phase2-extras',
          title: 'Self-Service Expense Claims & Help Center Tickets',
          description:
            'Upcoming Phase 2 self-service extensions enabling receipt uploads for expense reimbursement and in-app support ticketing with knowledge base articles.',
          phaseStatus: 'coming_soon',
          phaseLabel: 'Coming soon · Phase 2',
          bullets: [
            'Submit expense claims with PDF/JPG/PNG receipts up to 10 MB (Modules §23 — Coming soon).',
            'Browse published company/platform Help Center guides (Modules §45 — Coming soon).',
            'Open and track employee support tickets directly inside My Space.',
          ],
          imageSlot: {
            badge: '[COMING SOON · PHASE 2 ESS EXTENSIONS]',
            caption: 'Planned Phase 2 expense claim & support ticket views (PHASES.md)',
            previewLines: ['Status: Phase 2 Roadmap (Not yet live)', 'Scope: Expense Claims (§23) & In-App Help Center (§45)'],
          },
        },
      ],
      relatedSlugs: ['attendance', 'leave', 'payroll'],
      cta: {
        eyebrow: 'Empower Every Employee',
        title: 'Give your workforce self-service clarity on desktop and mobile.',
        description: 'Start a 14-day free trial or book a demo to see My Space and the mobile clock-in app.',
        primaryLabel: 'Start free trial',
        secondaryLabel: 'Book a demo',
      },
    },
    reports: {
      slug: 'reports',
      title: 'Reports & Dashboards',
      shortTitle: 'Reports & Dashboards',
      eyebrow: 'Modules §37, §38 & §39',
      headline: 'Payroll Registers, Attendance Exception Reports & Role-Based Dashboards',
      summary:
        'Monitor real-time headcount, pending approvals, payroll costs, and attendance exceptions—with scheduled report delivery and standard CSV/Excel exports.',
      phaseStatus: 'live',
      phaseBadge: 'Available now · Phase 1',
      moduleRefs: 'Modules §36, §37, §38, §39',
      whoItIsFor: {
        heading: 'Built for HR directors, finance analysts, and branch managers',
        audience:
          'Decision-makers who need clean operational visibility today alongside exportable payroll registers and variance reports for accounting and statutory filing.',
        outcomes: [
          'Spot late arrivals, absences, and pending approvals at a glance on the Admin Dashboard.',
          'Reconcile month-over-month payroll variance before finalizing a pay cycle.',
          'Automate weekly or monthly report subscriptions via email.',
        ],
      },
      blocks: [
        {
          id: 'admin-dashboard',
          title: 'Real-Time Operational & Payroll Dashboards',
          description:
            'Actionable overview cards showing active headcount, employees on leave, absent or late today, working now, pending payroll runs, and upcoming document expiries.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Admin metrics respect each user’s RBAC role and branch/team data scope (Modules §39, §40).',
            'Highlights pending approvals and expiring passports/contracts proactively.',
            'Dedicated Employee Dashboard view inside My Space for personal shifts and leave.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · ADMIN DASHBOARD]',
            caption: 'Admin operational summary & pending approvals dashboard (Modules §39)',
            previewLines: ['KPIs: Headcount, Working Now, Absent/Late, Payroll Cost', 'Alerts: Expiring documents & pending approvals'],
          },
        },
        {
          id: 'payroll-reports',
          title: 'Payroll Registers, Variance & Statutory Tax Reports',
          description:
            'Run itemized payroll registers, department/cost-centre salary summaries, earning/deduction breakdowns, overtime summaries, and period-over-period variance reports.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Covers payroll register, salary summary, tax, overtime, variance, and payment reports (Modules §38).',
            'Export clean CSV/Excel templates across every major entity (Modules §37).',
            'Schedule recurring weekly or monthly email report deliveries.',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · PAYROLL REPORTS]',
            caption: 'Payroll register & month-over-month variance report screen (Modules §38)',
            previewLines: ['Reports: Register, Variance, Tax Summary, Payment Batch', 'Delivery: Interactive table, CSV/Excel & Scheduled Email'],
          },
        },
        {
          id: 'attendance-hr-reports',
          title: 'Attendance Exception & HR Workforce Analytics',
          description:
            'Track daily/monthly attendance, late arrivals, early departures, break compliance, turnover, new hires, terminations, and department summaries.',
          phaseStatus: 'live',
          phaseLabel: 'Phase 1 · Live',
          bullets: [
            'Daily & monthly attendance, overtime, break, and exception reports (Modules §38).',
            'HR headcount, turnover, demographics, and probation-ending tracking.',
            'Bulk Excel/CSV import/export validation for employee and attendance records (Modules §37).',
          ],
          imageSlot: {
            badge: '[SCREENSHOT PENDING · HR & ATTENDANCE REPORTS]',
            caption: 'Attendance exception & workforce turnover analytics view (Modules §38)',
            previewLines: ['Attendance: Late, Early Leave, Absence, Break, Overtime', 'HR Core: Headcount, Turnover, Probation, Document Expiry'],
          },
        },
        {
          id: 'accounting-gl-phase2',
          title: 'Multi-Provider Accounting & Cost-Centre GL Sync',
          description:
            'Xero OAuth and GL Journal CSV exports are live today; QuickBooks Online and Tally connectors are scheduled for Phase 2.',
          phaseStatus: 'coming_soon',
          phaseLabel: 'Xero/CSV Live · QuickBooks & Tally Coming soon',
          bullets: [
            'Live today: Xero OAuth journal sync, GL Journal CSV export, and cost-centre mappings (Modules §36).',
            'Retry queue for failed journal deliveries on payroll finalization.',
            'Coming soon (Phase 2): QuickBooks Online and Tally ERP/Prime connectors.',
          ],
          imageSlot: {
            badge: '[COMING SOON · PHASE 2 GL SYNC]',
            caption: 'Planned Phase 2 chart-of-accounts & journal sync screen (Modules §36)',
            previewLines: ['Status: Phase 2 Roadmap (Not yet live)', 'Scope: Accounting / GL Integration (Modules §36)'],
          },
        },
      ],
      relatedSlugs: ['payroll', 'attendance', 'workflows'],
      cta: {
        eyebrow: 'Audit-Ready Visibility',
        title: 'Turn attendance and payroll records into clean decision-ready reports.',
        description: 'Start your 14-day free trial or book a demo to explore reporting exports.',
        primaryLabel: 'Start free trial',
        secondaryLabel: 'Book a demo',
      },
    },
    workflows: {
      slug: 'workflows',
      title: 'Workflows & Approvals',
      shortTitle: 'Workflows & Approvals',
      eyebrow: 'Phase 2 Roadmap · Modules §35',
      headline: 'Visual Multi-Step Approval Workflow Builder & Conditional Routing',
      summary:
        'Planned Phase 2 workflow engine letting admins design custom drag-and-drop approval chains across expenses, timesheets, contracts, and hiring—with amount-based escalation.',
      phaseStatus: 'coming_soon',
      phaseBadge: 'Coming soon · Phase 2',
      phaseNotice:
        'Per PHASES.md, the reusable Visual Workflow Builder (Module 35) is a Phase 2 module marked Coming soon. Standard Phase 1 built-in approval flows (Leave, Attendance corrections, Overtime, and Payroll Review → Approve → Finalize) are already live.',
      moduleRefs: 'Modules §35 (Phase 2) · Built-in approvals in §10, §13, §18',
      whoItIsFor: {
        heading: 'Designed for multi-branch enterprises and finance controllers',
        audience:
          'Organizations requiring conditional multi-tier sign-offs (for example, escalating high-value claims to Company Owners or routing by named role) without developer rules.',
        outcomes: [
          'Build 1–10 step approval chains visually per module.',
          'Route conditionally based on requester reporting lines, named roles, or claim thresholds.',
          'Lock active request paths against mid-flight workflow edits for audit integrity.',
        ],
      },
      blocks: [
        {
          id: 'visual-workflow-builder',
          title: 'Visual Drag-and-Drop Workflow Builder',
          description:
            'Configure ordered 1–10 step approval chains assigning approvers dynamically by manager, manager’s manager, or any tenant role.',
          phaseStatus: 'coming_soon',
          phaseLabel: 'Coming soon · Phase 2',
          bullets: [
            'Supports manager, skip-level manager, and role-based step targets (Modules §35 — Coming soon).',
            'Self-approval strictly prevented server-side across queues.',
            'Every workflow definition change is audit-logged under settings.',
          ],
          imageSlot: {
            badge: '[COMING SOON · PHASE 2 WORKFLOW UI]',
            caption: 'Planned Phase 2 visual approval step builder (Modules §35)',
            previewLines: ['Status: Phase 2 Roadmap (Not yet live)', 'Steps: 1–10 ordered steps (Manager / Role / Escalation)'],
          },
        },
        {
          id: 'conditional-amount-routing',
          title: 'Amount-Triggered & Module-Specific Escalation',
          description:
            'Define conditional steps that activate automatically when amounts cross configured thresholds—such as adding Company Owner sign-off above limit.',
          phaseStatus: 'coming_soon',
          phaseLabel: 'Coming soon · Phase 2',
          bullets: [
            'Amount triggers and conditional step inclusion for expense claims (Modules §35 — Coming soon).',
            'Supports Timesheets, Contract Renewals, Job Requisitions, Offers, and Reviews.',
            'Built-in default fallback routes ensure no submission is ever orphaned.',
          ],
          imageSlot: {
            badge: '[COMING SOON · CONDITIONAL ROUTING]',
            caption: 'Planned Phase 2 conditional amount trigger configuration (Modules §35)',
            previewLines: ['Status: Phase 2 Roadmap (Not yet live)', 'Rule example: Amount > threshold → add Owner approval step'],
          },
        },
        {
          id: 'immutable-flight-paths',
          title: 'Snapshot Isolation for In-Flight Requests',
          description:
            'Requests preserve the exact approval chain active when submitted, so editing company workflow rules never disrupts pending requests.',
          phaseStatus: 'coming_soon',
          phaseLabel: 'Coming soon · Phase 2',
          bullets: [
            'Submitted items retain their original step snapshot cleanly (Modules §35 — Coming soon).',
            'Workflows with historical requests protect audit history from accidental deletion.',
            'Mandatory rejection reasons communicated clearly to requesters.',
          ],
          imageSlot: {
            badge: '[COMING SOON · FLIGHT AUDITABILITY]',
            caption: 'Planned Phase 2 approval timeline & snapshot history (Modules §35)',
            previewLines: ['Status: Phase 2 Roadmap (Not yet live)', 'Audit: Immutable approval step snapshots per request'],
          },
        },
      ],
      relatedSlugs: ['leave', 'payroll', 'recruitment'],
      cta: {
        eyebrow: 'Phase 2 Roadmap Preview',
        title: 'Start with built-in Phase 1 approvals and prepare for custom routing.',
        description:
          'Phase 1 leave, attendance, overtime, and payroll approvals are ready today. Book a demo to discuss your multi-step workflow requirements.',
        primaryLabel: 'Book a demo',
        secondaryLabel: 'Explore live Phase 1 features',
      },
    },
  } satisfies Record<string, FeaturePageSpec>,
} as const;
