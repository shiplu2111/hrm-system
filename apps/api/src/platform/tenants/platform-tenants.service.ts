import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ListTenantsQuery,
  PlatformTenantPlan,
  PlatformTenantStatus,
  PlatformTenantSummary,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';

// Mock/baseline metadata enrichment for tenants where full billing/health records are configured
const TENANT_METADATA_DEFAULTS: Record<
  string,
  { mrr: number; health: number; region: string; country: string }
> = {
  demo: { mrr: 3500, health: 96, region: 'Asia Pacific', country: 'Bangladesh' },
  acme: { mrr: 4280, health: 94, region: 'North America', country: 'United States' },
  techflow: { mrr: 2180, health: 88, region: 'Asia Pacific', country: 'Singapore' },
  globex: { mrr: 5950, health: 42, region: 'Europe', country: 'Germany' },
  northstar: { mrr: 2780, health: 81, region: 'Europe', country: 'United Kingdom' },
  vertex: { mrr: 850, health: 68, region: 'Asia Pacific', country: 'Australia' },
  orbit: { mrr: 0, health: 24, region: 'Middle East', country: 'UAE' },
};

export interface PagedTenantsResult {
  items: PlatformTenantSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class PlatformTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PlatformAuditService,
  ) {}

  /**
   * Returns list of tenants strictly filtered to platform-level metadata.
   * Multi-tenancy rule: Platform staff cannot see employee/payroll business data.
   */
  async listTenants(params?: ListTenantsQuery): Promise<PlatformTenantSummary[]> {
    const result = await this.listTenantsPaged(params);
    return result.items;
  }

  /**
   * Returns paged list of tenants with full search, multi-field filtering,
   * sortable columns, and pagination metadata.
   */
  async listTenantsPaged(params?: ListTenantsQuery): Promise<PagedTenantsResult> {
    const tenants = await this.prisma.unscoped.tenant.findMany({
      include: {
        companies: {
          include: {
            country: true,
          },
          take: 1,
        },
        _count: {
          select: {
            companies: true,
            employees: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let mapped: PlatformTenantSummary[] = tenants.map((t) => {
      const meta = TENANT_METADATA_DEFAULTS[t.subdomain.toLowerCase()] ?? {
        mrr: t.planId === 'enterprise' ? 4000 : t.planId === 'business' ? 2000 : 500,
        health: t.status === 'active' ? 90 : t.status === 'suspended' ? 40 : 20,
        region: 'Global',
        country: 'Global',
      };

      const primaryCompany = t.companies?.[0];
      const countryName = primaryCompany?.country?.name ?? meta.country ?? 'Global';
      const countryCode = primaryCompany?.country?.isoCode ?? 'GLB';
      const lastActivity = t.updatedAt
        ? t.updatedAt.toISOString()
        : t.createdAt.toISOString();

      const planCapitalized = (
        t.planId ? t.planId.charAt(0).toUpperCase() + t.planId.slice(1).toLowerCase() : 'Starter'
      ) as PlatformTenantPlan;

      const statusCapitalized = (
        t.status.charAt(0).toUpperCase() + t.status.slice(1).toLowerCase()
      ) as PlatformTenantStatus;

      return {
        id: t.id,
        name: t.name,
        subdomain: t.subdomain,
        plan: planCapitalized,
        status: statusCapitalized,
        employeeCount: t._count.employees,
        companyCount: t._count.companies,
        mrr: t.isSandbox ? 0 : meta.mrr,
        health: meta.health,
        region: meta.region,
        country: countryName,
        countryCode,
        lastActivity,
        storageDriver: t.storageDriver,
        isSandbox: Boolean(t.isSandbox),
        sandboxTemplate: t.sandboxTemplate,
        sandboxExpiresAt: t.sandboxExpiresAt ? t.sandboxExpiresAt.toISOString() : null,
        lastResetAt: t.lastResetAt ? t.lastResetAt.toISOString() : null,
        demoLeadName: t.demoLeadName,
        demoLeadEmail: t.demoLeadEmail,
        suspensionMode: t.suspensionMode,
        suspensionReason: t.suspensionReason,
        suspendedAt: t.suspendedAt ? t.suspendedAt.toISOString() : null,
        trialEndsAt: t.trialEndsAt ? t.trialEndsAt.toISOString() : null,
        cancelledAt: t.cancelledAt ? t.cancelledAt.toISOString() : null,
        cancelReason: t.cancelReason,
        scheduledDeletionAt: t.scheduledDeletionAt ? t.scheduledDeletionAt.toISOString() : null,
        deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    });

    // 1. Search Filter (name, subdomain, country, plan, status)
    if (params?.search?.trim()) {
      const q = params.search.trim().toLowerCase();
      mapped = mapped.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.subdomain.toLowerCase().includes(q) ||
          (t.country && t.country.toLowerCase().includes(q)) ||
          t.plan.toLowerCase().includes(q) ||
          t.status.toLowerCase().includes(q),
      );
    }

    // 2. Plan Filter
    if (params?.plan && params.plan !== 'All') {
      const p = params.plan.toLowerCase();
      mapped = mapped.filter((t) => t.plan.toLowerCase() === p);
    }

    // 3. Status Filter
    if (params?.status && params.status !== 'All') {
      const s = params.status.toLowerCase();
      mapped = mapped.filter((t) => t.status.toLowerCase() === s);
    }

    // 4. Country Filter
    if (params?.country && params.country !== 'All') {
      const c = params.country.toLowerCase();
      mapped = mapped.filter(
        (t) =>
          (t.country && t.country.toLowerCase() === c) ||
          (t.countryCode && t.countryCode.toLowerCase() === c),
      );
    }

    // 5. Sandbox Filter
    if (params?.isSandbox !== undefined && params?.isSandbox !== '') {
      const isSandboxBool = String(params.isSandbox) === 'true';
      mapped = mapped.filter((t) => Boolean(t.isSandbox) === isSandboxBool);
    }

    // 5. Created Date Filter (from / to)
    if (params?.createdFrom) {
      const fromTime = new Date(params.createdFrom).getTime();
      if (!isNaN(fromTime)) {
        mapped = mapped.filter((t) => new Date(t.createdAt).getTime() >= fromTime);
      }
    }
    if (params?.createdTo) {
      const toTime = new Date(params.createdTo);
      if (!isNaN(toTime.getTime())) {
        if (params.createdTo.length <= 10) {
          toTime.setHours(23, 59, 59, 999);
        }
        mapped = mapped.filter((t) => new Date(t.createdAt).getTime() <= toTime.getTime());
      }
    }

    // 6. Sortable Columns: name, plan, employees, status, created, lastActivity
    const sortBy = params?.sortBy ?? 'created';
    const sortOrder = params?.sortOrder ?? (params?.sortBy ? 'asc' : 'desc');
    const direction = sortOrder === 'desc' ? -1 : 1;

    mapped.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'plan': {
          const planOrder: Record<string, number> = {
            Free: 0,
            Starter: 1,
            Business: 2,
            Enterprise: 3,
          };
          comparison = (planOrder[a.plan] ?? 0) - (planOrder[b.plan] ?? 0);
          break;
        }
        case 'employees':
          comparison = (a.employeeCount ?? 0) - (b.employeeCount ?? 0);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'lastActivity': {
          const dateA = new Date(a.lastActivity ?? a.createdAt).getTime();
          const dateB = new Date(b.lastActivity ?? b.createdAt).getTime();
          comparison = dateA - dateB;
          break;
        }
        case 'created':
        default: {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          comparison = dateA - dateB;
          break;
        }
      }
      return comparison * direction;
    });

    const total = mapped.length;

    // 7. Pagination
    if (params?.page && params?.pageSize) {
      const page = Math.max(1, params.page);
      const pageSize = Math.max(1, params.pageSize);
      const start = (page - 1) * pageSize;
      const pagedItems = mapped.slice(start, start + pageSize);
      return {
        items: pagedItems,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      };
    }

    return {
      items: mapped,
      total,
      page: 1,
      pageSize: total || 1,
      totalPages: 1,
    };
  }

  /**
   * Retrieves tenant platform metadata by ID.
   * STRICT SECURITY NOTE: Does NOT return tenant business data (employees, attendance, payroll).
   */
  async getTenant(id: string): Promise<PlatformTenantSummary> {
    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            companies: true,
            employees: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: `Tenant with ID "${id}" was not found`,
      });
    }

    const meta = TENANT_METADATA_DEFAULTS[tenant.subdomain.toLowerCase()] ?? {
      mrr: 1500,
      health: 85,
      region: 'Global',
      country: 'Global',
    };

    return {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      plan: (tenant.planId
        ? tenant.planId.charAt(0).toUpperCase() + tenant.planId.slice(1).toLowerCase()
        : 'Starter') as PlatformTenantPlan,
      status: (tenant.status.charAt(0).toUpperCase() +
        tenant.status.slice(1).toLowerCase()) as PlatformTenantStatus,
      employeeCount: tenant._count.employees,
      companyCount: tenant._count.companies,
      mrr: tenant.isSandbox ? 0 : meta.mrr,
      health: meta.health,
      region: meta.region,
      country: meta.country,
      storageDriver: tenant.storageDriver,
      isSandbox: Boolean(tenant.isSandbox),
      sandboxTemplate: tenant.sandboxTemplate,
      sandboxExpiresAt: tenant.sandboxExpiresAt
        ? tenant.sandboxExpiresAt.toISOString()
        : null,
      lastResetAt: tenant.lastResetAt ? tenant.lastResetAt.toISOString() : null,
      demoLeadName: tenant.demoLeadName,
      demoLeadEmail: tenant.demoLeadEmail,
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
