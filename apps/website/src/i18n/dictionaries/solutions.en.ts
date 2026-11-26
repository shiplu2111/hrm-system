import type { FeaturePageSpec } from './features.en';

export type SolutionSlug =
  | 'small-business'
  | 'growing-teams'
  | 'multi-branch'
  | 'shift-based'
  | 'field-workforce';

export type FeatureSlug = FeaturePageSpec['slug'];

export interface SolutionCapabilityBlock {
  id: string;
  title: string;
  description: string;
  bullets: readonly string[];
  moduleRefs: string;
}

export interface SolutionSegmentSpec {
  slug: SolutionSlug;
  category: 'company_size' | 'workforce_type';
  categoryLabel: string;
  title: string;
  eyebrow: string;
  headline: string;
  summary: string;
  whoItIsFor: {
    heading: string;
    description: string;
    highlights: readonly string[];
  };
  capabilities: readonly SolutionCapabilityBlock[];
  relatedFeatures: readonly {
    slug: FeatureSlug;
    reason: string;
  }[];
  relatedSolutions: readonly SolutionSlug[];
  cta: {
    eyebrow: string;
    title: string;
    description: string;
    primaryLabel: string;
    secondaryLabel: string;
  };
}

export const solutionsEn = {
  overview: {
    metaTitle: 'Solutions by Company Size & Workforce Type',
    metaDescription:
      'Explore how CMSN-HR serves small businesses, growing teams, multi-branch organizations, shift-based operations, and offline field workforces.',
    eyebrow: 'Solutions · Company Size & Industry',
    title: 'One Platform Configured for Your Team Size and Workforce Model',
    subtitle:
      'Whether you manage a single small office or coordinate multi-branch shifts and offline field crews, every capability stays within one unified HR and payroll core.',
    sizeHeading: 'By Company Size & Structure',
    sizeSubtitle: 'Scale smoothly from initial employee directory setup to multi-branch governance.',
    workforceHeading: 'By Workforce & Industry Pattern',
    workforceSubtitle: 'Purpose-built scheduling, geofencing, and offline clock-in controls.',
    countryBannerTitle: 'Looking for country-specific statutory compliance?',
    countryBannerDesc:
      'Inspect supported currencies, pay frequencies, and statutory frameworks per active country.',
    countryBannerCta: 'View Solutions by Country',
    exploreCta: 'Explore solution',
  },
  template: {
    breadcrumbSolutions: 'Solutions',
    relevantFeaturesHeading: 'Connected Product Features',
    relevantFeaturesSubtitle: 'Dive deeper into the live modules powering this workflow.',
    exploreFeatureLink: 'Explore feature',
    otherSolutionsHeading: 'Explore Other Workforce Solutions',
    otherSolutionsSubtitle: 'Compare configurations across team sizes and operational models.',
    whoItIsForEyebrow: 'Operational Fit',
  },
  segments: {
    'small-business': {
      slug: 'small-business',
      category: 'company_size',
      categoryLabel: 'Company Size',
      title: 'Small Business',
      eyebrow: 'Solution · Small Business (Modules §03, §04, §16, §37)',
      headline: 'Replace Spreadsheets with Structured HR, Attendance & Payroll from Day One',
      summary:
        'Start with Free or Starter tiers tailored for lean teams—centralize employee records, automate leave tracking, import staff via Excel/CSV, and deliver accurate monthly payslips without an engineering team.',
      whoItIsFor: {
        heading: 'Built for business owners and solo HR or finance managers',
        description:
          'Small companies moving away from ad-hoc attendance sheets and manual salary calculations who want clean records and statutory compliance out of the box.',
        highlights: [
          'Import existing employee profiles, leave balances, and salary data via validated Excel/CSV templates.',
          'Configure country-appropriate tax rules and public holidays without custom code.',
          'Give every employee self-service access to payslips and leave requests in My Space.',
        ],
      },
      capabilities: [
        {
          id: 'fast-excel-onboarding',
          title: 'Validated Bulk Import & Core Employee Records',
          description:
            'Upload staff profiles, emergency contacts, bank and tax IDs (masked in read views), and start dates cleanly instead of entering records one by one.',
          moduleRefs: 'Modules §04, §37',
          bullets: [
            'Bulk employee and attendance import with row-level validation.',
            'Track employment status from probation through confirmation.',
            'Secure document uploads with automatic expiry reminders (e.g. contracts or IDs).',
          ],
        },
        {
          id: 'simple-leave-payroll',
          title: 'Automated Leave Balances & Reproducible Pay Runs',
          description:
            'Eliminate manual end-of-month deduction math. Approved unpaid leave and overtime flow straight into monthly payroll simulation and PDF payslips.',
          moduleRefs: 'Modules §13, §18, §19',
          bullets: [
            'Pre-commit payroll simulation previews net pay before finalizing.',
            'Auto-generated itemized PDF/email payslips and bank transfer files.',
            'Finalized runs lock automatically with an audit trail of every change.',
          ],
        },
        {
          id: 'ess-zero-overhead',
          title: 'Employee Self-Service Without Extra Admin Overhead',
          description:
            'Employees check shift times, preview live leave balances, and download payslips directly on web (My Space) or mobile.',
          moduleRefs: 'Modules §24, §32',
          bullets: [
            'Strict OWN_SCOPE permissions keep employee logins isolated to their own records.',
            'Automated notifications when leave is approved or payslips are ready.',
          ],
        },
      ],
      relatedFeatures: [
        { slug: 'payroll', reason: 'Run simulated monthly payroll and deliver itemized PDF payslips.' },
        { slug: 'leave', reason: 'Track annual, sick, and unpaid leave entitlements automatically.' },
        { slug: 'self-service', reason: 'Let employees check balances and download payslips independently.' },
      ],
      relatedSolutions: ['growing-teams', 'multi-branch', 'shift-based'],
      cta: {
        eyebrow: 'Start Lean, Scale Safely',
        title: 'Launch a compliant HR & payroll workspace for your small business.',
        description: 'Start a 14-day free trial or schedule a quick walkthrough tailored to your team.',
        primaryLabel: 'Start free trial',
        secondaryLabel: 'Book a demo',
      },
    },
    'growing-teams': {
      slug: 'growing-teams',
      category: 'company_size',
      categoryLabel: 'Company Size',
      title: 'Growing Teams',
      eyebrow: 'Solution · Growing Teams (Modules §03, §05, §38, §40)',
      headline: 'Scale Headcount with Hierarchical Departments, Manager Approvals & Granular RBAC',
      summary:
        'As headcount expands, enforce structured reporting lines, nested departments, probation confirmations, salary revisions, and scoped manager permissions across teams.',
      whoItIsFor: {
        heading: 'Built for growing HR departments, people ops leads, and team managers',
        description:
          'Expanding companies introducing middle management layers who need role-based data boundaries and auditable employee lifecycle tracking.',
        highlights: [
          'Model unlimited department nesting, job grades/levels, designations, and cost centres.',
          'Grant managers team-scoped approval rights for leave, overtime, and attendance fixes.',
          'Track promotions, transfers, salary revisions, and exits in one employee history log.',
        ],
      },
      capabilities: [
        {
          id: 'org-hierarchy',
          title: 'Flexible Org Charts, Departments & Custom Job Grades',
          description:
            'Configure company-specific designations, job levels (e.g. L1 through Executive), custom employment types, and manager reporting lines with vacant position tracking.',
          moduleRefs: 'Modules §03',
          bullets: [
            'Unlimited parent/child department nesting and team assignments.',
            'Cost centre tagging aligned with salary and department reporting.',
            'Interactive org chart reflecting reporting structures and vacancies.',
          ],
        },
        {
          id: 'rbac-data-scope',
          title: 'Granular Role Permissions & Manager Data Scoping',
          description:
            'Separate HR Admin, Payroll Admin, Manager, and Employee access with module-level permissions (view, create, edit, delete, approve, finalize) and reporting-line scoping.',
          moduleRefs: 'Modules §40',
          bullets: [
            'Built-in roles plus custom company roles tailored to your org.',
            'Team-scoped managers only view and approve direct/indirect reports.',
            'Every permission change and payroll sign-off is audit-logged.',
          ],
        },
        {
          id: 'lifecycle-reporting',
          title: 'Employee Lifecycle Tracking & Scheduled HR Reports',
          description:
            'Record promotions, transfers, salary revisions, probation confirmations, and full & final settlements while receiving scheduled headcount and turnover reports.',
          moduleRefs: 'Modules §05, §38',
          bullets: [
            'Document expiry and probation-ending automated reminders.',
            'Scheduled weekly/monthly email summaries for turnover, headcount, and payroll costs.',
          ],
        },
      ],
      relatedFeatures: [
        { slug: 'reports', reason: 'Monitor headcount growth, turnover, probation endings, and payroll variance.' },
        { slug: 'leave', reason: 'Route leave requests automatically through manager and HR approvals.' },
        { slug: 'payroll', reason: 'Apply salary revisions and full & final settlements cleanly.' },
      ],
      relatedSolutions: ['small-business', 'multi-branch', 'shift-based'],
      cta: {
        eyebrow: 'Structure Without Friction',
        title: 'Equip your managers and HR team with clear permissions and reports.',
        description: 'Start a 14-day free trial or book a demo to explore multi-tier RBAC and org setup.',
        primaryLabel: 'Start free trial',
        secondaryLabel: 'Book a demo',
      },
    },
    'multi-branch': {
      slug: 'multi-branch',
      category: 'company_size',
      categoryLabel: 'Company Size',
      title: 'Multi-Branch Organizations',
      eyebrow: 'Solution · Multi-Branch (Modules §02, §03, §14, §33)',
      headline: 'Centralize Governance Across Branches, States & Regions Without Losing Local Rules',
      summary:
        'Manage multiple offices, stores, or regional entities under one tenant—inheriting state tax rules, branch holiday calendars, location geofences, and cost-centre payroll reporting.',
      whoItIsFor: {
        heading: 'Built for multi-location retail chains, regional offices, and holding companies',
        description:
          'Organizations operating across multiple cities, states, or countries that need centralized payroll visibility alongside branch-specific holidays, timezones, and geofences.',
        highlights: [
          'Resolve statutory rules cleanly: Global → Country → State/Province → Company → Location → Contract.',
          'Assign distinct holiday calendars and office geofence radii per branch.',
          'Slice payroll registers and cost summaries cleanly by branch and cost centre.',
        ],
      },
      capabilities: [
        {
          id: 'location-rule-inheritance',
          title: 'State/Province & Branch-Level Rule Resolution',
          description:
            'Share core company salary structures while respecting state/province statutory overrides, local public holidays, and branch attendance rules automatically.',
          moduleRefs: 'Modules §02, §14',
          bullets: [
            'Supports country, state/province, company, and branch-specific holiday calendars.',
            'Attendance, shifts, and dashboards resolve against each branch’s configured timezone.',
            'Audit every company and branch policy change centrally.',
          ],
        },
        {
          id: 'branch-geofencing',
          title: 'Per-Branch Geofencing & Device Policy Support',
          description:
            'Configure unique GPS coordinates and radius policies for each office or warehouse, paired with registered mobile device binding per site (biometric terminal connectors coming soon).',
          moduleRefs: 'Modules §10, §33',
          bullets: [
            'Warn or block clock-ins occurring outside assigned branch boundaries.',
            'Consistent attendance status normalization across manual, mobile, and hardware devices.',
          ],
        },
        {
          id: 'cost-centre-visibility',
          title: 'Branch & Cost-Centre Payroll Reporting',
          description:
            'Compare labor costs, overtime trends, and absence rates across locations on unified Admin Dashboards and exportable registers.',
          moduleRefs: 'Modules §38, §39',
          bullets: [
            'Payroll registers and activity summaries segmented by cost centre and location.',
            'Granular RBAC lets Branch Managers oversee only their assigned site.',
          ],
        },
      ],
      relatedFeatures: [
        { slug: 'payroll', reason: 'Apply state-level tax and statutory variations accurately per branch.' },
        { slug: 'attendance', reason: 'Configure GPS geofence boundaries and shifts for each physical site.' },
        { slug: 'reports', reason: 'Track branch attendance exceptions and cost-centre payroll summaries.' },
      ],
      relatedSolutions: ['growing-teams', 'shift-based', 'field-workforce'],
      cta: {
        eyebrow: 'Unified Multi-Site Control',
        title: 'Run every branch from one platform with local rule accuracy.',
        description: 'Start a 14-day trial workspace or schedule a multi-branch compliance walkthrough.',
        primaryLabel: 'Start free trial',
        secondaryLabel: 'Book a demo',
      },
    },
    'shift-based': {
      slug: 'shift-based',
      category: 'workforce_type',
      categoryLabel: 'Workforce & Industry',
      title: 'Shift-Based Operations',
      eyebrow: 'Solution · Shift Workforces (Modules §10, §12, §15, §24)',
      headline: 'Coordinate Fixed, Rotating, Split & Overnight Shifts with Accurate Overtime Math',
      summary:
        'Built for manufacturing plants, healthcare teams, retail stores, and hospitality operations—manage shift masters, grace periods, breaks, shift swaps, and weekday/weekend/night overtime multipliers.',
      whoItIsFor: {
        heading: 'Built for operations directors, plant supervisors, and roster coordinators',
        description:
          'Teams running 24/7 or multi-shift schedules who need airtight attendance rules, break tracking, and automated overtime verification before payroll.',
        highlights: [
          'Define Fixed, Rotating, Night, Split, Flexible, and Overnight shift templates.',
          'Track lunch and custom breaks separately to measure gross vs net working hours.',
          'Empower employees to view 14-day rosters and request shift swaps in My Space.',
        ],
      },
      capabilities: [
        {
          id: 'shift-master-templates',
          title: 'Comprehensive Shift Templates & Grace Periods',
          description:
            'Configure start/end times, paid or unpaid breaks, late arrival grace windows, minimum working hours, and weekend/early-leave rules per shift.',
          moduleRefs: 'Modules §12',
          bullets: [
            'Assign employees to shifts across dates and locations cleanly.',
            'Handle overnight and split shifts without double-counting calendar boundaries.',
            'Trigger instant roster change notifications to affected employees.',
          ],
        },
        {
          id: 'breaks-and-overtime',
          title: 'Break Tracking & Multi-Rate Overtime Caps',
          description:
            'Automatically detect overtime above shift hours or require approval requests, applying separate multipliers for weekday, weekend, holiday, and night work.',
          moduleRefs: 'Modules §10, §15',
          bullets: [
            'Net working hours exclude unpaid breaks automatically before overtime runs.',
            'Enforce daily, weekly, or monthly maximum overtime caps.',
            'Handle missed punches and regularization approvals cleanly.',
          ],
        },
        {
          id: 'shift-swaps-mobile',
          title: '14-Day Roster Visibility & Shift Swap Approvals',
          description:
            'Workers check upcoming shifts on mobile or My Space and submit shift-swap requests that route through supervisor approval.',
          moduleRefs: 'Modules §12, §24, §32',
          bullets: [
            'Employees see the next 14 days of rostered shifts at a glance.',
            'Push reminders notify workers prior to shift start and break end.',
          ],
        },
      ],
      relatedFeatures: [
        { slug: 'attendance', reason: 'Set up shift masters, break rules, overtime multipliers, and rosters.' },
        { slug: 'self-service', reason: 'Give shift staff 14-day roster access, swap requests, and push alerts.' },
        { slug: 'payroll', reason: 'Convert approved shift hours and overtime multipliers cleanly into pay runs.' },
      ],
      relatedSolutions: ['field-workforce', 'multi-branch', 'growing-teams'],
      cta: {
        eyebrow: 'Precision Shift & OT Control',
        title: 'Connect complex shift rosters directly to verified payroll.',
        description: 'Start a 14-day free trial or book a demo focused on shift and overtime workflows.',
        primaryLabel: 'Start free trial',
        secondaryLabel: 'Book a demo',
      },
    },
    'field-workforce': {
      slug: 'field-workforce',
      category: 'workforce_type',
      categoryLabel: 'Workforce & Industry',
      title: 'Field & Distributed Workforces',
      eyebrow: 'Solution · Field Teams (PRD §3 & Modules §10, §32, §33)',
      headline: 'Offline-First Mobile Clock-In & Geofenced Verification for Teams on the Move',
      summary:
        'Keep field technicians, delivery teams, site engineers, and remote crews clocking in reliably—even in dead zones—with local UUID queueing, GPS geofencing, and device registration.',
      whoItIsFor: {
        heading: 'Built for construction, logistics, field service, and agricultural teams',
        description:
          'Organizations whose employees work outdoors or across client sites with spotty internet and require trustworthy time-and-location verification.',
        highlights: [
          'One-tap clock in/out and break logging works completely offline on mobile.',
          'Client-generated UUIDs ensure reconnecting never drops or duplicates a punch.',
          'Persistent offline sync indicator guarantees field staff know their punch is queued.',
        ],
      },
      capabilities: [
        {
          id: 'offline-idempotent-sync',
          title: 'True Offline-First Mobile Sync Without Duplicates',
          description:
            'Employees clock in/out, log breaks, inspect rosters, and draft leave requests offline. On reconnect, records sync idempotently via client UUIDs with clock-skew checks.',
          moduleRefs: 'PRD §3 · Modules §32',
          bullets: [
            'Server-side UNIQUE(employee_id, local_id) guarantees zero duplicate records.',
            'Server timestamp remains authoritative; significant device clock skew flags anomalies.',
            'Always-visible sync queue status inside the mobile app (UI Guidelines §6).',
          ],
        },
        {
          id: 'gps-geofence-device-binding',
          title: 'GPS Geofencing & Registered Device Security',
          description:
            'Define site coordinates and allowed radii to block or warn on out-of-zone punches, and register authorized employee smartphones to curb credential sharing.',
          moduleRefs: 'Modules §33',
          bullets: [
            'Bind allowed mobile devices per employee and detect suspicious multi-device logins.',
            'Supports GPS coordinates, radius warning/blocking thresholds, and authorized device binding (biometric/QR terminal gateways coming soon).',
            'Revoke lost or stolen employee devices instantly.',
          ],
        },
        {
          id: 'field-to-payroll',
          title: 'From Field Punch to Locked Payroll Without Re-Entry',
          description:
            'Once synced and approved, regular hours, overtime, and attendance exceptions feed directly into payroll calculation and mobile payslips.',
          moduleRefs: 'Modules §18, §19, §32',
          bullets: [
            'Workers receive itemized payslips protected by scoped self-service session authentication and PDF access controls.',
            'Admins monitor absent, late, and working-now field counts in real time.',
          ],
        },
      ],
      relatedFeatures: [
        { slug: 'attendance', reason: 'Configure offline mobile attendance, GPS geofences, and allowed devices.' },
        { slug: 'self-service', reason: 'Explore the 1-tap mobile dashboard, offline sync badge, and My Space payslips.' },
        { slug: 'reports', reason: 'Audit daily field exceptions, late alerts, and overtime hours.' },
      ],
      relatedSolutions: ['shift-based', 'multi-branch', 'small-business'],
      cta: {
        eyebrow: 'Built for Low-Connectivity Sites',
        title: 'Stop losing field timesheets to dead zones and manual paper logs.',
        description: 'Start a 14-day free trial or schedule a demo of offline mobile attendance sync.',
        primaryLabel: 'Start free trial',
        secondaryLabel: 'Book a demo',
      },
    },
  } satisfies Record<SolutionSlug, SolutionSegmentSpec>,
} as const;
