import { blogEn } from './blog.en';
import { changelogEn } from './changelog.en';
import { companyEn } from './company.en';
import { countriesEn } from './countries.en';
import { customersEn } from './customers.en';
import { featuresEn } from './features.en';
import { helpEn } from './help.en';
import { integrationsEn } from './integrations.en';
import { leadsEn } from './leads.en';
import { legalEn } from './legal.en';
import { loginEn } from './login.en';
import { pricingEn } from './pricing.en';
import { securityEn } from './security.en';
import { signupEn } from './signup.en';
import { solutionsEn } from './solutions.en';
import { statusEn } from './status.en';

export const en = {
  brand: {
    monogram: 'HR',
    namePrefix: 'CMSN',
    nameSuffix: '-HR',
    fullName: 'CMSN-HR',
    platformName: 'CMSN-HR SaaS Platform',
    tagline:
      'Multi-tenant, country-configurable HR, payroll, and offline-first attendance software engineered for financial accuracy.',
  },
  a11y: {
    skipToContent: 'Skip to main content',
    expandFaq: 'Expand answer',
    collapseFaq: 'Collapse answer',
    primaryNavigation: 'Primary navigation',
    mobileNavigation: 'Mobile navigation',
    footerNavigation: 'Footer navigation',
    legalNavigation: 'Legal links',
    openMenu: 'Open navigation menu',
    closeMenu: 'Close navigation menu',
    toggleSubmenu: 'Toggle {{label}} menu',
    homeLink: 'CMSN-HR home',
    selectLanguage: 'Select language',
    selectCurrency: 'Select billing currency',
  },
  meta: {
    defaultTitle: 'CMSN-HR — Country-Configurable HR, Payroll & Attendance Platform',
    titleTemplate: '%s | CMSN-HR',
    description:
      'Multi-tenant, country-configurable HR + Payroll + Attendance SaaS platform. Unified workforce management with offline-first mobile sync and deterministic statutory payroll.',
    keywords:
      'HRMS,Payroll Software,Attendance Tracking,Workforce Management,Multi-country Payroll,Offline Attendance,Statutory Compliance',
    author: 'CMSN-HR Platform Team',
    ogTitle: 'CMSN-HR — Country-Configurable HR, Payroll & Attendance Platform',
    ogDescription:
      'Multi-tenant, country-configurable HR + Payroll + Attendance SaaS platform. Unified workforce operations with offline-first mobile sync.',
    twitterTitle: 'CMSN-HR — Country-Configurable HR & Payroll',
    showcaseTitle: 'Marketing Design System & Component Showcase',
    showcaseDescription:
      'Marketing UI token layer, typography scale, spacing rhythm, and core reusable components built on top of DESIGN_SYSTEM.md.',
    notFoundTitle: 'Page Not Found (404)',
    notFoundDescription: 'The page you requested could not be found on CMSN-HR.',
  },
  nav: {
    product: 'Product',
    solutions: 'Solutions',
    pricing: 'Pricing',
    blog: 'Blog',
    resources: 'Resources',
    company: 'Company',
    logIn: 'Log in',
    startFreeTrial: 'Start free trial',
    differentiators: 'Differentiators',
    architecture: 'Architecture',
    systemStatus: 'System Status',
    componentsShowcase: 'Design System',
    signIn: 'Sign In',
    clientPortal: 'Client Portal',
    superAdmin: 'Super Admin',
    productMenu: {
      overviewTitle: 'Core Capabilities',
      overviewItems: {
        featuresOverview: {
          title: 'Features Overview',
          description: 'Explore all HR, attendance, and payroll capabilities in one workspace.',
        },
        payroll: {
          title: 'Payroll & Statutory Tax',
          description: 'Deterministic gross-to-net runs, tax withholdings, payslips, and audit trails.',
        },
        attendance: {
          title: 'Attendance & Roster',
          description: 'Geofenced shifts and offline-first mobile clock-in with idempotent sync.',
        },
        leave: {
          title: 'Leave & Holidays',
          description: 'Effective-dated accrual policies and country public holiday calendars.',
        },
      },
      platformTitle: 'Platform & Self-Service',
      platformItems: {
        selfService: {
          title: 'Employee Self-Service & Mobile',
          description: 'Payslips, leave balances, and shift schedules on web, iOS, and Android.',
        },
        reports: {
          title: 'Reports & Dashboards',
          description: 'Payroll variance summaries, headcount metrics, and GL exports.',
        },
        recruitment: {
          title: 'Recruitment & Onboarding',
          description: 'Applicant tracking and digital pre-boarding checklists.',
          badge: 'Coming soon',
        },
        workflows: {
          title: 'Workflows & Approvals',
          description: 'Configurable multi-step routing for leave, overtime, and payroll runs.',
          badge: 'Coming soon',
        },
      },
      callout: {
        title: 'Inspect Component Architecture',
        description: 'Review the design tokens and marketing UI kit built on DESIGN_SYSTEM.md.',
        cta: 'View UI Showcase',
      },
    },
    solutionsMenu: {
      countriesTitle: 'By Country Compliance',
      countriesItems: {
        allCountries: {
          title: 'All Supported Countries',
          description: 'Explore active countries, currencies, pay frequencies, and statutory items.',
        },
        complianceFramework: {
          title: 'Statutory Guides (Help Center)',
          description: 'Review current country tax rules, social security, and legal references.',
        },
      },
      teamsTitle: 'By Workforce & Trust',
      teamsItems: {
        smallBusiness: {
          title: 'Small Business',
          description: 'Excel/CSV employee import, automated leave, and reproducible monthly payroll.',
        },
        growingTeams: {
          title: 'Growing Teams',
          description: 'Nested departments, job grades, lifecycle tracking, and scoped manager RBAC.',
        },
        multiBranch: {
          title: 'Multi-Branch Organizations',
          description: 'State rules, branch holiday calendars, site geofences, and cost centres.',
        },
        shiftBased: {
          title: 'Shift-Based Operations',
          description: 'Rotating/overnight shifts, break math, shift swaps, and OT multipliers.',
        },
        fieldWorkforce: {
          title: 'Field Workforces',
          description: 'Offline-first mobile clock-in with UUID sync, GPS geofencing, and device binding.',
        },
        security: {
          title: 'Security, Isolation & Trust',
          description: 'Tenant-scoped encryption, immutable audit logs, and backup verification.',
        },
      },
    },
  },
  footer: {
    columns: {
      product: {
        heading: 'Product',
        links: {
          overview: 'Features Overview',
          payroll: 'Payroll & Tax',
          attendance: 'Attendance & Roster',
          leave: 'Leave & Holidays',
          selfService: 'Employee Mobile App',
          pricing: 'Pricing',
        },
      },
      solutions: {
        heading: 'Solutions',
        links: {
          countries: 'Supported Countries',
          growingTeams: 'Growing & Multi-Branch',
          fieldWorkforce: 'Shift & Field Teams',
          security: 'Security & Trust',
          howItWorks: 'How It Works',
        },
      },
      resources: {
        heading: 'Resources',
        links: {
          helpCenter: 'Help Center',
          blog: 'Blog',
          changelog: 'Product Updates',
          systemStatus: 'System Status',
          integrations: 'Integrations',
          designSystem: 'Design System',
          bookDemo: 'Book a Demo',
        },
      },
      company: {
        heading: 'Company',
        links: {
          about: 'About CMSN-HR',
          careers: 'Careers',
          contact: 'Contact Sales',
          clientPortal: 'Client Portal Log in',
          superAdmin: 'Platform Console',
        },
      },
    },
    legal: {
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      cookies: 'Cookie Policy',
      dpa: 'Data Processing Agreement',
      subprocessors: 'Subprocessors',
      security: 'Security & Retention',
      cookieSettings: 'Cookie Settings',
    },
    languages: {
      en: 'English',
      bn: 'বাংলা',
    },
    statusOperational: 'All systems operational',
    copyright: '© {{year}} {{company}}. All rights reserved.',
  },
  errors: {
    notFound: {
      badge: 'HTTP 404',
      title: 'We could not find that page',
      description:
        'The page you are looking for may have moved, is not yet published, or the address was typed incorrectly. Use the links below to continue exploring CMSN-HR.',
      primaryCta: 'Back to home',
      secondaryCta: 'Explore Design System',
      helpfulHeading: 'Helpful destinations',
      links: {
        home: 'Home — Platform Overview',
        telemetry: 'Live Infrastructure Status',
        login: 'Workspace Log in',
      },
    },
    serverError: {
      badge: 'HTTP 500',
      title: 'Something went wrong on our side',
      description:
        'An unexpected server error interrupted this page request. No workspace or payroll data was affected. Please try loading the page again or return to the home page.',
      retryCta: 'Try again',
      homeCta: 'Back to home',
    },
  },
  maintenance: {
    bannerPrefix: 'Scheduled Maintenance in progress:',
    fallbackMessage: 'Some background services may be experiencing delays.',
  },
  home: {
    hero: {
      eyebrow: 'Multi-Tenant HR, Payroll & Workforce Platform',
      eyebrowTag: 'HR • Attendance • Payroll',
      title: 'Run country-compliant payroll, offline attendance, and HR in one system.',
      subtitle:
        'Built for HR managers, payroll officers, and business owners. Configure tax and leave rules per country without code changes, capture field attendance even without internet, and lock every payroll run with a full audit trail.',
      primaryCta: 'Start free trial',
      secondaryCta: 'Book a demo',
      guarantees: {
        payroll: 'Country-Configurable Rules',
        offline: 'Offline Mobile Clock-In',
        audit: 'Locked Runs & Audit Trail',
        rules: 'Employee Self-Service',
      },
      visual: {
        statusBadge: '[ADMIN PANEL SCREENSHOT PENDING]',
        title: 'Admin Panel — Workforce & Payroll Workspace',
        caption: 'Illustrative layout placeholder (Modules §18, §39). Real Admin Panel capture will replace this frame.',
        sidebarItems: {
          dashboard: 'Dashboard',
          employees: 'Employees',
          attendance: 'Attendance & Shifts',
          leave: 'Leave Management',
          payroll: 'Payroll Runs',
          audit: 'Audit Log',
        },
        metricCards: {
          headcount: 'Active Headcount',
          onLeave: 'On Leave Today',
          pendingPayroll: 'Payroll Status',
          approvals: 'Pending Approvals',
        },
        metricPlaceholders: {
          headcountValue: 'Live count',
          onLeaveValue: 'Daily roster',
          pendingPayrollValue: 'Draft → Finalized',
          approvalsValue: 'Leave & OT queue',
        },
        pipelineLabel: 'Payroll Cycle Pipeline (Modules §18)',
        pipelineSteps: ['Draft', 'Calculated', 'Under Review', 'Approved', 'Finalized', 'Paid'],
      },
    },
    differentiators: {
      eyebrow: 'Why Finance & HR Teams Switch',
      title: 'Four Architectural Foundations Built Into Every Workspace',
      subtitle:
        'Designed to replace disconnected HR directories, attendance spreadsheets, and single-country payroll tools.',
      countryCore: {
        badge: 'Differentiator 01 · Modules §02 & §20',
        title: 'Country-Configurable Payroll & Compliance',
        description:
          'Expand into new jurisdictions through configuration rather than rewrites. Tax brackets, social security rates, financial years, pay schedules, and statutory public holidays resolve automatically by location.',
        bullets: [
          'Effective-dated rule versioning ensures law updates never alter historical payslips.',
          'Supports Weekly, Fortnightly, Semi-monthly, Monthly, and custom payroll periods.',
          'Generates statutory tax summaries, tax certificates, and country-specific calendars.',
        ],
        cta: 'Explore Country Solutions',
        visualTitle: 'Rule Resolution Hierarchy (Modules §02)',
        visualSubtitle: 'Specific overrides win cleanly without breaking defaults:',
        visualChain: [
          { layer: '1. Global Default', detail: 'Fallback platform baseline & rounding conventions' },
          { layer: '2. Country Rules', detail: 'Tax slabs, tax year, social security, public holidays' },
          { layer: '3. State / Province', detail: 'Regional statutory taxes & local public holidays' },
          { layer: '4. Company Policy', detail: 'Org leave accruals, shift grace periods & pay schedules' },
          { layer: '5. Employee Contract', detail: 'Salary structure & employee-specific calendar overrides' },
        ],
      },
      offlineAttendance: {
        badge: 'Differentiator 02 · Modules §10, §32 & §33',
        title: 'Offline-First Mobile Attendance & Security',
        description:
          'Field crews, factory shifts, and distributed branches clock in/out, log lunch or custom breaks, inspect shifts, and request leave even with zero cellular or Wi-Fi signal.',
        bullets: [
          'Every offline punch stores a client-generated UUID so reconnecting never duplicates records.',
          'Enforce GPS geofencing (block or warn outside radius), authorized mobile device binding, and web/CSV attendance.',
          'Tracks authorized employee devices and feeds clean net hours straight into payroll.',
        ],
        cta: 'Explore Attendance & Mobile',
        visualTitle: 'Offline-Safe Clock-In Flow (PRD §3 & Modules §32)',
        visualSteps: [
          { title: '1. Field Clock-In (Offline)', detail: 'Captured locally on iOS/Android with UUID & geofence check' },
          { title: '2. Break & Shift Tracking', detail: 'Lunch/custom breaks recorded with gross vs net hours' },
          { title: '3. Idempotent Server Sync', detail: 'Zero duplicates on reconnect; clock-skew audited server-side' },
          { title: '4. Payroll-Ready Hours', detail: 'Approved regular hours & overtime flow directly to pay runs' },
        ],
      },
      payrollEngine: {
        badge: 'Differentiator 03 · Modules §16, §17 & §18',
        title: 'Dynamic Payroll Rules & Pre-Run Simulation',
        description:
          'Payroll officers configure unlimited earning components (basic, allowances, overtime, bonuses) and deductions (tax, unpaid leave, loans, pension) without developer tickets.',
        bullets: [
          'Run "what-if" payroll simulations to inspect gross-to-net totals before committing.',
          'Handle hourly, daily, or monthly salary structures plus overtime multipliers (weekday, weekend, holiday, night).',
          'Visual drag-and-drop formula builder extends conditional pay rules in Phase 2 (Coming soon).',
        ],
        cta: 'Explore Payroll Features',
        visualBadgeComingSoon: 'Formula UI: Coming soon (Phase 2)',
        visualTitle: 'Dynamic Salary Structure Breakdown (Modules §16 & §18)',
        visualEarningsLabel: 'Dynamic Earnings',
        visualEarnings: ['Basic Salary / Hourly Rate', 'Housing, Transport & Meal Allowances', 'Weekday / Weekend / Night Overtime'],
        visualDeductionsLabel: 'Dynamic Deductions',
        visualDeductions: ['Country Tax Slabs & Rebates', 'Unpaid Leave & Late Deductions', 'Pension / Superannuation Contributions'],
      },
      auditTrail: {
        badge: 'Differentiator 04 · Modules §18, §41 & §42',
        title: 'Full Audit Trail & Locked Finalized Runs',
        description:
          'Protect your organization against financial errors and compliance disputes. Every sensitive change across payroll, employee profiles, and permissions is captured in an append-only audit log.',
        bullets: [
          'Records actor user, action, module, affected record, old/new values, IP address, and timestamp.',
          'Finalized payroll runs are strictly frozen—corrections create linked adjustment records instead of overwriting history.',
          'Includes tenant-level isolation, sensitive field masking (e.g. bank & tax IDs), and 2FA/RBAC controls.',
        ],
        cta: 'Review Security & Trust',
        visualTitle: 'Immutable Audit Log Record (Modules §42)',
        visualRows: [
          { field: 'Action & Module', value: 'payroll.finalized · Payroll Processing' },
          { field: 'Before → After', value: 'status: "approved" → "finalized" (Locked)' },
          { field: 'Actor & Scope', value: 'Payroll Admin · Tenant-scoped JWT' },
          { field: 'Correction Policy', value: 'Creates linked adjustment; finalized rows immutable' },
        ],
      },
    },
    modules: {
      eyebrow: 'Modular Platform Scope',
      title: 'Everything HR, Payroll & Operations Teams Need in One Suite',
      subtitle:
        'Live MVP capabilities are ready for immediate deployment. Phase 2 capabilities are transparently labelled as Coming soon.',
      groups: [
        {
          id: 'hris',
          title: 'Core HRIS & Org Structure',
          status: 'live',
          refs: 'Modules §03, §04, §05',
          description:
            'Employee profiles, bank & tax details, nested departments, job grades, interactive org chart, and lifecycle events (promotions, transfers, full & final settlement).',
        },
        {
          id: 'attendance',
          title: 'Attendance, Shifts & Geofencing',
          status: 'live',
          refs: 'Modules §10, §12, §15, §33',
          description:
            'Fixed, rotating, night, and split shifts; break tracking; overtime caps & multipliers; GPS geofencing, device binding, and offline mobile sync.',
        },
        {
          id: 'leave',
          title: 'Leave & Holiday Calendars',
          status: 'live',
          refs: 'Modules §13, §14',
          description:
            'Configurable leave types, accrual & carry-forward rules, encashment, multi-step approval workflows, and country/state/branch holiday calendars.',
        },
        {
          id: 'payroll',
          title: 'Payroll Processing, Payslips & Tax',
          status: 'live',
          refs: 'Modules §16, §18, §19, §20',
          description:
            'Simulation previews, approval & finalization locks, country tax slabs, auto-generated PDF/email/mobile payslips, and bank payment batch files.',
        },
        {
          id: 'ess',
          title: 'Employee Self-Service & Mobile App',
          status: 'live',
          refs: 'Modules §24, §32',
          description:
            'Unified My Space web portal and iOS/Android app for clock-in/out, 14-day roster visibility, leave balance previews, and payslip downloads.',
        },
        {
          id: 'docs-reports',
          title: 'Documents, Import & Audit Reports',
          status: 'live',
          refs: 'Modules §09, §37, §38, §40, §42',
          description:
            'Configurable employee document types with expiry alerts, bulk Excel/CSV import, scheduled HR/payroll/attendance reports, custom RBAC roles, and audit logs.',
        },
        {
          id: 'talent-assets',
          title: 'Recruitment, Onboarding & Assets',
          status: 'coming_soon',
          badge: 'Coming soon',
          refs: 'Modules §06, §07, §08, §27',
          description:
            'Contract management, multi-round ATS pipelines, onboarding/offboarding checklists, and company asset register tracking.',
        },
        {
          id: 'workflows-api',
          title: 'Visual Workflow Builder & Extended Connectors',
          status: 'coming_soon',
          badge: 'Coming soon',
          refs: 'Modules §35, §36, §43',
          description:
            'Drag-and-drop multi-step conditional approval builder, biometric terminal gateways, bank transfer rails, and Enterprise SAML/OIDC SSO.',
        },
      ],
    },
    howItWorks: {
      eyebrow: 'Fast Onboarding Path',
      title: 'How It Works in 3 Steps',
      subtitle: 'Go from initial workspace signup to a finalized, audit-ready payroll run without engineering effort.',
      steps: [
        {
          number: '01',
          title: 'Configure Company & Country Rules',
          description:
            'Create your tenant workspace, select your active country statutory ruleset, and set up branches, departments, shifts, and leave policies.',
          refs: 'Modules §01, §02, §03, §13',
        },
        {
          number: '02',
          title: 'Import Employees & Capture Attendance',
          description:
            'Bulk-import employees and salary structures via Excel or CSV. Staff clock in via web or mobile (online or offline) and submit leave in self-service.',
          refs: 'Modules §04, §10, §24, §32, §37',
        },
        {
          number: '03',
          title: 'Simulate, Approve & Lock Payroll',
          description:
            'Run a what-if payroll simulation using synced attendance and leave data, review totals, finalize to lock the run with audit logs, and distribute payslips.',
          refs: 'Modules §18, §19, §20, §42',
        },
      ],
    },
    telemetry: {
      eyebrow: 'Public Platform Health',
      title: 'Live Infrastructure Indicators',
      subtitle: 'Fetched directly from our platform telemetry endpoint (GET /health) with edge revalidation.',
      operational: 'Operational & Healthy',
      degraded: 'Degraded Performance',
      latencyLabel: 'API Latency',
      latencyFallback: '—',
      latencyNote: 'Measured per request',
      databaseLabel: 'Database Connection',
      databaseHealthy: 'Connected',
      databaseFallback: 'Unavailable',
      databaseNote: 'Tenant-isolated database',
      syncLabel: 'Offline Sync Rate',
      syncFallback: '—',
      syncNote: 'Idempotent sync queue',
      uptimeLabel: 'Platform Uptime',
      uptimeFallback: '—',
      uptimeUnit: 'min',
      uptimeNote: 'Current process uptime',
    },
    faq: {
      eyebrow: 'Buyer Questions',
      title: 'Frequently Asked Questions',
      subtitle:
        'Practical answers for HR managers, payroll officers, and business owners evaluating CMSN-HR.',
      items: [
        {
          id: 'multi-country',
          question: 'How does the system handle different country tax brackets and leave laws without custom code?',
          answer:
            'Every statutory tax slab, social security rate, public holiday, and leave entitlement resolves through an effective-dated rule hierarchy: Global Default → Country Rules → State/Province Rules → Company Policy → Employee Contract. Updating laws or adding a country requires configuration only.',
        },
        {
          id: 'offline-sync',
          question: 'What happens if field employees clock in without cellular or Wi-Fi coverage?',
          answer:
            'The mobile app records clock-in/out punches and breaks locally with a client-generated UUID. When connectivity returns, records sync idempotently to the server with clock-skew validation and zero duplicate entries.',
        },
        {
          id: 'payroll-determinism',
          question: 'Can a finalized payroll run be edited accidentally or altered by future tax law changes?',
          answer:
            'No. Finalized payroll runs are locked against the exact rule versions active on that pay period date. Any correction creates a linked payroll adjustment entry while preserving the original finalized record and full audit history.',
        },
        {
          id: 'data-import',
          question: 'How do we migrate our existing employee roster and salary data?',
          answer:
            'You can upload employees, initial leave balances, attendance logs, and salary assignments using validated Excel/CSV bulk import templates directly inside the Admin Panel.',
        },
        {
          id: 'rbac-ess',
          question: 'Can employees access their own payslips and leave balances without seeing other staff records?',
          answer:
            'Yes. Role-based permissions enforce strict data scope: standard employees only see their My Space self-service portal (profile, today’s shift, leave application, 14-day roster, and payslip downloads).',
        },
      ],
    },
    cta: {
      eyebrow: 'Get Started with CMSN-HR',
      title: 'Bring clarity, compliance, and auditability to every pay run.',
      description:
        'Start a 14-day trial workspace or schedule a walkthrough tailored to your country and workforce setup.',
      primaryButton: 'Start free trial',
      secondaryButton: 'Book a demo',
      footnote: 'Tenant-isolated workspaces • Effective-dated compliance rules • Full audit trail',
    },
    footer: {
      copyright: '© {{year}} {{company}}. All rights reserved.',
    },
  },
  components: {
    badgePopular: 'Most Popular',
    badgeComingSoon: 'Coming soon',
    learnMore: 'Learn more',
    perEmployeePerMonth: '/ employee / month',
    flatPerMonth: '/ month',
    contactSalesPrice: 'Custom pricing',
  },
  showcase: {
    header: {
      eyebrow: 'UI Layer & Component System',
      title: 'CMSN-HR Marketing Design System Showcase',
      subtitle:
        'Built on top of DESIGN_SYSTEM.md product tokens with a broader marketing type scale, wider section rhythm, trustworthy payroll palette, and full i18n wiring. Resize your browser or test phone, tablet, and desktop widths.',
      backToHome: 'Back to Home Page',
      viewportLabel: 'Responsive verification targets:',
      viewportSizes: 'Phone (375px) • Tablet (768px) • Desktop (1280px+)',
    },
    tokens: {
      eyebrow: '01 · Foundation Tokens',
      title: 'Trustworthy Payroll Palette & Marketing Type Scale',
      subtitle:
        'Primary trust blue (#1e4976), restrained slate neutrals, and semantic status colors layered with marketing display headings.',
      colorsHeading: 'Color Palette Specimens',
      typographyHeading: 'Marketing Display Scale vs Body Rhythm',
      primarySwatchName: 'Trust Blue (Primary 600)',
      primaryDarkSwatchName: 'Deep Navy (Primary 900)',
      surfaceSwatchName: 'Card Surface',
      successSwatchName: 'Approved / Paid (Success 600)',
      warningSwatchName: 'Pending / Draft (Warning 600)',
      errorSwatchName: 'Overdue / Error (Error 600)',
      typeSpecimens: {
        display2xl: 'Display 2XL · 56px — Global Payroll Command',
        displayXl: 'Display XL · 48px — Country-Configurable Core',
        displayLg: 'Display LG · 40px — Offline-First Attendance',
        displayMd: 'Display MD · 32px — Dynamic Formula Rules',
        leadLg: 'Lead LG · 20px — Designed for HR teams, finance officers, and multi-branch operations.',
        body: 'Body Base · 14px — High legibility with 12:1 contrast ratio on slate neutral canvas.',
      },
    },
    buttons: {
      eyebrow: '02 · Interactive Controls',
      title: 'Button Variants & Accessible States',
      subtitle: 'Minimum 44px touch targets on primary actions with WCAG AA focus rings.',
      variantPrimary: 'Primary Action',
      variantSecondary: 'Secondary Slate',
      variantOutline: 'Outline Surface',
      variantGhost: 'Ghost Link',
      variantInverse: 'Inverse (Dark Bg)',
      sizeSm: 'Small',
      sizeMd: 'Medium (Default)',
      sizeLg: 'Large Hero CTA',
    },
    heroSection: {
      eyebrow: '03 · Hero Pattern',
      title: 'Split & Centered Hero Architecture',
      subtitle: 'Subtle blueprint background grid, restrained eyebrow pill, dual CTAs, and proof bar.',
      sampleEyebrow: 'Payroll & Compliance Engine',
      sampleTitle: 'Run accurate multi-country payroll without manual spreadsheets.',
      sampleSubtitle:
        'Effective-dated statutory brackets, automated attendance reconciliation, and locked audit snapshots in one unified system.',
      samplePrimaryCta: 'Start Free Trial',
      sampleSecondaryCta: 'View Sample Payslip',
      samplePreviewTitle: 'Payroll Run #PR-2026-11',
      samplePreviewBadge: 'Finalized & Locked',
      samplePreviewMetric1Label: 'Employees Processed',
      samplePreviewMetric1Value: '148',
      samplePreviewMetric2Label: 'Statutory Rules Version',
      samplePreviewMetric2Value: 'v2026.04',
      samplePreviewMetric3Label: 'Audit Entries Recorded',
      samplePreviewMetric3Value: '412',
    },
    featureCards: {
      eyebrow: '04 · Feature Cards',
      title: 'Capability & Roadmap Cards',
      subtitle:
        'Supports live Phase 1 features alongside clearly marked Phase 2/3 "Coming soon" capabilities.',
      cards: {
        payroll: {
          title: 'Payroll Processing & Payslips',
          description:
            'Automated gross-to-net calculations, tax withholdings, itemized payslips, and bank export files with deterministic re-runs.',
          cta: 'Explore Payroll',
          bullets: ['Effective-dated tax brackets', 'Locked finalized runs', 'Audit-logged adjustments'],
        },
        attendance: {
          title: 'Geofenced & Offline Attendance',
          description:
            'Employees clock in via mobile even without network connectivity. Client-generated UUIDs prevent duplicates on sync.',
          cta: 'Explore Attendance',
          bullets: ['Offline SQLite queue', 'GPS geofence verification', 'Server timestamp authority'],
        },
        workflows: {
          title: 'Visual Approval Workflow Builder',
          description:
            'Multi-stage routing rules for leave requests, overtime claims, and payroll sign-offs tailored by department.',
          badge: 'Coming soon',
          cta: 'Phase 2 Roadmap',
          bullets: ['Role-based escalation', 'Delegation during leave', 'Full approval history'],
        },
      },
    },
    pricingCards: {
      eyebrow: '05 · Pricing Cards',
      title: 'Payroll-Clear Tier Presentation',
      subtitle: 'Tabulated monospace figures, clear pricing models, and explicit seat limits.',
      starter: {
        name: 'Starter',
        description: 'Core HRIS, offline mobile attendance, and single-country statutory payroll.',
        price: '$4',
        unit: '/ employee / month',
        limitNote: 'Up to 50 active employees',
        cta: 'Start 14-Day Trial',
        features: [
          { label: 'Core HRIS & Org Hierarchy', included: true },
          { label: 'Country-Configurable Payroll', included: true },
          { label: 'Offline Mobile Attendance', included: true },
          { label: 'Custom Approval Workflows', included: false },
        ],
      },
      business: {
        name: 'Business',
        badge: 'Most Popular',
        description: 'Multi-branch operations, dynamic overtime rules, and full GL accounting export.',
        price: '$8',
        unit: '/ employee / month',
        limitNote: 'Up to 250 active employees',
        cta: 'Start 14-Day Trial',
        features: [
          { label: 'Everything in Starter', included: true },
          { label: 'Shift Roster & Overtime Engine', included: true },
          { label: 'Multi-Currency & Multi-Branch', included: true },
          { label: 'Priority SLA & Audit Vault', included: true },
        ],
      },
      enterprise: {
        name: 'Enterprise',
        description: 'Custom statutory rule authoring, dedicated compliance onboarding, and priority SLA.',
        price: 'Contact sales',
        unit: 'Tailored annual agreement',
        limitNote: 'Unlimited branches & seats',
        cta: 'Contact Sales',
        features: [
          { label: 'Everything in Business', included: true },
          { label: 'Custom Country Rule Packs', included: true },
          { label: 'SAML / OIDC Single Sign-On (Coming soon)', included: false },
          { label: 'Dedicated Success Manager', included: true },
        ],
      },
    },
    containersAndCta: {
      eyebrow: '06 · Section Containers, Accordion & CTA Band',
      title: 'Rhythm & Conversion Elements',
      subtitle: 'Accessible ARIA accordion paired with high-contrast trustworthy CTA bands.',
    },
  },
  features: featuresEn,
  countries: countriesEn,
  solutions: solutionsEn,
  security: securityEn,
  company: companyEn,
  customers: customersEn,
  pricing: pricingEn,
  signup: signupEn,
  leads: leadsEn,
  login: loginEn,
  help: helpEn,
  integrations: integrationsEn,
  legal: legalEn,
  blog: blogEn,
  changelog: changelogEn,
  status: statusEn,
} as const;

export type WebsiteDictionary = typeof en;
