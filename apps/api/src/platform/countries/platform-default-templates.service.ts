import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  PlatformTemplateCategory,
  Prisma,
  RuleVersionStatus,
} from '@prisma/client';
import type {
  DefaultDocumentTypeItem,
  DefaultLeavePolicyItem,
  DefaultNotificationTemplateItem,
  DefaultOnboardingChecklistTemplate,
  DefaultRoleItem,
  EffectiveProvisioningTemplatesResponse,
  PlatformDefaultTemplate as PlatformDefaultTemplateType,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import type {
  CreatePlatformTemplateDto,
  PublishPlatformTemplateDto,
  QueryPlatformTemplatesDto,
  UpdatePlatformTemplateDto,
} from './dto/platform-templates.dto';

// Built-in hardcoded fallbacks in case database has no templates seeded yet
export const GLOBAL_DEFAULT_ROLES: DefaultRoleItem[] = [
  {
    name: 'Company Owner',
    description: 'Tenant organization owner with cross-module executive control',
    dataScope: 'all',
    permissions: [
      {
        module: 'employee',
        actions: ['view', 'create', 'edit', 'delete', 'approve', 'finalize'],
      },
      {
        module: 'payroll',
        actions: ['view', 'create', 'edit', 'delete', 'approve', 'finalize'],
      },
      {
        module: 'attendance',
        actions: ['view', 'create', 'edit', 'delete', 'approve', 'finalize'],
      },
      {
        module: 'leave',
        actions: ['view', 'create', 'edit', 'delete', 'approve', 'finalize'],
      },
      {
        module: 'roster',
        actions: ['view', 'create', 'edit', 'delete', 'approve', 'finalize'],
      },
      {
        module: 'settings',
        actions: ['view', 'create', 'edit', 'delete', 'approve', 'finalize'],
      },
      {
        module: 'documents',
        actions: ['view', 'create', 'edit', 'delete', 'approve', 'finalize'],
      },
      {
        module: 'audit',
        actions: ['view', 'create', 'edit', 'delete', 'approve', 'finalize'],
      },
      {
        module: 'billing',
        actions: ['view', 'create', 'edit', 'delete', 'approve', 'finalize'],
      },
      {
        module: 'support',
        actions: ['view', 'create', 'edit', 'delete', 'approve', 'finalize'],
      },
    ],
  },
  {
    name: 'HR Admin',
    description: 'Human Resources Administrator managing staff, leave, and documents',
    dataScope: 'all',
    permissions: [
      {
        module: 'employee',
        actions: ['view', 'create', 'edit', 'delete', 'approve'],
      },
      {
        module: 'leave',
        actions: ['view', 'create', 'edit', 'delete', 'approve'],
      },
      {
        module: 'attendance',
        actions: ['view', 'create', 'edit', 'approve'],
      },
      {
        module: 'documents',
        actions: ['view', 'create', 'edit', 'delete', 'approve'],
      },
      {
        module: 'onboarding',
        actions: ['view', 'create', 'edit', 'delete', 'approve'],
      },
      {
        module: 'recruitment',
        actions: ['view', 'create', 'edit', 'delete', 'approve'],
      },
    ],
  },
  {
    name: 'Payroll Admin',
    description: 'Finance and compensation administrator',
    dataScope: 'all',
    permissions: [
      {
        module: 'payroll',
        actions: ['view', 'create', 'edit', 'approve', 'finalize'],
      },
      { module: 'attendance', actions: ['view', 'approve'] },
      { module: 'employee', actions: ['view'] },
      { module: 'settings', actions: ['view', 'edit'] },
    ],
  },
  {
    name: 'Manager',
    description: 'Team lead and direct supervisor',
    dataScope: 'team',
    permissions: [
      { module: 'employee', actions: ['view'] },
      { module: 'attendance', actions: ['view', 'create', 'edit', 'approve'] },
      { module: 'leave', actions: ['view', 'create', 'approve'] },
      { module: 'roster', actions: ['view', 'create', 'edit'] },
      { module: 'performance', actions: ['view', 'create', 'edit', 'approve'] },
    ],
  },
  {
    name: 'Employee',
    description: 'Standard employee self-service access',
    dataScope: 'own',
    permissions: [
      { module: 'employee', actions: ['view'] },
      { module: 'attendance', actions: ['view', 'create'] },
      { module: 'leave', actions: ['view', 'create'] },
      { module: 'documents', actions: ['view', 'create'] },
    ],
  },
  {
    name: 'Accountant',
    description: 'Financial auditor with GL journal access',
    dataScope: 'all',
    permissions: [
      { module: 'payroll', actions: ['view'] },
      { module: 'audit', actions: ['view'] },
    ],
  },
  {
    name: 'Recruiter',
    description: 'Talent acquisition specialist',
    dataScope: 'all',
    permissions: [
      {
        module: 'recruitment',
        actions: ['view', 'create', 'edit', 'delete'],
      },
      { module: 'onboarding', actions: ['view', 'create', 'edit'] },
    ],
  },
];

export const GLOBAL_DEFAULT_DOC_TYPES: DefaultDocumentTypeItem[] = [
  {
    name: 'National ID / Passport',
    description: 'Government-issued photo identification documentation',
    scope: 'employee',
    requiresVerification: true,
    tracksExpiry: true,
  },
  {
    name: 'Bank Direct Deposit Details',
    description: 'Proof of banking account and routing details for automated payroll disbursement',
    scope: 'employee',
    requiresVerification: true,
    tracksExpiry: false,
  },
  {
    name: 'Employee Handbook Acknowledgment',
    description: 'Signed acknowledgement of company policies, health and safety, and work standards',
    scope: 'employee',
    requiresVerification: true,
    tracksExpiry: false,
  },
  {
    name: 'Code of Conduct & Confidentiality Agreement',
    description: 'Executed proprietary information and mutual confidentiality agreement',
    scope: 'employee',
    requiresVerification: false,
    tracksExpiry: false,
  },
  {
    name: 'Emergency Contact Form',
    description: 'Next-of-kin emergency contact and medical contingency details',
    scope: 'employee',
    requiresVerification: false,
    tracksExpiry: false,
  },
];

export const GLOBAL_DEFAULT_LEAVE_POLICIES: DefaultLeavePolicyItem[] = [
  {
    name: 'Annual Leave',
    code: 'ANNUAL',
    isPaid: true,
    entitlementDays: 14,
    accrualType: 'yearly',
    carryForwardMax: 5,
    expiryMonths: 12,
    encashmentAllowed: true,
    probationRestricted: true,
    allowNegativeBalance: false,
    halfDayAllowed: true,
    deductPublicHolidays: true,
    approvalSteps: [{ roleName: 'Manager' }, { roleName: 'HR Admin' }],
  },
  {
    name: 'Sick Leave',
    code: 'SICK',
    isPaid: true,
    entitlementDays: 10,
    accrualType: 'yearly',
    carryForwardMax: 0,
    expiryMonths: null,
    encashmentAllowed: false,
    probationRestricted: false,
    allowNegativeBalance: false,
    halfDayAllowed: true,
    deductPublicHolidays: true,
    approvalSteps: [{ roleName: 'Manager' }],
  },
  {
    name: 'Unpaid Leave',
    code: 'UNPAID',
    isPaid: false,
    entitlementDays: 30,
    accrualType: 'none',
    carryForwardMax: 0,
    expiryMonths: null,
    encashmentAllowed: false,
    probationRestricted: false,
    allowNegativeBalance: false,
    halfDayAllowed: true,
    deductPublicHolidays: false,
    approvalSteps: [{ roleName: 'Manager' }, { roleName: 'HR Admin' }],
  },
];

export const GLOBAL_DEFAULT_NOTIFICATION_TEMPLATES: DefaultNotificationTemplateItem[] = [
  {
    key: 'leave_request_submitted',
    title: 'Leave Request Submitted',
    channels: ['in_app', 'email'],
    subject: 'Leave request pending review',
    body: 'A leave request has been submitted by {{employeeName}} for {{days}} day(s).',
    variables: ['employeeName', 'days', 'leaveType', 'startDate', 'endDate'],
  },
  {
    key: 'leave_request_approved',
    title: 'Leave Request Approved',
    channels: ['in_app', 'email'],
    subject: 'Your leave request has been approved',
    body: 'Your leave request for {{days}} day(s) from {{startDate}} to {{endDate}} was approved.',
    variables: ['employeeName', 'days', 'startDate', 'endDate'],
  },
  {
    key: 'payslip_published',
    title: 'Payslip Published',
    channels: ['in_app', 'email'],
    subject: 'Your payslip for {{period}} is ready',
    body: 'Your payslip for period {{period}} has been generated and is now viewable in the portal.',
    variables: ['employeeName', 'period', 'netPay'],
  },
  {
    key: 'company_invitation',
    title: 'Tenant Member Invitation',
    channels: ['email'],
    subject: 'Welcome to {{companyName}} on CMSN-HR',
    body: 'You have been invited to join {{companyName}} as {{roleName}}. Click here to activate your account: {{inviteUrl}}',
    variables: ['companyName', 'roleName', 'inviteUrl'],
  },
  {
    key: 'onboarding_task_assigned',
    title: 'Onboarding Action Required',
    channels: ['in_app', 'email'],
    subject: 'New onboarding step assigned: {{taskTitle}}',
    body: 'You have a new onboarding action assigned for {{companyName}}: {{taskTitle}}. Due by {{dueDate}}.',
    variables: ['companyName', 'taskTitle', 'dueDate', 'assigneeLabel'],
  },
];

export const GLOBAL_DEFAULT_ONBOARDING_CHECKLIST: DefaultOnboardingChecklistTemplate = {
  name: 'Standard Cross-Functional Onboarding Checklist',
  description: 'Default 7-step checklist for new employee onboarding, document verification, and asset allocation',
  isDefault: true,
  items: [
    {
      title: 'Submit Government Photo Identification',
      description: 'Upload valid passport, national ID, or state driving license for identity verification',
      category: 'document_collection',
      taskType: 'document_collection',
      documentTypeName: 'National ID / Passport',
      assigneeLabel: 'Employee',
      dueDaysOffset: 1,
      isRequired: true,
    },
    {
      title: 'Direct Deposit & Bank Details Submission',
      description: 'Provide banking account and routing details for electronic payroll dispatches',
      category: 'document_collection',
      taskType: 'document_collection',
      documentTypeName: 'Bank Direct Deposit Details',
      assigneeLabel: 'Employee',
      dueDaysOffset: 2,
      isRequired: true,
    },
    {
      title: 'Read & Acknowledge Employee Handbook',
      description: 'Review statutory standards, company policies, and workplace conduct expectations',
      category: 'policy_acceptance',
      taskType: 'policy_acceptance',
      documentTypeName: 'Employee Handbook Acknowledgment',
      assigneeLabel: 'Employee',
      dueDaysOffset: 3,
      isRequired: true,
    },
    {
      title: 'Sign Confidentiality & Code of Conduct Agreement',
      description: 'Acknowledge proprietary rights, intellectual property protection, and security policies',
      category: 'policy_acceptance',
      taskType: 'policy_acceptance',
      documentTypeName: 'Code of Conduct & Confidentiality Agreement',
      assigneeLabel: 'Employee',
      dueDaysOffset: 3,
      isRequired: true,
    },
    {
      title: 'Workstation & Hardware Handover',
      description: 'Assign laptop, security keys, and physical workplace equipment',
      category: 'equipment_provisioning',
      taskType: 'provisioning',
      assigneeLabel: 'IT Support',
      dueDaysOffset: 1,
      isRequired: true,
    },
    {
      title: 'Provision Corporate Email & System Access',
      description: 'Create Google Workspace / M365 account, Slack workspace, and internal platform access',
      category: 'system_access',
      taskType: 'manual_task',
      assigneeLabel: 'IT Support',
      dueDaysOffset: 0,
      isRequired: true,
    },
    {
      title: '1-on-1 Welcome & Role Orientation Meeting',
      description: 'Initial introduction session with line manager to outline goals and first 30 days plan',
      category: 'general',
      taskType: 'manual_task',
      assigneeLabel: 'Line Manager',
      dueDaysOffset: 7,
      isRequired: true,
    },
  ],
};

@Injectable()
export class PlatformDefaultTemplatesService implements OnModuleInit {
  private readonly logger = new Logger(PlatformDefaultTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PlatformAuditService,
  ) {}

  async onModuleInit() {
    await this.seedBaselineTemplatesIfEmpty();
  }

  /**
   * Automatically seed global and country-specific defaults (v1) if database is empty.
   */
  async seedBaselineTemplatesIfEmpty(): Promise<void> {
    try {
      const existingCount = await this.prisma.unscoped.platformDefaultTemplate.count();
      if (existingCount > 0) {
        return;
      }

      this.logger.log('Seeding baseline Platform Default Provisioning Templates (Stage C.0)...');

      // 1. Seed Global Default Templates
      const globalDefs: {
        category: PlatformTemplateCategory;
        name: string;
        description: string;
        payload: any;
      }[] = [
        {
          category: PlatformTemplateCategory.default_roles,
          name: 'Global Standard RBAC Roles & Permissions',
          description: 'Standard 7-tier role definitions (Owner, HR Admin, Payroll Admin, Manager, Employee, Accountant, Recruiter)',
          payload: GLOBAL_DEFAULT_ROLES,
        },
        {
          category: PlatformTemplateCategory.document_types,
          name: 'Global Standard Document Types',
          description: 'Identity verification, banking direct deposit, handbook acknowledgement, and code of conduct',
          payload: GLOBAL_DEFAULT_DOC_TYPES,
        },
        {
          category: PlatformTemplateCategory.leave_policies,
          name: 'Global Baseline Leave Policies',
          description: 'Standard 14 days annual leave, 10 days sick leave, and unpaid leave with multi-step approvals',
          payload: GLOBAL_DEFAULT_LEAVE_POLICIES,
        },
        {
          category: PlatformTemplateCategory.notification_templates,
          name: 'Global Core Notification Templates',
          description: 'Baseline templates for leave requests, payslip publication, member invitations, and onboarding alerts',
          payload: GLOBAL_DEFAULT_NOTIFICATION_TEMPLATES,
        },
        {
          category: PlatformTemplateCategory.onboarding_checklists,
          name: 'Global Standard Onboarding Checklist',
          description: '7-step comprehensive onboarding flow for document collection, policy sign-off, and hardware provisioning',
          payload: GLOBAL_DEFAULT_ONBOARDING_CHECKLIST,
        },
      ];

      for (const def of globalDefs) {
        await this.prisma.unscoped.platformDefaultTemplate.create({
          data: {
            countryId: null,
            category: def.category,
            version: 1,
            name: def.name,
            description: def.description,
            status: RuleVersionStatus.published,
            payload: def.payload as unknown as Prisma.InputJsonValue,
            effectiveFrom: new Date('2026-01-01'),
            effectiveTo: null,
            changeSummary: 'Initial platform baseline seed (Stage C.0)',
            sourceReference: 'Global Platform Baseline Standard',
            createdBy: 'system',
            approvedBy: 'system',
            approvedAt: new Date(),
          },
        });
      }

      // 2. Seed Country-Specific Baseline for Australia (Fair Work NES)
      const auCountry = await this.prisma.unscoped.country.findFirst({
        where: { isoCode: 'AUS' },
      });

      if (auCountry) {
        const auLeavePolicies: DefaultLeavePolicyItem[] = [
          {
            name: 'Annual Leave (NES 4 Weeks)',
            code: 'ANNUAL',
            isPaid: true,
            entitlementDays: 20,
            accrualType: 'yearly',
            carryForwardMax: 20,
            expiryMonths: null,
            encashmentAllowed: true,
            probationRestricted: false,
            allowNegativeBalance: false,
            halfDayAllowed: true,
            deductPublicHolidays: true,
            approvalSteps: [{ roleName: 'Manager' }, { roleName: 'HR Admin' }],
          },
          {
            name: "Personal / Carer's Leave (NES 10 Days)",
            code: 'SICK',
            isPaid: true,
            entitlementDays: 10,
            accrualType: 'yearly',
            carryForwardMax: 10,
            expiryMonths: null,
            encashmentAllowed: false,
            probationRestricted: false,
            allowNegativeBalance: false,
            halfDayAllowed: true,
            deductPublicHolidays: true,
            approvalSteps: [{ roleName: 'Manager' }],
          },
          {
            name: 'Compassionate Leave (NES 2 Days)',
            code: 'COMPASSIONATE',
            isPaid: true,
            entitlementDays: 2,
            accrualType: 'none',
            carryForwardMax: 0,
            expiryMonths: null,
            encashmentAllowed: false,
            probationRestricted: false,
            allowNegativeBalance: false,
            halfDayAllowed: true,
            deductPublicHolidays: false,
            approvalSteps: [{ roleName: 'Manager' }],
          },
        ];

        const auDocTypes: DefaultDocumentTypeItem[] = [
          {
            name: 'Australian Passport / VEVO Visa Verification',
            description: 'Proof of Australian citizenship or valid working visa rights (Department of Home Affairs)',
            scope: 'employee',
            requiresVerification: true,
            tracksExpiry: true,
          },
          {
            name: 'Tax File Number (TFN) Declaration',
            description: 'Australian Taxation Office (ATO) statutory tax withholding declaration form',
            scope: 'employee',
            requiresVerification: true,
            tracksExpiry: false,
          },
          {
            name: 'Superannuation Standard Choice Form',
            description: 'APRA-regulated complying superannuation fund details or ATO stapled super election',
            scope: 'employee',
            requiresVerification: true,
            tracksExpiry: false,
          },
          {
            name: 'Bank Direct Entry Account Details (BSB & Account)',
            description: 'Australian BSB and bank account number for ABA electronic payroll disbursements',
            scope: 'employee',
            requiresVerification: true,
            tracksExpiry: false,
          },
          {
            name: 'Fair Work Information Statement (FWIS) Sign-Off',
            description: 'Mandatory statutory Fair Work Ombudsman Information Statement acknowledgement',
            scope: 'employee',
            requiresVerification: true,
            tracksExpiry: false,
          },
        ];

        const auChecklist: DefaultOnboardingChecklistTemplate = {
          name: 'Australia Fair Work Compliant Onboarding Checklist',
          description: 'ATO TFN declaration, Superannuation choice, and Fair Work Ombudsman compliance flow',
          isDefault: true,
          items: [
            {
              title: 'Upload Australian Passport or VEVO Visa Document',
              description: 'Required verification of legal working rights in Australia before first payroll cycle',
              category: 'document_collection',
              taskType: 'document_collection',
              documentTypeName: 'Australian Passport / VEVO Visa Verification',
              assigneeLabel: 'Employee',
              dueDaysOffset: 1,
              isRequired: true,
            },
            {
              title: 'Complete ATO Tax File Number (TFN) Declaration',
              description: 'Statutory ATO declaration to determine correct marginal withholding tax rate',
              category: 'document_collection',
              taskType: 'document_collection',
              documentTypeName: 'Tax File Number (TFN) Declaration',
              assigneeLabel: 'Employee',
              dueDaysOffset: 2,
              isRequired: true,
            },
            {
              title: 'Submit Superannuation Standard Choice Form',
              description: 'Nominate complying APRA super fund or indicate use of employer default fund',
              category: 'document_collection',
              taskType: 'document_collection',
              documentTypeName: 'Superannuation Standard Choice Form',
              assigneeLabel: 'Employee',
              dueDaysOffset: 2,
              isRequired: true,
            },
            {
              title: 'Provide Australian BSB and Bank Account Details',
              description: 'Direct entry banking details for automated payroll disbursements',
              category: 'document_collection',
              taskType: 'document_collection',
              documentTypeName: 'Bank Direct Entry Account Details (BSB & Account)',
              assigneeLabel: 'Employee',
              dueDaysOffset: 2,
              isRequired: true,
            },
            {
              title: 'Acknowledge Fair Work Information Statement',
              description: 'Review statutory rights under the Fair Work Act 2009 and sign acknowledgement',
              category: 'policy_acceptance',
              taskType: 'policy_acceptance',
              documentTypeName: 'Fair Work Information Statement (FWIS) Sign-Off',
              assigneeLabel: 'Employee',
              dueDaysOffset: 3,
              isRequired: true,
            },
            {
              title: 'Hardware & Workstation IT Provisioning',
              description: 'Configure corporate workstation and security credentials',
              category: 'equipment_provisioning',
              taskType: 'provisioning',
              assigneeLabel: 'IT Support',
              dueDaysOffset: 1,
              isRequired: true,
            },
          ],
        };

        await this.prisma.unscoped.platformDefaultTemplate.createMany({
          data: [
            {
              countryId: auCountry.id,
              category: PlatformTemplateCategory.leave_policies,
              version: 1,
              name: 'Australia Fair Work (NES) Leave Policies',
              description: 'Statutory National Employment Standards (NES) 4-week annual leave, 10-day personal leave, and compassionate leave',
              status: RuleVersionStatus.published,
              payload: auLeavePolicies as unknown as Prisma.InputJsonValue,
              effectiveFrom: new Date('2026-01-01'),
              changeSummary: 'Fair Work Act 2009 baseline NES compliance (Stage C.0)',
              sourceReference: 'Fair Work Act 2009 (Cth) Part 2-2',
              createdBy: 'system',
              approvedBy: 'system',
              approvedAt: new Date(),
            },
            {
              countryId: auCountry.id,
              category: PlatformTemplateCategory.document_types,
              version: 1,
              name: 'Australia Statutory Onboarding Documents',
              description: 'TFN declaration, Superannuation choice, Australian direct entry banking, and Fair Work Information Statement',
              status: RuleVersionStatus.published,
              payload: auDocTypes as unknown as Prisma.InputJsonValue,
              effectiveFrom: new Date('2026-01-01'),
              changeSummary: 'ATO and Fair Work Ombudsman statutory onboarding documentation standards',
              sourceReference: 'ATO Tax Administration Act 1953 & FW Act 2009',
              createdBy: 'system',
              approvedBy: 'system',
              approvedAt: new Date(),
            },
            {
              countryId: auCountry.id,
              category: PlatformTemplateCategory.onboarding_checklists,
              version: 1,
              name: 'Australia Fair Work Compliant Onboarding Checklist',
              description: 'Statutory 6-step checklist including ATO TFN declaration, Super Choice, and FWIS sign-off',
              status: RuleVersionStatus.published,
              payload: auChecklist as unknown as Prisma.InputJsonValue,
              effectiveFrom: new Date('2026-01-01'),
              changeSummary: 'Fair Work Act statutory onboarding workflow',
              sourceReference: 'Fair Work Ombudsman Onboarding Guide',
              createdBy: 'system',
              approvedBy: 'system',
              approvedAt: new Date(),
            },
          ],
        });
      }

      this.logger.log('Successfully seeded platform default templates.');
    } catch (err: any) {
      this.logger.warn(`Failed to seed baseline default templates: ${err.message}`);
    }
  }

  /**
   * Resolves the 5 effective published templates for a country at the given calculation date.
   * Chain: Country-specific published -> Global published -> System Hardcoded Fallback
   * Changing a template affects only newly provisioned tenants, never existing ones!
   */
  async getEffectiveTemplatesForCountry(
    countryId?: string | null,
    asOfDate: Date = new Date(),
  ): Promise<EffectiveProvisioningTemplatesResponse> {
    const categories: PlatformTemplateCategory[] = [
      PlatformTemplateCategory.document_types,
      PlatformTemplateCategory.leave_policies,
      PlatformTemplateCategory.notification_templates,
      PlatformTemplateCategory.default_roles,
      PlatformTemplateCategory.onboarding_checklists,
    ];

    let countryInfo: { id: string; name: string; isoCode: string } | null = null;
    if (countryId) {
      const foundCountry = await this.prisma.unscoped.country.findUnique({
        where: { id: countryId },
        select: { id: true, name: true, isoCode: true },
      });
      if (foundCountry) {
        countryInfo = foundCountry;
      }
    }

    const templates: Partial<Record<PlatformTemplateCategory, PlatformDefaultTemplateType>> = {};
    const sources: Record<PlatformTemplateCategory, 'country' | 'global' | 'system_fallback'> = {
      document_types: 'system_fallback',
      leave_policies: 'system_fallback',
      notification_templates: 'system_fallback',
      default_roles: 'system_fallback',
      onboarding_checklists: 'system_fallback',
    };

    for (const cat of categories) {
      let resolved: any = null;
      let source: 'country' | 'global' | 'system_fallback' = 'system_fallback';

      // 1. Check Country-Specific Active Published Template
      if (countryId) {
        resolved = await this.prisma.unscoped.platformDefaultTemplate.findFirst({
          where: {
            countryId,
            category: cat,
            status: RuleVersionStatus.published,
            effectiveFrom: { lte: asOfDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
          },
          orderBy: { version: 'desc' },
          include: {
            country: { select: { id: true, name: true, isoCode: true } },
          },
        });
        if (resolved) {
          source = 'country';
        }
      }

      // 2. Check Global Active Published Template
      if (!resolved) {
        resolved = await this.prisma.unscoped.platformDefaultTemplate.findFirst({
          where: {
            countryId: null,
            category: cat,
            status: RuleVersionStatus.published,
            effectiveFrom: { lte: asOfDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
          },
          orderBy: { version: 'desc' },
          include: {
            country: { select: { id: true, name: true, isoCode: true } },
          },
        });
        if (resolved) {
          source = 'global';
        }
      }

      // 3. Fallback to System In-Memory Constants if neither exist in DB
      if (!resolved) {
        resolved = this.getSystemFallbackTemplate(cat);
        source = 'system_fallback';
      }

      templates[cat] = {
        id: resolved.id,
        countryId: resolved.countryId ?? null,
        category: resolved.category,
        version: resolved.version,
        name: resolved.name,
        description: resolved.description ?? null,
        status: resolved.status,
        payload: resolved.payload,
        effectiveFrom: resolved.effectiveFrom instanceof Date ? resolved.effectiveFrom.toISOString().slice(0, 10) : String(resolved.effectiveFrom),
        effectiveTo: resolved.effectiveTo ? (resolved.effectiveTo instanceof Date ? resolved.effectiveTo.toISOString().slice(0, 10) : String(resolved.effectiveTo)) : null,
        changeSummary: resolved.changeSummary ?? null,
        sourceReference: resolved.sourceReference ?? null,
        createdBy: resolved.createdBy ?? 'system',
        approvedBy: resolved.approvedBy ?? null,
        approvedAt: resolved.approvedAt ? resolved.approvedAt.toISOString() : null,
        createdAt: resolved.createdAt ? (resolved.createdAt instanceof Date ? resolved.createdAt.toISOString() : String(resolved.createdAt)) : new Date().toISOString(),
        updatedAt: resolved.updatedAt ? (resolved.updatedAt instanceof Date ? resolved.updatedAt.toISOString() : String(resolved.updatedAt)) : new Date().toISOString(),
        country: resolved.country ?? null,
      };
      sources[cat] = source;
    }

    return {
      countryId: countryInfo?.id ?? null,
      countryName: countryInfo?.name ?? 'Global Default',
      countryCode: countryInfo?.isoCode ?? 'GLB',
      templates: templates as any,
      sources,
    };
  }

  private getSystemFallbackTemplate(category: PlatformTemplateCategory) {
    let payload: any = [];
    let name = 'System Fallback Template';
    let description = 'Hardcoded platform fallback';

    switch (category) {
      case PlatformTemplateCategory.default_roles:
        payload = GLOBAL_DEFAULT_ROLES;
        name = 'System Default Roles & Permissions';
        description = 'Hardcoded default roles';
        break;
      case PlatformTemplateCategory.document_types:
        payload = GLOBAL_DEFAULT_DOC_TYPES;
        name = 'System Default Document Types';
        description = 'Hardcoded default document types';
        break;
      case PlatformTemplateCategory.leave_policies:
        payload = GLOBAL_DEFAULT_LEAVE_POLICIES;
        name = 'System Default Leave Policies';
        description = 'Hardcoded default leave policies';
        break;
      case PlatformTemplateCategory.notification_templates:
        payload = GLOBAL_DEFAULT_NOTIFICATION_TEMPLATES;
        name = 'System Default Notification Templates';
        description = 'Hardcoded notification templates';
        break;
      case PlatformTemplateCategory.onboarding_checklists:
        payload = GLOBAL_DEFAULT_ONBOARDING_CHECKLIST;
        name = 'System Default Onboarding Checklist';
        description = 'Hardcoded onboarding checklist';
        break;
    }

    return {
      id: `fallback-${category}`,
      countryId: null,
      category,
      version: 1,
      name,
      description,
      status: RuleVersionStatus.published,
      payload,
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      changeSummary: 'System fallback',
      sourceReference: 'System Internal',
      createdBy: 'system',
      approvedBy: 'system',
      approvedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      country: null,
    };
  }

  /**
   * List platform templates with multi-criteria filtering
   */
  async listTemplates(query: QueryPlatformTemplatesDto): Promise<PlatformDefaultTemplateType[]> {
    const where: Prisma.PlatformDefaultTemplateWhereInput = {};

    if (query.countryId) {
      if (query.countryId.toLowerCase() === 'global') {
        where.countryId = null;
      } else {
        where.countryId = query.countryId;
      }
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.status && query.status !== 'all') {
      where.status = query.status as RuleVersionStatus;
    }

    const records = await this.prisma.unscoped.platformDefaultTemplate.findMany({
      where,
      orderBy: [{ category: 'asc' }, { version: 'desc' }, { createdAt: 'desc' }],
      include: {
        country: { select: { id: true, name: true, isoCode: true } },
      },
    });

    return records.map((r) => this.mapToType(r));
  }

  /**
   * Get single template by ID
   */
  async getTemplateById(id: string): Promise<PlatformDefaultTemplateType> {
    const record = await this.prisma.unscoped.platformDefaultTemplate.findUnique({
      where: { id },
      include: {
        country: { select: { id: true, name: true, isoCode: true } },
      },
    });

    if (!record) {
      throw new NotFoundException(`Platform template with ID "${id}" was not found`);
    }

    return this.mapToType(record);
  }

  /**
   * Create a new template or draft version.
   * If a template for (countryId, category) already exists, automatically increments version.
   */
  async createTemplate(
    input: CreatePlatformTemplateDto,
    actorUserId: string = 'system',
  ): Promise<PlatformDefaultTemplateType> {
    const countryId = input.countryId || null;

    // Determine max version for this (countryId, category)
    const latest = await this.prisma.unscoped.platformDefaultTemplate.findFirst({
      where: {
        countryId,
        category: input.category,
      },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = latest ? latest.version + 1 : 1;
    const status = input.status === 'published' ? RuleVersionStatus.published : RuleVersionStatus.draft;
    const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();

    const created = await this.prisma.unscoped.$transaction(async (tx) => {
      // If publishing immediately, set effectiveTo on previous published version
      if (status === RuleVersionStatus.published) {
        await tx.platformDefaultTemplate.updateMany({
          where: {
            countryId,
            category: input.category,
            status: RuleVersionStatus.published,
            effectiveTo: null,
          },
          data: {
            effectiveTo: effectiveFrom,
          },
        });
      }

      return tx.platformDefaultTemplate.create({
        data: {
          countryId,
          category: input.category,
          version: nextVersion,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          status,
          payload: input.payload,
          effectiveFrom,
          effectiveTo: null,
          changeSummary: input.changeSummary?.trim() || `Created version ${nextVersion}`,
          sourceReference: input.sourceReference?.trim() || null,
          createdBy: actorUserId,
          approvedBy: status === RuleVersionStatus.published ? actorUserId : null,
          approvedAt: status === RuleVersionStatus.published ? new Date() : null,
        },
        include: {
          country: { select: { id: true, name: true, isoCode: true } },
        },
      });
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'platform_template.created',
      module: 'platform',
      recordId: created.id,
      reason: input.changeSummary || `Created template ${created.name} v${created.version}`,
      newValue: {
        id: created.id,
        category: created.category,
        version: created.version,
        countryId: created.countryId,
        status: created.status,
      },
    });

    return this.mapToType(created);
  }

  /**
   * Update a draft template. Published templates cannot be modified directly (they must be cloned as a new version).
   */
  async updateTemplate(
    id: string,
    input: UpdatePlatformTemplateDto,
    actorUserId: string = 'system',
  ): Promise<PlatformDefaultTemplateType> {
    const existing = await this.prisma.unscoped.platformDefaultTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Platform template with ID "${id}" was not found`);
    }

    if (existing.status === RuleVersionStatus.published) {
      throw new BadRequestException(
        'Published default templates are locked and immutable. To make changes, clone or create a new draft version. Changing a template will only affect tenants provisioned afterwards.',
      );
    }

    const data: Prisma.PlatformDefaultTemplateUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.payload !== undefined) data.payload = input.payload;
    if (input.effectiveFrom !== undefined) data.effectiveFrom = new Date(input.effectiveFrom);
    if (input.changeSummary !== undefined) data.changeSummary = input.changeSummary?.trim() || null;
    if (input.sourceReference !== undefined) data.sourceReference = input.sourceReference?.trim() || null;

    const updated = await this.prisma.unscoped.platformDefaultTemplate.update({
      where: { id },
      data,
      include: {
        country: { select: { id: true, name: true, isoCode: true } },
      },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'platform_template.updated',
      module: 'platform',
      recordId: updated.id,
      reason: input.changeSummary || `Updated draft template ${updated.name} v${updated.version}`,
      oldValue: { name: existing.name, payload: existing.payload },
      newValue: { name: updated.name, payload: updated.payload },
    });

    return this.mapToType(updated);
  }

  /**
   * Publish a draft template version.
   * Crucial rule: "Changing a default affects only tenants created afterwards, never existing tenants."
   */
  async publishTemplate(
    id: string,
    input: PublishPlatformTemplateDto,
    actorUserId: string = 'system',
  ): Promise<PlatformDefaultTemplateType> {
    const existing = await this.prisma.unscoped.platformDefaultTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Platform template with ID "${id}" was not found`);
    }

    if (existing.status === RuleVersionStatus.published) {
      throw new BadRequestException(`Template version ${existing.version} is already published`);
    }

    const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();

    const published = await this.prisma.unscoped.$transaction(async (tx) => {
      // 1. Close out previous published version of the same country and category
      await tx.platformDefaultTemplate.updateMany({
        where: {
          countryId: existing.countryId,
          category: existing.category,
          status: RuleVersionStatus.published,
          effectiveTo: null,
        },
        data: {
          effectiveTo: effectiveFrom,
        },
      });

      // 2. Publish target version
      return tx.platformDefaultTemplate.update({
        where: { id },
        data: {
          status: RuleVersionStatus.published,
          effectiveFrom,
          effectiveTo: null,
          approvedBy: actorUserId,
          approvedAt: new Date(),
          changeSummary: input.changeSummary || existing.changeSummary || 'Published new baseline version',
        },
        include: {
          country: { select: { id: true, name: true, isoCode: true } },
        },
      });
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'platform_template.published',
      module: 'platform',
      recordId: published.id,
      reason: input.changeSummary || `Published template version ${published.version}. NOTE: Changing a default affects only tenants created afterwards, never existing tenants.`,
      newValue: {
        id: published.id,
        category: published.category,
        version: published.version,
        effectiveFrom: published.effectiveFrom,
        status: published.status,
      },
    });

    return this.mapToType(published);
  }

  /**
   * Clone an existing template as the next draft version.
   */
  async cloneAsDraft(
    id: string,
    actorUserId: string = 'system',
  ): Promise<PlatformDefaultTemplateType> {
    const source = await this.prisma.unscoped.platformDefaultTemplate.findUnique({
      where: { id },
    });

    if (!source) {
      throw new NotFoundException(`Template with ID "${id}" was not found`);
    }

    // Determine max version for this category
    const latest = await this.prisma.unscoped.platformDefaultTemplate.findFirst({
      where: {
        countryId: source.countryId,
        category: source.category,
      },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = latest ? latest.version + 1 : source.version + 1;

    const cloned = await this.prisma.unscoped.platformDefaultTemplate.create({
      data: {
        countryId: source.countryId,
        category: source.category,
        version: nextVersion,
        name: `${source.name} (v${nextVersion} Draft)`,
        description: source.description,
        status: RuleVersionStatus.draft,
        payload: source.payload as any,
        effectiveFrom: new Date(),
        effectiveTo: null,
        changeSummary: `Cloned from v${source.version}`,
        sourceReference: source.sourceReference,
        createdBy: actorUserId,
      },
      include: {
        country: { select: { id: true, name: true, isoCode: true } },
      },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'platform_template.cloned',
      module: 'platform',
      recordId: cloned.id,
      reason: `Cloned template v${source.version} into new draft v${cloned.version}`,
      newValue: {
        id: cloned.id,
        sourceId: source.id,
        version: cloned.version,
      },
    });

    return this.mapToType(cloned);
  }

  /**
   * Archive / retire a template version
   */
  async archiveTemplate(
    id: string,
    actorUserId: string = 'system',
  ): Promise<PlatformDefaultTemplateType> {
    const existing = await this.prisma.unscoped.platformDefaultTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Template with ID "${id}" was not found`);
    }

    const archived = await this.prisma.unscoped.platformDefaultTemplate.update({
      where: { id },
      data: {
        status: RuleVersionStatus.archived,
        effectiveTo: existing.effectiveTo || new Date(),
      },
      include: {
        country: { select: { id: true, name: true, isoCode: true } },
      },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'platform_template.archived',
      module: 'platform',
      recordId: archived.id,
      reason: `Archived template version ${archived.version}`,
      newValue: { id: archived.id, status: archived.status },
    });

    return this.mapToType(archived);
  }

  private mapToType(record: any): PlatformDefaultTemplateType {
    return {
      id: record.id,
      countryId: record.countryId ?? null,
      category: record.category,
      version: record.version,
      name: record.name,
      description: record.description ?? null,
      status: record.status as any,
      payload: record.payload,
      effectiveFrom: record.effectiveFrom instanceof Date ? record.effectiveFrom.toISOString().slice(0, 10) : String(record.effectiveFrom),
      effectiveTo: record.effectiveTo ? (record.effectiveTo instanceof Date ? record.effectiveTo.toISOString().slice(0, 10) : String(record.effectiveTo)) : null,
      changeSummary: record.changeSummary ?? null,
      sourceReference: record.sourceReference ?? null,
      createdBy: record.createdBy ?? 'system',
      approvedBy: record.approvedBy ?? null,
      approvedAt: record.approvedAt ? record.approvedAt.toISOString() : null,
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
      updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : String(record.updatedAt),
      country: record.country ?? null,
    };
  }
}
