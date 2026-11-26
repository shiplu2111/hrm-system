import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  LeaveAccrualType,
  OnboardingTaskCategory,
  OnboardingTaskType,
  PermissionAction,
  Prisma,
  RoleDataScope,
  TenantStatus,
  TenantSuspensionMode,
} from '@prisma/client';
import type {
  PlatformTenantSummary,
  TenantProvisioningResult,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PlatformDefaultTemplatesService } from '../countries/platform-default-templates.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import type {
  CancelTenantDto,
  HardDeleteTenantDto,
  ProvisionTenantDto,
  RestoreTenantDto,
  ScheduleDeletionDto,
  SuspendTenantDto,
} from './dto/tenant-lifecycle.dto';

const DEFAULT_ROLES = [
  { name: 'Company Owner', dataScope: RoleDataScope.all },
  { name: 'HR Admin', dataScope: RoleDataScope.all },
  { name: 'Payroll Admin', dataScope: RoleDataScope.all },
  { name: 'Manager', dataScope: RoleDataScope.team },
  { name: 'Employee', dataScope: RoleDataScope.own },
  { name: 'Accountant', dataScope: RoleDataScope.all },
  { name: 'Recruiter', dataScope: RoleDataScope.all },
];

const DEFAULT_DOC_TYPES = [
  {
    name: 'National ID',
    description: 'Government-issued photo identification',
    requiresVerification: true,
    tracksExpiry: true,
  },
  {
    name: 'Bank Account Details',
    description: 'Bank account information for payroll direct deposit',
    requiresVerification: true,
    tracksExpiry: false,
  },
  {
    name: 'Employee Handbook Acknowledgment',
    description: 'Signed acknowledgment of the employee handbook',
    requiresVerification: true,
    tracksExpiry: false,
  },
  {
    name: 'Code of Conduct Agreement',
    description: 'Signed code of conduct and confidentiality agreement',
    requiresVerification: false,
    tracksExpiry: false,
  },
];

const DEFAULT_LEAVE_TYPES = [
  {
    name: 'Annual Leave',
    code: 'ANNUAL',
    paid: true,
    defaultDays: 14,
  },
  {
    name: 'Sick Leave',
    code: 'SICK',
    paid: true,
    defaultDays: 10,
  },
];

const DEFAULT_NOTIFICATION_TEMPLATES = [
  {
    key: 'leave_request_submitted',
    template: {
      channels: ['in_app', 'email'],
      subject: 'Leave request pending review',
      body: 'A leave request has been submitted by {{employeeName}} for {{days}} day(s).',
    },
  },
  {
    key: 'payslip_published',
    template: {
      channels: ['in_app', 'email'],
      subject: 'Your payslip for {{period}} is ready',
      body: 'Your payslip for period {{period}} has been generated and is now viewable.',
    },
  },
  {
    key: 'company_invitation',
    template: {
      channels: ['email'],
      subject: 'Welcome to {{companyName}} on CMSN-HR',
      body: 'You have been invited to join {{companyName}} as {{roleName}}. Click here to activate your account: {{inviteUrl}}',
    },
  },
];

@Injectable()
export class PlatformTenantLifecycleService {
  private readonly logger = new Logger(PlatformTenantLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PlatformAuditService,
    @Optional()
    private readonly platformDefaultTemplatesService?: PlatformDefaultTemplatesService,
    @Optional()
    private readonly maintenanceService?: MaintenanceService,
  ) {}

  /**
   * Provision a brand-new tenant workspace and all core seeded defaults.
   * Creates:
   * 1. Tenant record (trial/active)
   * 2. First Company (linked to country)
   * 3. Default Roles with initial permissions
   * 4. Default Document Types
   * 5. Default Leave Types and Policies
   * 6. Default Notification Templates (from platform settings or defaults)
   * 7. First Company Owner User
   * 8. Dispatches / logs initial invitation email
   * 9. Records audit log with mandatory reason
   */
  async provisionTenant(
    input: ProvisionTenantDto & {
      ownerPasswordHash?: string;
      mustChangePassword?: boolean;
    },
    actorUserId?: string,
  ): Promise<TenantProvisioningResult> {
    if (this.maintenanceService) {
      await this.maintenanceService.assertFeatureNotKilled('new_signups');
    }

    if (!input.reason?.trim()) {
      throw new BadRequestException(
        'A mandatory reason is required for tenant provisioning',
      );
    }

    const cleanSubdomain = input.subdomain.trim().toLowerCase();

    // Check subdomain uniqueness
    const existing = await this.prisma.unscoped.tenant.findUnique({
      where: { subdomain: cleanSubdomain },
    });
    if (existing) {
      throw new ConflictException({
        code: 'SUBDOMAIN_TAKEN',
        message: `Subdomain "${cleanSubdomain}" is already registered on this platform`,
      });
    }

    // Resolve country
    let country = input.countryCode
      ? await this.prisma.unscoped.country.findFirst({
          where: { isoCode: input.countryCode.trim().toUpperCase() },
        })
      : null;

    if (!country) {
      country = await this.prisma.unscoped.country.findFirst({
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!country) {
      // Create global default country if db is fresh
      country = await this.prisma.unscoped.country.create({
        data: {
          name: 'Global Default',
          isoCode: 'GLB',
          currency: 'USD',
          timezone: 'UTC',
          dateFormat: 'YYYY-MM-DD',
        },
      });
    }

    const isExplicitTrial = !input.planId || input.planId.toLowerCase() === 'trial';
    const trialDays = input.trialDays !== undefined ? input.trialDays : isExplicitTrial ? 14 : 0;
    const isTrial = isExplicitTrial || trialDays > 0;
    const status: TenantStatus = isTrial ? TenantStatus.trial : TenantStatus.active;
    const trialEndsAt = trialDays > 0
      ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
      : null;

    // Password hash for owner: honor self-service pre-hashed password if supplied, else generate temporary secret
    const ownerPasswordHash =
      input.ownerPasswordHash ?? (await bcrypt.hash('InitialSecure2026!#', 10));
    const ownerMustChangePassword =
      input.mustChangePassword !== undefined
        ? input.mustChangePassword
        : !input.ownerPasswordHash;

    // Resolve effective platform default templates for this tenant's country (Stage C.0)
    // Changing a default affects only tenants created afterwards, never existing tenants.
    const effectiveTemplates = this.platformDefaultTemplatesService
      ? await this.platformDefaultTemplatesService.getEffectiveTemplatesForCountry(country.id)
      : null;

    const templateVersions = effectiveTemplates
      ? {
          document_types: {
            id: effectiveTemplates.templates.document_types?.id,
            version: effectiveTemplates.templates.document_types?.version,
            source: effectiveTemplates.sources.document_types,
          },
          leave_policies: {
            id: effectiveTemplates.templates.leave_policies?.id,
            version: effectiveTemplates.templates.leave_policies?.version,
            source: effectiveTemplates.sources.leave_policies,
          },
          notification_templates: {
            id: effectiveTemplates.templates.notification_templates?.id,
            version: effectiveTemplates.templates.notification_templates?.version,
            source: effectiveTemplates.sources.notification_templates,
          },
          default_roles: {
            id: effectiveTemplates.templates.default_roles?.id,
            version: effectiveTemplates.templates.default_roles?.version,
            source: effectiveTemplates.sources.default_roles,
          },
          onboarding_checklists: {
            id: effectiveTemplates.templates.onboarding_checklists?.id,
            version: effectiveTemplates.templates.onboarding_checklists?.version,
            source: effectiveTemplates.sources.onboarding_checklists,
          },
        }
      : null;

    const result = await this.prisma.unscoped.$transaction(async (tx) => {
      // 1. Create Tenant (with recorded provisioned template versions)
      const tenant = await tx.tenant.create({
        data: {
          name: input.name.trim(),
          subdomain: cleanSubdomain,
          planId: input.planId ? input.planId.toLowerCase() : 'trial',
          status,
          storageDriver: input.storageDriver ?? 'local',
          trialEndsAt,
          provisionedTemplateVersions: templateVersions ?? undefined,
        },
      });

      // 2. Create Company
      const company = await tx.company.create({
        data: {
          tenantId: tenant.id,
          name: `${tenant.name} HQ`,
          countryId: country.id,
          financialYearStart: 1,
          payrollBaseCurrency: country.currency,
          timezone: country.timezone,
          dateFormat: country.dateFormat,
        },
      });

      // 3. Create Default Roles & Permissions (from resolved template or fallback)
      const rolesPayload = effectiveTemplates?.templates?.default_roles?.payload;
      const rolesList: any[] =
        Array.isArray(rolesPayload) && rolesPayload.length > 0
          ? rolesPayload
          : DEFAULT_ROLES;

      const roleMap: Record<string, string> = {};
      for (const roleDef of rolesList) {
        const dataScope =
          (roleDef.dataScope as RoleDataScope) || RoleDataScope.all;
        const createdRole = await tx.role.create({
          data: {
            tenantId: tenant.id,
            name: roleDef.name,
            dataScope,
          },
        });
        roleMap[roleDef.name] = createdRole.id;

        // If explicit permissions list defined, seed them
        if (Array.isArray(roleDef.permissions)) {
          for (const perm of roleDef.permissions) {
            if (perm.module && Array.isArray(perm.actions)) {
              for (const act of perm.actions) {
                const actionEnum = act as PermissionAction;
                await tx.permission.create({
                  data: {
                    roleId: createdRole.id,
                    module: perm.module,
                    action: actionEnum,
                  },
                });
              }
            }
          }
        }
      }

      // Add basic / full permissions for Company Owner if not already explicitly defined
      const ownerRoleDef = rolesList.find((r) => r.name === 'Company Owner');
      const ownerRoleId = roleMap['Company Owner'];
      if (
        ownerRoleId &&
        (!ownerRoleDef?.permissions || ownerRoleDef.permissions.length === 0)
      ) {
        const ownerModules = [
          'employee',
          'payroll',
          'attendance',
          'leave',
          'roster',
          'settings',
          'documents',
          'audit',
          'billing',
          'support',
        ];
        const actions: PermissionAction[] = [
          PermissionAction.view,
          PermissionAction.create,
          PermissionAction.edit,
          PermissionAction.delete,
          PermissionAction.approve,
          PermissionAction.finalize,
        ];

        for (const mod of ownerModules) {
          for (const act of actions) {
            await tx.permission.create({
              data: {
                roleId: ownerRoleId,
                module: mod,
                action: act,
              },
            });
          }
        }
      }

      // 4. Create Default Document Types (from resolved template or fallback)
      const docPayload = effectiveTemplates?.templates?.document_types?.payload;
      const docTypesList: any[] =
        Array.isArray(docPayload) && docPayload.length > 0
          ? docPayload
          : DEFAULT_DOC_TYPES;

      const docTypeMap: Record<string, string> = {};
      for (const doc of docTypesList) {
        const createdDoc = await tx.documentType.create({
          data: {
            companyId: company.id,
            name: doc.name,
            description: doc.description || null,
            requiresVerification: Boolean(doc.requiresVerification),
            tracksExpiry: Boolean(doc.tracksExpiry),
          },
        });
        docTypeMap[doc.name] = createdDoc.id;
      }

      // 5. Create Default Leave Types and Policies (from resolved template or fallback)
      const leavePayload = effectiveTemplates?.templates?.leave_policies?.payload;
      const leaveList: any[] =
        Array.isArray(leavePayload) && leavePayload.length > 0
          ? leavePayload
          : DEFAULT_LEAVE_TYPES;

      for (const lt of leaveList) {
        const isPaid =
          lt.isPaid !== undefined
            ? Boolean(lt.isPaid)
            : lt.paid !== undefined
              ? Boolean(lt.paid)
              : true;
        const createdLt = await tx.leaveType.create({
          data: {
            companyId: company.id,
            name: lt.name,
            isPaid,
          },
        });

        const defaultDays =
          lt.entitlementDays !== undefined
            ? lt.entitlementDays
            : lt.defaultDays !== undefined
              ? lt.defaultDays
              : 14;
        const accrualType =
          ['monthly', 'yearly', 'on_hire'].includes(lt.accrualType)
            ? (lt.accrualType as LeaveAccrualType)
            : LeaveAccrualType.yearly;

        await tx.leavePolicy.create({
          data: {
            companyId: company.id,
            leaveTypeId: createdLt.id,
            entitlementDays: new Prisma.Decimal(defaultDays),
            accrualType,
            carryForwardMax:
              lt.carryForwardMax !== undefined && lt.carryForwardMax !== null
                ? new Prisma.Decimal(lt.carryForwardMax)
                : null,
            expiryMonths: lt.expiryMonths ?? null,
            encashmentAllowed: Boolean(lt.encashmentAllowed),
            probationRestricted: Boolean(lt.probationRestricted),
            allowNegativeBalance: Boolean(lt.allowNegativeBalance),
            negativeBalanceCap: lt.negativeBalanceCap
              ? new Prisma.Decimal(lt.negativeBalanceCap)
              : null,
            halfDayAllowed:
              lt.halfDayAllowed !== undefined ? Boolean(lt.halfDayAllowed) : true,
            deductPublicHolidays: Boolean(lt.deductPublicHolidays),
            approvalSteps:
              lt.approvalSteps || [
                { roleName: 'Manager' },
                { roleName: 'HR Admin' },
              ],
            effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          },
        });
      }

      // 6. Create Default Notification Templates (from resolved template or fallback)
      const notifPayload =
        effectiveTemplates?.templates?.notification_templates?.payload;
      const notifList: any[] =
        Array.isArray(notifPayload) && notifPayload.length > 0
          ? notifPayload
          : DEFAULT_NOTIFICATION_TEMPLATES;

      for (const tmpl of notifList) {
        const value = tmpl.template
          ? tmpl.template
          : {
              channels: tmpl.channels || ['in_app', 'email'],
              subject: tmpl.subject,
              body: tmpl.body,
              variables: tmpl.variables,
            };
        await tx.tenantSetting.create({
          data: {
            tenantId: tenant.id,
            category: 'notification',
            key: tmpl.key,
            value,
            updatedBy: ownerRoleId,
          },
        });
      }

      // 7. Create Default Onboarding Checklist Template (from resolved template)
      const checklistPayload =
        effectiveTemplates?.templates?.onboarding_checklists?.payload;
      if (
        checklistPayload &&
        (checklistPayload.items || Array.isArray(checklistPayload))
      ) {
        const checklistDef = Array.isArray(checklistPayload)
          ? {
              name: 'Standard Onboarding Checklist',
              items: checklistPayload,
            }
          : checklistPayload;
        const items = Array.isArray(checklistDef.items)
          ? checklistDef.items
          : [];

        if (items.length > 0) {
          const createdChecklist = await tx.onboardingChecklistTemplate.create({
            data: {
              tenantId: tenant.id,
              companyId: company.id,
              name: checklistDef.name || 'Standard Onboarding Checklist',
              description:
                checklistDef.description ||
                'Platform default onboarding checklist template',
              isDefault: true,
              isActive: true,
            },
          });

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const linkedDocTypeId = item.documentTypeName
              ? docTypeMap[item.documentTypeName] ?? null
              : null;
            const cat =
              (item.category as OnboardingTaskCategory) ||
              OnboardingTaskCategory.general;
            const taskType =
              (item.taskType as OnboardingTaskType) ||
              OnboardingTaskType.manual_task;

            await tx.onboardingChecklistTemplateItem.create({
              data: {
                templateId: createdChecklist.id,
                title: item.title,
                description: item.description ?? null,
                category: cat,
                taskType,
                documentTypeId: linkedDocTypeId,
                assigneeLabel: item.assigneeLabel ?? 'Employee',
                dueDaysOffset:
                  item.dueDaysOffset !== undefined ? item.dueDaysOffset : 1,
                sortOrder: i,
                isRequired:
                  item.isRequired !== undefined
                    ? Boolean(item.isRequired)
                    : true,
              },
            });
          }
        }
      }

      // 7. Create First Employee & User (Company Owner)
      const ownerEmployee = await tx.employee.create({
        data: {
          tenantId: tenant.id,
          companyId: company.id,
          employeeNumber: 'EMP-001',
          firstName: input.ownerFirstName.trim(),
          lastName: input.ownerLastName.trim(),
          hireDate: new Date(),
          personalInfo: { email: input.ownerEmail.trim().toLowerCase() },
        },
      });

      const ownerUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          employeeId: ownerEmployee.id,
          email: input.ownerEmail.trim().toLowerCase(),
          passwordHash: ownerPasswordHash,
          roleId: ownerRoleId,
          isActive: true,
          mustChangePassword: ownerMustChangePassword,
        },
      });

      return {
        tenant,
        company,
        ownerUser,
      };
    });

    // 8. Invitation email simulation / dispatch
    this.logger.log(
      `[INVITATION_DISPATCHED] Sent company owner invitation to ${input.ownerEmail} for tenant "${result.tenant.name}" (${result.tenant.subdomain}.hrm.local)`,
    );

    // 9. Mandatory Platform Audit Logging
    await this.auditService.log({
      userId: actorUserId ?? null,
      action: 'tenant.provisioned',
      module: 'tenant',
      recordId: result.tenant.id,
      reason: input.reason.trim(),
      newValue: {
        id: result.tenant.id,
        name: result.tenant.name,
        subdomain: result.tenant.subdomain,
        planId: result.tenant.planId,
        status: result.tenant.status,
        companyId: result.company.id,
        ownerEmail: input.ownerEmail,
        provisionedTemplateVersions: templateVersions,
        reason: input.reason.trim(),
      },
    });

    return {
      tenantId: result.tenant.id,
      name: result.tenant.name,
      subdomain: result.tenant.subdomain,
      status: (result.tenant.status.charAt(0).toUpperCase() +
        result.tenant.status.slice(1).toLowerCase()) as any,
      companyId: result.company.id,
      ownerUserId: result.ownerUser.id,
      ownerEmail: result.ownerUser.email,
      invitationSent: true,
      message: `Tenant "${result.tenant.name}" provisioned successfully. Invitation delivered to ${result.ownerUser.email}.`,
    };
  }

  /**
   * Suspend a tenant in either read_only mode or fully_blocked mode.
   * Requires a mandatory reason field.
   */
  async suspendTenant(
    id: string,
    input: SuspendTenantDto,
    actorUserId?: string,
  ): Promise<PlatformTenantSummary> {
    if (!input.reason?.trim()) {
      throw new BadRequestException(
        'A mandatory reason is required to suspend a tenant',
      );
    }
    if (!['read_only', 'fully_blocked'].includes(input.mode)) {
      throw new BadRequestException(
        'Suspension mode must be either "read_only" or "fully_blocked"',
      );
    }

    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: `Tenant with ID "${id}" was not found`,
      });
    }

    if (
      tenant.status === TenantStatus.deleted ||
      tenant.status === TenantStatus.pending_deletion
    ) {
      throw new BadRequestException(
        `Cannot suspend tenant in "${tenant.status}" status.`,
      );
    }

    const mode = input.mode as TenantSuspensionMode;
    const updated = await this.prisma.unscoped.tenant.update({
      where: { id },
      data: {
        status: TenantStatus.suspended,
        suspensionMode: mode,
        suspensionReason: input.reason.trim(),
        suspendedAt: new Date(),
      },
    });

    // Write to platform audit log
    await this.auditService.log({
      userId: actorUserId ?? null,
      action: 'tenant.suspended',
      module: 'tenant',
      recordId: tenant.id,
      reason: input.reason.trim(),
      oldValue: {
        status: tenant.status,
        suspensionMode: tenant.suspensionMode,
      },
      newValue: {
        status: updated.status,
        suspensionMode: updated.suspensionMode,
        suspensionReason: updated.suspensionReason,
        suspendedAt: updated.suspendedAt,
        reason: input.reason.trim(),
      },
    });

    return this.mapTenantSummary(updated);
  }

  /**
   * Restore a suspended, cancelled, or pending_deletion tenant back to active (or trial).
   * Requires a mandatory reason field.
   */
  async restoreTenant(
    id: string,
    input: RestoreTenantDto,
    actorUserId?: string,
  ): Promise<PlatformTenantSummary> {
    if (!input.reason?.trim()) {
      throw new BadRequestException(
        'A mandatory reason is required to restore a tenant',
      );
    }

    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: `Tenant with ID "${id}" was not found`,
      });
    }

    if (tenant.status === TenantStatus.active) {
      throw new BadRequestException('Tenant is already active');
    }
    if (tenant.status === TenantStatus.deleted) {
      throw new BadRequestException(
        'Cannot restore a permanently deleted tenant',
      );
    }

    // Determine target status: trial if trial window hasn't expired, else active
    const now = new Date();
    const isStillTrial =
      tenant.trialEndsAt && new Date(tenant.trialEndsAt) > now;
    const targetStatus = isStillTrial ? TenantStatus.trial : TenantStatus.active;

    const updated = await this.prisma.unscoped.tenant.update({
      where: { id },
      data: {
        status: targetStatus,
        suspensionMode: null,
        suspensionReason: null,
        suspendedAt: null,
        scheduledDeletionAt: null,
        cancelledAt: null,
        cancelReason: null,
      },
    });

    // Write to platform audit log
    await this.auditService.log({
      userId: actorUserId ?? null,
      action: 'tenant.restored',
      module: 'tenant',
      recordId: tenant.id,
      reason: input.reason.trim(),
      oldValue: {
        status: tenant.status,
        suspensionMode: tenant.suspensionMode,
      },
      newValue: {
        status: updated.status,
        reason: input.reason.trim(),
      },
    });

    return this.mapTenantSummary(updated);
  }

  /**
   * Cancel tenant subscription / account.
   * Requires a mandatory reason field.
   */
  async cancelTenant(
    id: string,
    input: CancelTenantDto,
    actorUserId?: string,
  ): Promise<PlatformTenantSummary> {
    if (!input.reason?.trim()) {
      throw new BadRequestException(
        'A mandatory reason is required to cancel a tenant',
      );
    }

    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: `Tenant with ID "${id}" was not found`,
      });
    }

    const updated = await this.prisma.unscoped.tenant.update({
      where: { id },
      data: {
        status: TenantStatus.cancelled,
        cancelledAt: new Date(),
        cancelReason: input.reason.trim(),
      },
    });

    // Write to platform audit log
    await this.auditService.log({
      userId: actorUserId ?? null,
      action: 'tenant.cancelled',
      module: 'tenant',
      recordId: tenant.id,
      reason: input.reason.trim(),
      oldValue: { status: tenant.status },
      newValue: {
        status: updated.status,
        cancelledAt: updated.cancelledAt,
        reason: input.reason.trim(),
      },
    });

    return this.mapTenantSummary(updated);
  }

  /**
   * Schedule tenant deletion with a 30-day grace period (configurable).
   * Hard delete cannot take place until grace period has passed.
   * Requires a mandatory reason field.
   */
  async scheduleDeletion(
    id: string,
    input: ScheduleDeletionDto,
    actorUserId?: string,
  ): Promise<PlatformTenantSummary> {
    if (!input.reason?.trim()) {
      throw new BadRequestException(
        'A mandatory reason is required to schedule tenant deletion',
      );
    }

    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: `Tenant with ID "${id}" was not found`,
      });
    }

    const graceDays = input.gracePeriodDays ?? 30;
    const scheduledDeletionAt = new Date(
      Date.now() + graceDays * 24 * 60 * 60 * 1000,
    );

    const updated = await this.prisma.unscoped.tenant.update({
      where: { id },
      data: {
        status: TenantStatus.pending_deletion,
        scheduledDeletionAt,
      },
    });

    // Write to platform audit log
    await this.auditService.log({
      userId: actorUserId ?? null,
      action: 'tenant.deletion_scheduled',
      module: 'tenant',
      recordId: tenant.id,
      reason: input.reason.trim(),
      oldValue: { status: tenant.status },
      newValue: {
        status: updated.status,
        scheduledDeletionAt: updated.scheduledDeletionAt,
        gracePeriodDays: graceDays,
        reason: input.reason.trim(),
      },
    });

    return this.mapTenantSummary(updated);
  }

  /**
   * Cancel scheduled deletion of a tenant, returning it to active or suspended.
   * Requires a mandatory reason field.
   */
  async cancelDeletion(
    id: string,
    input: RestoreTenantDto,
    actorUserId?: string,
  ): Promise<PlatformTenantSummary> {
    if (!input.reason?.trim()) {
      throw new BadRequestException(
        'A mandatory reason is required to cancel scheduled deletion',
      );
    }

    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: `Tenant with ID "${id}" was not found`,
      });
    }

    if (tenant.status !== TenantStatus.pending_deletion) {
      throw new BadRequestException(
        `Tenant "${tenant.name}" is not scheduled for deletion (current status: "${tenant.status}").`,
      );
    }

    const updated = await this.prisma.unscoped.tenant.update({
      where: { id },
      data: {
        status: TenantStatus.active,
        scheduledDeletionAt: null,
      },
    });

    // Write to platform audit log
    await this.auditService.log({
      userId: actorUserId ?? null,
      action: 'tenant.deletion_cancelled',
      module: 'tenant',
      recordId: tenant.id,
      reason: input.reason.trim(),
      oldValue: {
        status: tenant.status,
        scheduledDeletionAt: tenant.scheduledDeletionAt,
      },
      newValue: {
        status: updated.status,
        scheduledDeletionAt: null,
        reason: input.reason.trim(),
      },
    });

    return this.mapTenantSummary(updated);
  }

  /**
   * Hard delete a tenant only after the 30-day grace period has passed.
   * Can only be triggered through logged job / authorized action.
   * Requires a mandatory reason field.
   */
  async hardDeleteTenant(
    id: string,
    input: HardDeleteTenantDto,
    actorUserId?: string,
  ): Promise<{ success: boolean; tenantId: string; message: string }> {
    if (!input.reason?.trim()) {
      throw new BadRequestException(
        'A mandatory reason is required to execute hard deletion',
      );
    }

    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: `Tenant with ID "${id}" was not found`,
      });
    }

    if (tenant.status !== TenantStatus.pending_deletion) {
      throw new BadRequestException(
        `Cannot hard delete tenant. Current status is "${tenant.status}"; tenant must first be scheduled for deletion (pending_deletion).`,
      );
    }

    const now = new Date();
    if (!tenant.scheduledDeletionAt || new Date(tenant.scheduledDeletionAt) > now) {
      const remainingDays = tenant.scheduledDeletionAt
        ? Math.ceil(
            (new Date(tenant.scheduledDeletionAt).getTime() - now.getTime()) /
              (24 * 60 * 60 * 1000),
          )
        : 30;
      throw new BadRequestException(
        `Cannot hard delete tenant before 30-day grace period has elapsed. Deletion scheduled for ${tenant.scheduledDeletionAt?.toISOString()} (${remainingDays} day(s) remaining).`,
      );
    }

    // Write to platform audit log BEFORE deletion
    await this.auditService.log({
      userId: actorUserId ?? null,
      action: 'tenant.hard_deleted',
      module: 'tenant',
      recordId: tenant.id,
      reason: input.reason.trim(),
      oldValue: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        status: tenant.status,
        scheduledDeletionAt: tenant.scheduledDeletionAt,
      },
      newValue: {
        status: TenantStatus.deleted,
        deletedAt: now.toISOString(),
        reason: input.reason.trim(),
      },
    });

    // Mark as deleted and clear active access
    await this.prisma.unscoped.tenant.update({
      where: { id },
      data: {
        status: TenantStatus.deleted,
        deletedAt: now,
      },
    });

    this.logger.log(
      `[HARD_DELETION_EXECUTED] Tenant ${tenant.name} (${tenant.id}) marked permanently deleted after grace period expired.`,
    );

    return {
      success: true,
      tenantId: tenant.id,
      message: `Tenant "${tenant.name}" (${tenant.id}) has been permanently deleted.`,
    };
  }

  /**
   * Process all scheduled deletions whose grace period has expired.
   * Invoked via scheduled BullMQ job / cron.
   */
  async processScheduledDeletions(actorUserId?: string): Promise<{
    processedCount: number;
    deletedTenantIds: string[];
  }> {
    const now = new Date();
    const expiredTenants = await this.prisma.unscoped.tenant.findMany({
      where: {
        status: TenantStatus.pending_deletion,
        scheduledDeletionAt: {
          lte: now,
        },
      },
    });

    const deletedTenantIds: string[] = [];
    for (const t of expiredTenants) {
      try {
        await this.hardDeleteTenant(
          t.id,
          {
            reason:
              'Automated hard deletion execution following 30-day grace period expiration',
          },
          actorUserId,
        );
        deletedTenantIds.push(t.id);
      } catch (err: any) {
        this.logger.error(
          `Failed automated deletion for tenant ${t.id}: ${err.message}`,
        );
      }
    }

    return {
      processedCount: deletedTenantIds.length,
      deletedTenantIds,
    };
  }

  private mapTenantSummary(tenant: any): PlatformTenantSummary {
    const planCapitalized = (
      tenant.planId
        ? tenant.planId.charAt(0).toUpperCase() +
          tenant.planId.slice(1).toLowerCase()
        : 'Starter'
    ) as any;

    const statusCapitalized = (
      tenant.status.charAt(0).toUpperCase() +
      tenant.status.slice(1).toLowerCase()
    ) as any;

    return {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      plan: planCapitalized,
      status: statusCapitalized,
      storageDriver: tenant.storageDriver,
      suspensionMode: tenant.suspensionMode,
      suspensionReason: tenant.suspensionReason,
      suspendedAt: tenant.suspendedAt ? tenant.suspendedAt.toISOString() : null,
      trialEndsAt: tenant.trialEndsAt ? tenant.trialEndsAt.toISOString() : null,
      cancelledAt: tenant.cancelledAt ? tenant.cancelledAt.toISOString() : null,
      cancelReason: tenant.cancelReason,
      scheduledDeletionAt: tenant.scheduledDeletionAt
        ? tenant.scheduledDeletionAt.toISOString()
        : null,
      deletedAt: tenant.deletedAt ? tenant.deletedAt.toISOString() : null,
      createdAt: tenant.createdAt.toISOString(),
    };
  }
}
