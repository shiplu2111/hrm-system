import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  LeaveAccrualType,
  PermissionAction,
  RoleDataScope,
  TenantStatus,
} from '@prisma/client';
import type {
  CreateSandboxTenantDto,
  DeleteSandboxTenantDto,
  ResetSandboxTenantDto,
  SandboxDemoTemplate,
  SandboxTenantSummary,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';

interface TemplateSeedConfig {
  departments: string[];
  designations: string[];
  employees: Array<{
    firstName: string;
    lastName: string;
    title: string;
    department: string;
    email: string;
  }>;
}

const TEMPLATE_CONFIGS: Record<SandboxDemoTemplate, TemplateSeedConfig> = {
  tech_saas: {
    departments: ['Engineering', 'Product & Design', 'Sales & Customer Success', 'Marketing', 'People & Ops'],
    designations: [
      'Staff Software Engineer',
      'Principal Product Designer',
      'Account Executive - Enterprise',
      'Customer Success Lead',
      'Head of Talent & People',
    ],
    employees: [
      { firstName: 'Alex', lastName: 'Mercer', title: 'Staff Software Engineer', department: 'Engineering', email: 'alex.m' },
      { firstName: 'Maya', lastName: 'Lin', title: 'Principal Product Designer', department: 'Product & Design', email: 'maya.l' },
      { firstName: 'Jordan', lastName: 'Belfort', title: 'Account Executive - Enterprise', department: 'Sales & Customer Success', email: 'jordan.b' },
      { firstName: 'Elena', lastName: 'Rostova', title: 'Customer Success Lead', department: 'Sales & Customer Success', email: 'elena.r' },
      { firstName: 'Marcus', lastName: 'Vance', title: 'Head of Talent & People', department: 'People & Ops', email: 'marcus.v' },
    ],
  },
  retail_hospitality: {
    departments: ['Store Operations', 'Inventory & Logistics', 'Visual Merchandising', 'Customer Support', 'Administration'],
    designations: [
      'General Store Manager',
      'Shift Supervisor',
      'Head of Inventory Control',
      'Senior Barista & Trainer',
      'Retail Operations Associate',
    ],
    employees: [
      { firstName: 'Liam', lastName: 'Gallagher', title: 'General Store Manager', department: 'Store Operations', email: 'liam.g' },
      { firstName: 'Chloe', lastName: 'Bennett', title: 'Shift Supervisor', department: 'Store Operations', email: 'chloe.b' },
      { firstName: 'Mateo', lastName: 'Hernandez', title: 'Head of Inventory Control', department: 'Inventory & Logistics', email: 'mateo.h' },
      { firstName: 'Sophie', lastName: 'Martin', title: 'Senior Barista & Trainer', department: 'Customer Support', email: 'sophie.m' },
      { firstName: 'Tyler', lastName: 'Brooks', title: 'Retail Operations Associate', department: 'Store Operations', email: 'tyler.b' },
    ],
  },
  enterprise_healthcare: {
    departments: ['Clinical Care', 'Emergency & Trauma', 'Diagnostics & Pathology', 'Pharmacy & Dispensary', 'Hospital Administration'],
    designations: [
      'Chief Medical Officer',
      'Charge Nurse - ICU',
      'Senior Clinical Pathologist',
      'Lead Clinical Pharmacist',
      'Hospital Operations Director',
    ],
    employees: [
      { firstName: 'Dr. Sarah', lastName: 'Patel', title: 'Chief Medical Officer', department: 'Clinical Care', email: 'sarah.p' },
      { firstName: 'James', lastName: 'O\'Connor', title: 'Charge Nurse - ICU', department: 'Emergency & Trauma', email: 'james.o' },
      { firstName: 'Dr. Aris', lastName: 'Thorne', title: 'Senior Clinical Pathologist', department: 'Diagnostics & Pathology', email: 'aris.t' },
      { firstName: 'Rachel', lastName: 'Greenberg', title: 'Lead Clinical Pharmacist', department: 'Pharmacy & Dispensary', email: 'rachel.g' },
      { firstName: 'William', lastName: 'Sterling', title: 'Hospital Operations Director', department: 'Hospital Administration', email: 'william.s' },
    ],
  },
  manufacturing_logistics: {
    departments: ['Plant Operations', 'Supply Chain', 'Quality Assurance & ISO', 'Safety & EHS', 'Fleet & Dispatch'],
    designations: [
      'Plant General Manager',
      'Supply Chain Director',
      'Senior QA Inspector',
      'EHS Safety Compliance Lead',
      'Fleet Logistics Dispatcher',
    ],
    employees: [
      { firstName: 'Jack', lastName: 'Reacher', title: 'Plant General Manager', department: 'Plant Operations', email: 'jack.r' },
      { firstName: 'Vikram', lastName: 'Mehta', title: 'Supply Chain Director', department: 'Supply Chain', email: 'vikram.m' },
      { firstName: 'Grace', lastName: 'Kowalski', title: 'Senior QA Inspector', department: 'Quality Assurance & ISO', email: 'grace.k' },
      { firstName: 'Dave', lastName: 'Sullivan', title: 'EHS Safety Compliance Lead', department: 'Safety & EHS', email: 'dave.s' },
      { firstName: 'Nadia', lastName: 'Petrova', title: 'Fleet Logistics Dispatcher', department: 'Fleet & Dispatch', email: 'nadia.p' },
    ],
  },
};

@Injectable()
export class PlatformSandboxService {
  private readonly logger = new Logger(PlatformSandboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PlatformAuditService,
  ) {}

  /**
   * List all flagged sandbox / sales demo tenants.
   */
  async listSandboxTenants(): Promise<SandboxTenantSummary[]> {
    const tenants = await this.prisma.unscoped.tenant.findMany({
      where: {
        isSandbox: true,
        deletedAt: null,
      },
      include: {
        companies: {
          include: { country: true },
          take: 1,
        },
        _count: {
          select: {
            employees: true,
            companies: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map((t) => this.mapSandboxSummary(t));
  }

  /**
   * Get single sandbox tenant by ID.
   */
  async getSandboxTenant(id: string): Promise<SandboxTenantSummary> {
    const tenant = await this.prisma.unscoped.tenant.findFirst({
      where: {
        id,
        isSandbox: true,
        deletedAt: null,
      },
      include: {
        companies: {
          include: { country: true },
          take: 1,
        },
        _count: {
          select: {
            employees: true,
            companies: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: 'SANDBOX_TENANT_NOT_FOUND',
        message: `Sandbox tenant with ID "${id}" was not found`,
      });
    }

    return this.mapSandboxSummary(tenant);
  }

  /**
   * Create a flagged sandbox tenant seeded with sample data for sales demos.
   */
  async createSandboxTenant(
    dto: CreateSandboxTenantDto,
    actorUserId?: string,
  ): Promise<SandboxTenantSummary> {
    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new BadRequestException({
        code: 'AUDIT_REASON_MANDATORY',
        message: 'A mandatory audit reason (minimum 5 characters) is required to provision a sandbox workspace',
      });
    }

    const subdomainClean = dto.subdomain.trim().toLowerCase();
    const existing = await this.prisma.unscoped.tenant.findUnique({
      where: { subdomain: subdomainClean },
    });

    if (existing) {
      throw new ConflictException({
        code: 'SUBDOMAIN_TAKEN',
        message: `Subdomain "${subdomainClean}" is already in use`,
      });
    }

    const durationDays = dto.durationDays ?? 30;
    const expiresAt =
      durationDays > 0
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
        : null;

    // Resolve country
    const country = await this.resolveCountry(dto.countryCode);
    const templateConfig = TEMPLATE_CONFIGS[dto.template] ?? TEMPLATE_CONFIGS.tech_saas;

    // Default password for demo users
    const demoPasswordHash = await bcrypt.hash('Demo2026!Secure', 10);

    const createdTenant = await this.prisma.unscoped.$transaction(async (tx) => {
      // 1. Create Tenant (Flagged as isSandbox, non-billable, Enterprise plan)
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name.trim(),
          subdomain: subdomainClean,
          planId: 'enterprise',
          status: TenantStatus.active,
          storageDriver: 'local',
          isSandbox: true,
          sandboxTemplate: dto.template,
          sandboxExpiresAt: expiresAt,
          lastResetAt: new Date(),
          demoLeadName: dto.demoLeadName.trim(),
          demoLeadEmail: dto.demoLeadEmail.trim().toLowerCase(),
        },
      });

      // 2. Create Company
      const company = await tx.company.create({
        data: {
          tenantId: tenant.id,
          name: `${dto.name.trim()} HQ`,
          countryId: country.id,
          financialYearStart: 1,
          payrollBaseCurrency: country.currency,
          timezone: country.timezone,
          dateFormat: country.dateFormat,
        },
      });

      // 3. Create Default Roles
      const ownerRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Company Owner',
          dataScope: RoleDataScope.all,
        },
      });

      await tx.role.createMany({
        data: [
          { tenantId: tenant.id, name: 'HR Admin', dataScope: RoleDataScope.all },
          { tenantId: tenant.id, name: 'Payroll Admin', dataScope: RoleDataScope.all },
          { tenantId: tenant.id, name: 'Manager', dataScope: RoleDataScope.team },
          { tenantId: tenant.id, name: 'Employee', dataScope: RoleDataScope.own },
        ],
      });

      // 4. Create Demo Admin User
      const demoAdminEmployee = await tx.employee.create({
        data: {
          tenantId: tenant.id,
          companyId: company.id,
          employeeNumber: 'DEMO-001',
          firstName: 'Demo',
          lastName: 'Administrator',
          hireDate: new Date('2024-01-01'),
          personalInfo: { email: `admin@${subdomainClean}.cmsnbd.com` },
        },
      });

      await tx.user.create({
        data: {
          tenantId: tenant.id,
          employeeId: demoAdminEmployee.id,
          email: `admin@${subdomainClean}.cmsnbd.com`,
          passwordHash: demoPasswordHash,
          roleId: ownerRole.id,
          isActive: true,
          mustChangePassword: false,
        },
      });

      // 5. Seed Departments
      const deptMap: Record<string, string> = {};
      for (const deptName of templateConfig.departments) {
        const dept = await tx.department.create({
          data: {
            companyId: company.id,
            name: deptName,
          },
        });
        deptMap[deptName] = dept.id;
      }

      // 6. Seed Sample Employees
      let empNum = 2;
      for (const empDef of templateConfig.employees) {
        await tx.employee.create({
          data: {
            tenantId: tenant.id,
            companyId: company.id,
            departmentId: deptMap[empDef.department] ?? null,
            employeeNumber: `DEMO-00${empNum++}`,
            firstName: empDef.firstName,
            lastName: empDef.lastName,
            hireDate: new Date('2024-03-15'),
            personalInfo: {
              email: `${empDef.email}@${subdomainClean}.cmsnbd.com`,
              title: empDef.title,
            },
          },
        });
      }

      return tenant;
    });

    // 7. Write to Platform Audit Log
    await this.auditService.log({
      userId: actorUserId ?? null,
      action: 'sandbox.created',
      module: 'tenant',
      recordId: createdTenant.id,
      reason: dto.reason.trim(),
      newValue: {
        id: createdTenant.id,
        name: createdTenant.name,
        subdomain: createdTenant.subdomain,
        template: dto.template,
        demoLead: dto.demoLeadName,
        isSandbox: true,
        mrr: 0,
      },
    });

    this.logger.log(
      `[SANDBOX_CREATED] Provisioned demo tenant "${createdTenant.name}" (${createdTenant.subdomain}.cmsnbd.com) with template ${dto.template}`,
    );

    return this.getSandboxTenant(createdTenant.id);
  }

  /**
   * Reset sandbox tenant to pristine baseline sample data.
   */
  async resetSandboxTenant(
    id: string,
    dto: ResetSandboxTenantDto,
    actorUserId?: string,
  ): Promise<SandboxTenantSummary> {
    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new BadRequestException({
        code: 'AUDIT_REASON_MANDATORY',
        message: 'A mandatory audit reason (minimum 5 characters) is required to reset a sandbox workspace',
      });
    }

    const tenant = await this.prisma.unscoped.tenant.findFirst({
      where: { id, isSandbox: true, deletedAt: null },
      include: {
        companies: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: 'SANDBOX_TENANT_NOT_FOUND',
        message: `Sandbox tenant with ID "${id}" was not found`,
      });
    }

    const template = (tenant.sandboxTemplate as SandboxDemoTemplate) || 'tech_saas';
    const templateConfig = TEMPLATE_CONFIGS[template] ?? TEMPLATE_CONFIGS.tech_saas;
    const company = tenant.companies[0];

    await this.prisma.unscoped.$transaction(async (tx) => {
      // 1. Purge transient test records (attendance, leave requests, employee records created during demo)
      // We keep the primary company and roles, but reset employee directory back to baseline template
      await tx.employee.deleteMany({
        where: {
          tenantId: tenant.id,
          employeeNumber: { not: 'DEMO-001' },
        },
      });

      // 2. Re-seed clean sample employees
      if (company) {
        let empNum = 2;
        const deptList = await tx.department.findMany({
          where: { companyId: company.id },
        });
        const deptMap: Record<string, string> = {};
        for (const d of deptList) {
          deptMap[d.name] = d.id;
        }

        for (const empDef of templateConfig.employees) {
          await tx.employee.create({
            data: {
              tenantId: tenant.id,
              companyId: company.id,
              departmentId: deptMap[empDef.department] ?? null,
              employeeNumber: `DEMO-00${empNum++}`,
              firstName: empDef.firstName,
              lastName: empDef.lastName,
              hireDate: new Date('2024-03-15'),
              personalInfo: {
                email: `${empDef.email}@${tenant.subdomain}.cmsnbd.com`,
                title: empDef.title,
              },
            },
          });
        }
      }

      // 3. Update lastResetAt timestamp
      await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          lastResetAt: new Date(),
          status: TenantStatus.active,
          suspensionMode: null,
          suspensionReason: null,
        },
      });
    });

    // 4. Write to Platform Audit Log
    await this.auditService.log({
      userId: actorUserId ?? null,
      action: 'sandbox.reset',
      module: 'tenant',
      recordId: tenant.id,
      reason: dto.reason.trim(),
      newValue: {
        tenantId: tenant.id,
        name: tenant.name,
        template,
        lastResetAt: new Date().toISOString(),
      },
    });

    this.logger.log(
      `[SANDBOX_RESET] Reset demo workspace "${tenant.name}" (${tenant.subdomain}) back to ${template} sample data`,
    );

    return this.getSandboxTenant(tenant.id);
  }

  /**
   * Delete sandbox tenant immediately (bypasses 30-day grace period since non-production demo).
   */
  async deleteSandboxTenant(
    id: string,
    dto: DeleteSandboxTenantDto,
    actorUserId?: string,
  ): Promise<{ success: boolean; tenantId: string; message: string }> {
    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new BadRequestException({
        code: 'AUDIT_REASON_MANDATORY',
        message: 'A mandatory audit reason (minimum 5 characters) is required to delete a sandbox workspace',
      });
    }

    const tenant = await this.prisma.unscoped.tenant.findFirst({
      where: { id, isSandbox: true },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: 'SANDBOX_TENANT_NOT_FOUND',
        message: `Sandbox tenant with ID "${id}" was not found`,
      });
    }

    // Cascade delete sandbox workspace
    await this.prisma.unscoped.$transaction(async (tx) => {
      const companies = await tx.company.findMany({
        where: { tenantId: id },
        select: { id: true },
      });
      const companyIds = companies.map((c) => c.id);
      if (companyIds.length > 0) {
        await tx.department.deleteMany({
          where: { companyId: { in: companyIds } },
        });
      }
      await tx.user.deleteMany({ where: { tenantId: id } });
      await tx.employee.deleteMany({ where: { tenantId: id } });
      await tx.role.deleteMany({ where: { tenantId: id } });
      await tx.company.deleteMany({ where: { tenantId: id } });
      await tx.tenantSetting.deleteMany({ where: { tenantId: id } });
      await tx.tenant.delete({ where: { id } });
    });

    // Write to Platform Audit Log
    await this.auditService.log({
      userId: actorUserId ?? null,
      action: 'sandbox.deleted',
      module: 'tenant',
      recordId: id,
      reason: dto.reason.trim(),
      oldValue: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        isSandbox: true,
      },
    });

    this.logger.log(
      `[SANDBOX_DELETED] Permanently purged sandbox demo tenant "${tenant.name}" (${tenant.subdomain})`,
    );

    return {
      success: true,
      tenantId: id,
      message: `Sandbox demo tenant "${tenant.name}" deleted successfully.`,
    };
  }

  private mapSandboxSummary(t: any): SandboxTenantSummary {
    const primaryCompany = t.companies?.[0];
    const countryName = primaryCompany?.country?.name ?? 'United States';
    const countryCode = primaryCompany?.country?.isoCode ?? 'USA';

    const template = (t.sandboxTemplate as SandboxDemoTemplate) || 'tech_saas';
    const empCount = t._count?.employees || 6;

    return {
      id: t.id,
      name: t.name,
      subdomain: t.subdomain,
      plan: 'Enterprise',
      status: 'Active',
      isSandbox: true,
      sandboxTemplate: template,
      demoLeadName: t.demoLeadName || 'Sales Engineering Team',
      demoLeadEmail: t.demoLeadEmail || `sales@cmsnbd.com`,
      sandboxExpiresAt: t.sandboxExpiresAt ? t.sandboxExpiresAt.toISOString() : null,
      lastResetAt: t.lastResetAt ? t.lastResetAt.toISOString() : t.createdAt.toISOString(),
      employeeCount: empCount,
      companyCount: t._count?.companies || 1,
      mrr: 0, // Sandbox tenants are NEVER billed!
      health: 98,
      region: 'Global Demo Cloud',
      country: countryName,
      countryCode,
      storageDriver: t.storageDriver || 'local',
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt?.toISOString() || t.createdAt.toISOString(),
      sampleDataStats: {
        employeesCount: empCount,
        departmentsCount: 5,
        activeLeavesCount: 3,
        payslipsCount: 1,
        attendancePunchesCount: 18,
        documentsCount: 4,
      },
    };
  }

  private async resolveCountry(countryCode?: string) {
    const code = countryCode ? countryCode.toUpperCase() : 'USA';
    let country = await this.prisma.unscoped.country.findFirst({
      where: { isoCode: code },
    });

    if (!country) {
      country = await this.prisma.unscoped.country.findFirst();
    }

    if (!country) {
      country = await this.prisma.unscoped.country.create({
        data: {
          name: 'United States',
          isoCode: 'USA',
          currency: 'USD',
          timezone: 'America/New_York',
          dateFormat: 'YYYY-MM-DD',
          numberFormat: '1,234.56',
        },
      });
    }

    return country;
  }
}
