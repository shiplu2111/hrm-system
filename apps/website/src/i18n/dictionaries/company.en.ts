export const companyEn = {
  about: {
    metaTitle: 'About CMSN-HR | Mission, Story & Product Principles',
    metaDescription:
      'Learn why we built CMSN-HR: multi-tenant HR, configurable country payroll rules, offline-first mobile attendance, and transparent audit controls.',
    eyebrow: 'About CMSN-HR',
    title: 'Payroll and workforce infrastructure built for real operating rules.',
    subtitle:
      'We build multi-tenant HR, attendance, and payroll software for businesses managing teams across locations, shifts, and borders — without brittle spreadsheets or hard-coded workarounds.',
    mission: {
      eyebrow: 'Our Mission',
      title: 'Make accurate, compliant people operations straightforward to run',
      description:
        'HR and finance teams should not have to maintain manual spreadsheets or wait on engineering patches whenever a tax bracket, leave policy, overtime rule, or public holiday changes. CMSN-HR puts configurable rule resolution, verified attendance, and immutable payroll into one auditable workspace.',
      highlights: [
        {
          label: 'Architecture',
          value: 'Multi-tenant SaaS with strict workspace isolation',
        },
        {
          label: 'Rule Resolution',
          value: 'Global → Country → State → Company → Contract',
        },
        {
          label: 'Attendance Truth',
          value: 'Offline-capable mobile capture with server timestamps',
        },
      ],
    },
    story: {
      eyebrow: 'Our Story',
      title: 'Why we started building a rule-driven workforce platform',
      paragraphs: [
        'Growing employers routinely outgrow simple spreadsheets long before heavyweight enterprise HR suites make sense. Worse, many tools embed country-specific tax formulas, leave entitlements, and overtime logic directly inside application code — turning routine regulatory updates or multi-country expansion into engineering bottlenecks.',
        'We designed CMSN-HR around separation of policy from code. Statutory tables, leave policies, and shift rules live in versioned, effective-dated records resolved in order from global defaults down to individual employee contracts. When a payroll run is finalized, those calculated outputs lock cleanly and any correction is tracked as a separate linked adjustment.',
        'Because work happens in warehouses, client sites, retail branches, and remote offices, we paired that payroll engine with offline-first mobile attendance. Field staff can clock in, log breaks, and submit leave requests offline with unique client IDs, while server-side validation reconciles time anomalies cleanly before payroll runs.',
      ],
    },
    principles: {
      eyebrow: 'How We Build',
      title: 'Four engineering commitments behind every release',
      description:
        'These principles govern our data model, APIs, and product workflows across the platform.',
      items: [
        {
          id: 'config-over-code',
          title: 'Configuration over hard-coding',
          description:
            'Country rules, tax brackets, public holidays, and overtime multipliers resolve through effective-dated database rules rather than branch-heavy application code.',
        },
        {
          id: 'deterministic-payroll',
          title: 'Deterministic, auditable payroll',
          description:
            'Identical inputs and rule versions produce identical outputs. Finalized runs remain locked, and every financial mutation records an immutable audit trail entry.',
        },
        {
          id: 'offline-resilience',
          title: 'Offline-first field reliability',
          description:
            'Mobile attendance, breaks, and leave submissions use client-generated UUIDs for idempotent replay alongside authoritative server timestamps.',
        },
        {
          id: 'tenant-privacy',
          title: 'Privacy and strict tenant isolation',
          description:
            'Every business record is scoped to the authenticated workspace, sensitive identifiers are masked and encrypted, and platform support access requires owner consent.',
        },
      ],
    },
    team: {
      eyebrow: 'Team & Leadership',
      title: 'Team & Leadership Profiles',
      description:
        'Public leadership profiles and verified photography will appear here once approved for publication.',
      placeholderNotice:
        'Notice: Profiles below are intentionally marked placeholders until verified team names, roles, biographies, and photos are provided. No fabricated individuals are listed.',
      photoPendingLabel: '[TEAM MEMBER PHOTO PENDING]',
      rolePendingBadge: '[PROFILE PENDING]',
      slots: [
        {
          id: 'slot-1',
          slotTitle: 'Leadership Slot 01',
          name: '[TEAM MEMBER NAME PENDING]',
          role: '[TITLE / FUNCTION PENDING]',
          bio: '[BIO PENDING — Confirmed biography, background, and responsibilities will be published here once approved.]',
        },
        {
          id: 'slot-2',
          slotTitle: 'Leadership Slot 02',
          name: '[TEAM MEMBER NAME PENDING]',
          role: '[TITLE / FUNCTION PENDING]',
          bio: '[BIO PENDING — Confirmed biography, background, and responsibilities will be published here once approved.]',
        },
        {
          id: 'slot-3',
          slotTitle: 'Leadership Slot 03',
          name: '[TEAM MEMBER NAME PENDING]',
          role: '[TITLE / FUNCTION PENDING]',
          bio: '[BIO PENDING — Confirmed biography, background, and responsibilities will be published here once approved.]',
        },
      ],
    },
    exploreMore: {
      title: 'Explore how the platform operates',
      securityTitle: 'Security, Isolation & Trust',
      securityBody:
        'Review our implemented multi-tenant isolation, AES field encryption, RBAC, immutable audit logs, backups, and consent-based support access.',
      securityCta: 'Read Security & Trust',
      careersTitle: 'Careers at CMSN-HR',
      careersBody:
        'See how we work, explore our engineering principles, and check for open roles listed on our careers feed.',
      careersCta: 'Visit Careers',
    },
    cta: {
      heading: 'See how CMSN-HR fits your team',
      body: 'Start a trial workspace in the portal or talk with us about your payroll frequency, locations, and attendance workflows.',
      primaryCta: 'Start free trial',
      secondaryCta: 'Book a demo',
    },
  },
  careers: {
    metaTitle: 'Careers at CMSN-HR | Open Positions & Engineering Culture',
    metaDescription:
      'Explore open positions and how we build multi-tenant HR, configurable payroll rules, and offline-first workforce software at CMSN-HR.',
    eyebrow: 'Careers',
    phaseBadge: 'Phase 2 · Backed by careers data feed',
    title: 'Help build dependable HR and payroll software.',
    subtitle:
      'We focus on software correctness, multi-tenant data isolation, configurable statutory engines, and offline-capable mobile experiences for real operational teams.',
    openings: {
      eyebrow: 'Open Roles',
      title: 'Current openings',
      description:
        'Positions below are loaded from a typed careers data source and are structured to connect directly to our platform recruitment feed when public hiring opens.',
      countSuffix: 'open positions',
      countSingleSuffix: 'open position',
      applyCta: 'Ask about this role',
      remoteLabel: 'Remote / Hybrid',
      departmentLabel: 'Team',
      locationLabel: 'Location',
      empty: {
        title: 'No open positions posted right now',
        body: 'We do not have active job postings listed on the public board at this moment. Rather than displaying placeholder vacancies as live jobs, we keep this list accurate. Reach out through our contact page if you would like to introduce your work.',
        primaryCta: 'Contact our team',
        secondaryCta: 'Learn about our platform',
      },
    },
    culture: {
      eyebrow: 'How We Work',
      title: 'Principles that guide engineering and product work',
      description:
        'Our codebase serves HR officers, payroll administrators, and frontline staff — reliability and clarity matter on every PR.',
      items: [
        {
          id: 'correctness',
          title: 'Financial and data correctness first',
          description:
            'Decimal arithmetic, versioned statutory dates, idempotent sync keys, and test verification come ahead of quick hacks.',
        },
        {
          id: 'ownership',
          title: 'Full-stack product ownership',
          description:
            'Product builders reason across database constraints, API response contracts, role permissions, and accessible interfaces.',
        },
        {
          id: 'documentation',
          title: 'Clear architecture documentation',
          description:
            'System contracts for payroll, offline sync, security, and UI guidelines live in versioned documentation alongside implementation.',
        },
        {
          id: 'honesty',
          title: 'No inflated claims',
          description:
            'We document implemented capabilities transparently — in engineering specs, security reviews, and public product communication.',
        },
      ],
    },
    cta: {
      heading: 'Interested in working together or evaluating CMSN-HR?',
      body: 'Get in touch with our team or start exploring the product directly in the client portal.',
      primaryCta: 'Start free trial',
      secondaryCta: 'Contact us',
    },
  },
} as const;
