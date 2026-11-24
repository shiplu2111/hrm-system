// apps/api/src/platform/audit/platform-audit.service.ts
import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PlatformAuditFilterOptions,
  PlatformAuditLogItem,
  PlatformAuditLogQuery,
  PlatformAuditLogResponse,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';

export interface CreatePlatformAuditLogInput {
  userId?: string | null;
  action: string;
  module: string;
  recordId?: string | null;
  tenantId?: string | null;
  reason?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface PlatformActorContext {
  id?: string;
  email?: string;
  roleName?: string;
  permissions?: Array<{ module: string; action: string }>;
}

const REDACT_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'secret',
  'totpsecret',
  'totp_secret',
  'totpsecretencrypted',
  'totp_secret_encrypted',
  'token',
  'refreshtoken',
  'refresh_token',
  'refreshtokenhash',
  'refresh_token_hash',
  'mfatoken',
  'fieldencryptionkey',
  'field_encryption_key',
]);

function sanitizeValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lowerKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (REDACT_KEYS.has(lowerKey)) {
      result[k] = '[redacted]';
    } else if (typeof v === 'object' && v !== null) {
      result[k] = sanitizeValue(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) {
    return '""';
  }
  let str: string;
  if (typeof val === 'object') {
    str = JSON.stringify(val);
  } else {
    str = String(val);
  }
  return `"${str.replace(/"/g, '""')}"`;
}

@Injectable()
export class PlatformAuditService implements OnModuleInit {
  private readonly logger = new Logger(PlatformAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return (this.prisma as any).unscoped || this.prisma;
  }

  async onModuleInit() {
    await this.seedInitialPlatformAuditLogsIfEmpty();
  }

  /**
   * Role enforcement: Platform Owner, Platform Admin, and Read-Only Auditor (AUDIT_LOG.md §5).
   */
  canAccess(actor?: PlatformActorContext | null): boolean {
    if (!actor) return false;
    const role = (actor.roleName || '').trim();
    if (
      role === 'Platform Owner' ||
      role === 'Platform Admin' ||
      role === 'Read-Only Auditor'
    ) {
      return true;
    }
    const perms = actor.permissions || [];
    return perms.some(
      (p) =>
        (p.module === 'audit' || p.module === 'platform') &&
        (p.action === 'view' || p.action === 'manage'),
    );
  }

  assertAccess(actor?: PlatformActorContext | null): void {
    if (!this.canAccess(actor)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message:
          'Access restricted: Platform Audit Log is restricted to Platform Owner, Platform Admin, and Read-Only Auditor.',
      });
    }
  }

  /**
   * Append-only platform audit logging (AUDIT_LOG.md).
   * No update or delete operations exist.
   */
  async log(input: CreatePlatformAuditLogInput): Promise<void> {
    try {
      const sanitizedOld =
        input.oldValue !== undefined ? sanitizeValue(input.oldValue) : undefined;
      const sanitizedNew =
        input.newValue !== undefined ? sanitizeValue(input.newValue) : undefined;

      // Infer tenantId if omitted but present in recordId or payload for tenant modules
      let resolvedTenantId = input.tenantId ?? null;
      if (!resolvedTenantId && input.recordId) {
        const mod = (input.module || '').toLowerCase();
        if (mod === 'tenant' || mod === 'tenants') {
          resolvedTenantId = String(input.recordId);
        }
      }

      await this.db.platformAuditLog.create({
        data: {
          userId: input.userId ?? null,
          tenantId: resolvedTenantId,
          action: input.action,
          module: input.module,
          recordId: input.recordId ? String(input.recordId) : null,
          reason: input.reason ?? null,
          oldValue: sanitizedOld as Prisma.InputJsonValue | undefined,
          newValue: sanitizedNew as Prisma.InputJsonValue | undefined,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (error) {
      // Platform audit failures must not crash the primary operational request,
      // but should be logged immediately.
      this.logger.error(
        `Failed to record platform audit log: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List platform audit logs with multi-dimensional filters.
   */
  async list(
    filters: PlatformAuditLogQuery = {},
    actor?: PlatformActorContext | null,
  ): Promise<PlatformAuditLogResponse> {
    this.assertAccess(actor);

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
    const skip = (page - 1) * pageSize;

    const andConditions: Prisma.PlatformAuditLogWhereInput[] = [];

    if (filters.userId) {
      andConditions.push({ userId: filters.userId });
    }

    if (filters.tenantId) {
      andConditions.push({
        OR: [{ tenantId: filters.tenantId }, { recordId: filters.tenantId }],
      });
    }

    if (filters.module) {
      andConditions.push({
        module: { equals: filters.module, mode: 'insensitive' },
      });
    }

    if (filters.action) {
      andConditions.push({
        action: { equals: filters.action, mode: 'insensitive' },
      });
    }

    if (filters.from || filters.to) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (filters.from) dateFilter.gte = new Date(filters.from);
      if (filters.to) {
        const toDate = new Date(filters.to);
        // If only a date string was provided (e.g. YYYY-MM-DD), expand to end of day
        if (typeof filters.to === 'string' && filters.to.length === 10) {
          toDate.setHours(23, 59, 59, 999);
        }
        dateFilter.lte = toDate;
      }
      andConditions.push({ createdAt: dateFilter });
    }

    if (filters.search?.trim()) {
      const q = filters.search.trim();
      andConditions.push({
        OR: [
          { action: { contains: q, mode: 'insensitive' } },
          { module: { contains: q, mode: 'insensitive' } },
          { reason: { contains: q, mode: 'insensitive' } },
          { recordId: { contains: q, mode: 'insensitive' } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { user: { firstName: { contains: q, mode: 'insensitive' } } },
          { user: { lastName: { contains: q, mode: 'insensitive' } } },
          { tenant: { name: { contains: q, mode: 'insensitive' } } },
          { tenant: { subdomain: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.PlatformAuditLogWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const [rows, total] = await Promise.all([
      this.db.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
              subdomain: true,
            },
          },
        },
      }),
      this.db.platformAuditLog.count({ where }),
    ]);

    const items: PlatformAuditLogItem[] = rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      userEmail: r.user?.email ?? null,
      userName: r.user ? `${r.user.firstName} ${r.user.lastName}`.trim() : null,
      userRole: r.user?.role?.name ?? null,
      tenantId: r.tenantId ?? (r.module === 'tenant' || r.module === 'tenants' ? r.recordId : null),
      tenantName: r.tenant?.name ?? null,
      tenantSubdomain: r.tenant?.subdomain ?? null,
      module: r.module,
      action: r.action,
      recordId: r.recordId,
      reason: r.reason,
      oldValue: r.oldValue as Record<string, unknown> | null,
      newValue: r.newValue as Record<string, unknown> | null,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      createdAt: r.createdAt.toISOString(),
    }));

    const totalPages = Math.ceil(total / pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: totalPages > 0 ? totalPages : 1,
    };
  }

  /**
   * Filter dropdown options (staff members, tenants, modules, actions).
   */
  async getFilterOptions(
    actor?: PlatformActorContext | null,
  ): Promise<PlatformAuditFilterOptions> {
    this.assertAccess(actor);

    const [staffUsers, tenantsList, distinctModules, distinctActions] =
      await Promise.all([
        this.db.platformUser.findMany({
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { firstName: 'asc' },
        }),
        this.db.tenant.findMany({
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
          orderBy: { name: 'asc' },
        }),
        this.db.platformAuditLog.findMany({
          select: { module: true },
          distinct: ['module'],
        }),
        this.db.platformAuditLog.findMany({
          select: { action: true },
          distinct: ['action'],
        }),
      ]);

    const standardModules = [
      'tenants',
      'billing',
      'compliance',
      'settings',
      'support',
      'staff',
      'feature_flags',
      'maintenance',
      'queues',
      'security',
    ];

    const loggedModules = distinctModules.map((m: any) => m.module);
    const combinedModules = Array.from(
      new Set([...standardModules, ...loggedModules]),
    ).sort();

    const loggedActions = distinctActions.map((a: any) => a.action);
    const standardActions = [
      'tenant:provision',
      'tenant:suspend',
      'tenant:activate',
      'tenant:isolation_change',
      'subscription:plan_change',
      'subscription:seat_override',
      'invoice:generate',
      'rule:publish',
      'rule:reject',
      'settings:update',
      'maintenance:toggle',
      'feature_flag:toggle',
      'support_access:request',
      'support_session:start',
      'support_session:end',
      'staff:invite',
      'staff:role_change',
      'staff:deactivate',
      'staff:2fa_reset',
      'staff:session_revoke',
    ];

    const combinedActions = Array.from(
      new Set([...standardActions, ...loggedActions]),
    ).sort();

    return {
      staffMembers: staffUsers.map((u: any) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        roleName: u.role?.name || 'Platform Staff',
      })),
      tenants: tenantsList.map((t: any) => ({
        id: t.id,
        name: t.name,
        subdomain: t.subdomain,
      })),
      modules: combinedModules,
      actions: combinedActions,
    };
  }

  /**
   * Export audit logs to CSV formatted stream/string.
   */
  async exportCsv(
    filters: PlatformAuditLogQuery = {},
    actor?: PlatformActorContext | null,
  ): Promise<string> {
    this.assertAccess(actor);

    // Retrieve matching rows (cap at 5,000 for export safety)
    const listResult = await this.list({ ...filters, page: 1, pageSize: 5000 }, actor);
    const rows = listResult.items;

    const headers = [
      'Timestamp (UTC)',
      'Staff Name',
      'Staff Email',
      'Role',
      'Tenant',
      'Tenant Subdomain',
      'Module',
      'Action',
      'Record ID',
      'Reason',
      'Old Value (JSON)',
      'New Value (JSON)',
      'IP Address',
      'User Agent',
    ];

    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const line = [
        escapeCsvField(r.createdAt),
        escapeCsvField(r.userName || 'System / Service'),
        escapeCsvField(r.userEmail || ''),
        escapeCsvField(r.userRole || ''),
        escapeCsvField(r.tenantName || 'Cross-Tenant / Platform'),
        escapeCsvField(r.tenantSubdomain || ''),
        escapeCsvField(r.module),
        escapeCsvField(r.action),
        escapeCsvField(r.recordId || ''),
        escapeCsvField(r.reason || ''),
        escapeCsvField(r.oldValue ? JSON.stringify(r.oldValue) : ''),
        escapeCsvField(r.newValue ? JSON.stringify(r.newValue) : ''),
        escapeCsvField(r.ipAddress || ''),
        escapeCsvField(r.userAgent || ''),
      ];
      csvLines.push(line.join(','));
    }

    return csvLines.join('\n');
  }

  /**
   * Seed realistic platform audit history if empty (covering the 6 required areas).
   */
  async seedInitialPlatformAuditLogsIfEmpty(): Promise<void> {
    try {
      const seededCount = await this.db.platformAuditLog.count({
        where: { module: { in: ['tenants', 'compliance', 'settings', 'staff'] } },
      });
      if (seededCount >= 5) return;

      this.logger.log('Seeding initial Platform Audit Log history...');

      // Ensure Read-Only Auditor user exists for auditing testing
      const auditorRole = await this.db.platformRole.findFirst({
        where: { name: 'Read-Only Auditor' },
      });
      let auditorUser = await this.db.platformUser.findFirst({
        where: { email: 'auditor@cmsnbd.com' },
      });

      if (!auditorUser && auditorRole) {
        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash('password', 10);
        auditorUser = await this.db.platformUser.create({
          data: {
            email: 'auditor@cmsnbd.com',
            firstName: 'Sarah',
            lastName: 'Chen',
            passwordHash,
            roleId: auditorRole.id,
            isActive: true,
            totpEnabled: true,
          },
        });
      }

      // Fetch reference platform users and tenants
      const ownerUser = await this.db.platformUser.findFirst({
        where: { email: 'platform.owner@cmsnbd.com' },
      });
      const adminUser = await this.db.platformUser.findFirst({
        where: { email: 'platform.admin@cmsnbd.com' },
      });
      const acmeTenant = await this.db.tenant.findFirst({
        where: { subdomain: 'acme' },
      });
      const techflowTenant = await this.db.tenant.findFirst({
        where: { subdomain: 'techflow' },
      });
      const globexTenant = await this.db.tenant.findFirst({
        where: { subdomain: 'globex' },
      });

      const ownerId = ownerUser?.id || null;
      const adminId = adminUser?.id || ownerId;
      const acmeId = acmeTenant?.id || null;
      const techflowId = techflowTenant?.id || null;
      const globexId = globexTenant?.id || null;

      const now = Date.now();

      const seedEntries = [
        // 1. Tenant Lifecycle
        {
          userId: ownerId,
          tenantId: acmeId,
          module: 'tenants',
          action: 'tenant:provision',
          recordId: acmeId,
          reason: 'Initial onboarding approval for enterprise customer contract #ENT-2026-08',
          oldValue: null,
          newValue: {
            name: 'Acme Corporation',
            subdomain: 'acme',
            plan: 'enterprise',
            status: 'active',
            storageDriver: 's3',
            region: 'us-east-1',
          },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          createdAt: new Date(now - 30 * 86400000),
        },
        {
          userId: ownerId,
          tenantId: globexId,
          module: 'tenants',
          action: 'tenant:suspend',
          recordId: globexId,
          reason: 'Subscription invoice past due by 45 days after automated grace period retries.',
          oldValue: { status: 'active', login_access: true, billing_state: 'past_due' },
          newValue: { status: 'suspended', login_access: false, billing_state: 'past_due' },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          createdAt: new Date(now - 22 * 86400000),
        },
        {
          userId: adminId,
          tenantId: techflowId,
          module: 'tenants',
          action: 'tenant:isolation_change',
          recordId: techflowId,
          reason: 'Customer security amendment approved: upgraded to dedicated database isolation.',
          oldValue: { isolation: 'shared_schema', pool_size: 10 },
          newValue: { isolation: 'dedicated_db', host: 'pg-dedicated-techflow.internal', pool_size: 30 },
          ipAddress: '172.16.0.4',
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
          createdAt: new Date(now - 18 * 86400000),
        },

        // 2. Billing
        {
          userId: ownerId,
          tenantId: acmeId,
          module: 'billing',
          action: 'subscription:plan_change',
          recordId: acmeId,
          reason: 'Customer requested upgrade from Business to Enterprise plan with SAML SSO add-on.',
          oldValue: { plan: 'business', seat_limit: 250, custom_domain: false, sso_enabled: false },
          newValue: { plan: 'enterprise', seat_limit: 1000, custom_domain: true, sso_enabled: true },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          createdAt: new Date(now - 15 * 86400000),
        },
        {
          userId: adminId,
          tenantId: techflowId,
          module: 'billing',
          action: 'subscription:seat_override',
          recordId: techflowId,
          reason: 'Temporary expansion authorized for seasonal workforce onboarding peak.',
          oldValue: { seat_limit: 100, buffer_allowed: 0 },
          newValue: { seat_limit: 150, buffer_allowed: 10 },
          ipAddress: '172.16.0.4',
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
          createdAt: new Date(now - 12 * 86400000),
        },
        {
          userId: ownerId,
          tenantId: acmeId,
          module: 'billing',
          action: 'invoice:generate',
          recordId: 'inv-2026-0881',
          reason: 'Prorated invoice generated for midterm Enterprise plan expansion.',
          oldValue: null,
          newValue: { invoiceNumber: 'INV-2026-0881', amount: '$1,299.00', status: 'issued', currency: 'USD' },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          createdAt: new Date(now - 10 * 86400000),
        },

        // 3. Rule Publishing
        {
          userId: adminId,
          tenantId: null,
          module: 'compliance',
          action: 'rule:publish',
          recordId: 'rule-uk-paye-2026',
          reason: 'Published UK PAYE 2026/27 Tax Bands following HMRC statutory release notification.',
          oldValue: { version: '2025.2', status: 'superseded', basic_rate_limit: 37700 },
          newValue: { version: '2026.1', status: 'published', basic_rate_limit: 38200, effective_from: '2026-04-06' },
          ipAddress: '172.16.0.4',
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
          createdAt: new Date(now - 8 * 86400000),
        },
        {
          userId: adminId,
          tenantId: null,
          module: 'compliance',
          action: 'rule:reject',
          recordId: 'rule-au-super-draft',
          reason: 'Separation of duties review: Australian SG rate override rejected because 11.5% is statutory ceiling until FY2027.',
          oldValue: { proposed_sg_rate: '12.0%', status: 'under_review' },
          newValue: { proposed_sg_rate: '12.0%', status: 'rejected', returned_to: 'Compliance Analyst' },
          ipAddress: '172.16.0.4',
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
          createdAt: new Date(now - 7 * 86400000),
        },

        // 4. Settings Changes
        {
          userId: ownerId,
          tenantId: null,
          module: 'settings',
          action: 'settings:update',
          recordId: 'global_security_policy',
          reason: 'Strengthened platform security baseline: mandatory TOTP 2FA enrollment on initial staff sign-in.',
          oldValue: { enforce_2fa_all_staff: false, session_timeout_mins: 720 },
          newValue: { enforce_2fa_all_staff: true, session_timeout_mins: 480 },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          createdAt: new Date(now - 6 * 86400000),
        },
        {
          userId: adminId,
          tenantId: null,
          module: 'feature_flags',
          action: 'feature_flag:toggle',
          recordId: 'payroll.next_generation',
          reason: 'Increased rollout to 100% after successful 3-week zero-anomaly pilot run.',
          oldValue: { flag: 'payroll.next_generation', enabled: true, rollout_pct: 25 },
          newValue: { flag: 'payroll.next_generation', enabled: true, rollout_pct: 100 },
          ipAddress: '172.16.0.4',
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
          createdAt: new Date(now - 5 * 86400000),
        },
        {
          userId: ownerId,
          tenantId: null,
          module: 'maintenance',
          action: 'maintenance:toggle',
          recordId: 'maintenance_mode_window',
          reason: 'Scheduled global maintenance window for PostgreSQL engine minor upgrade.',
          oldValue: { maintenanceMode: false, readOnlyFallback: false },
          newValue: { maintenanceMode: true, readOnlyFallback: true, estimatedMins: 30 },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          createdAt: new Date(now - 4 * 86400000),
        },

        // 5. Support Sessions
        {
          userId: adminId,
          tenantId: acmeId,
          module: 'support',
          action: 'support_access:request',
          recordId: 'sar-2026-092',
          reason: 'Requested break-glass read-only support access to diagnose SAML assertion failure on ticket SUP-4818.',
          oldValue: null,
          newValue: { ticketId: 'SUP-4818', requestedScope: 'read_only', durationMinutes: 120, status: 'requested' },
          ipAddress: '172.16.0.4',
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
          createdAt: new Date(now - 3 * 86400000),
        },
        {
          userId: adminId,
          tenantId: acmeId,
          module: 'support',
          action: 'support_session:start',
          recordId: 'sess-2026-3391',
          reason: 'Tenant Owner authorized access: operator impersonation session started for SAML ACS endpoint inspection.',
          oldValue: { session_state: 'idle', active_tenant: null },
          newValue: { session_state: 'active', active_tenant: 'Acme Corporation', expires_at: new Date(now + 7200000).toISOString() },
          ipAddress: '172.16.0.4',
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
          createdAt: new Date(now - 2 * 86400000),
        },
        {
          userId: adminId,
          tenantId: acmeId,
          module: 'support',
          action: 'support_session:end',
          recordId: 'sess-2026-3391',
          reason: 'Inspection completed: SAML certificate mismatch diagnosed and resolution instructions communicated.',
          oldValue: { session_state: 'active', active_tenant: 'Acme Corporation' },
          newValue: { session_state: 'terminated', duration_used_mins: 42, audit_status: 'complete' },
          ipAddress: '172.16.0.4',
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
          createdAt: new Date(now - 1.8 * 86400000),
        },

        // 6. Staff Changes
        {
          userId: ownerId,
          tenantId: null,
          module: 'staff',
          action: 'staff:invite',
          recordId: auditorUser?.id || 'auditor-user-id',
          reason: 'Invited independent compliance auditor to conduct annual ISO 27001 log verification.',
          oldValue: null,
          newValue: { email: 'auditor@cmsnbd.com', role: 'Read-Only Auditor', invitedBy: 'Platform Owner' },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          createdAt: new Date(now - 1.5 * 86400000),
        },
        {
          userId: ownerId,
          tenantId: null,
          module: 'staff',
          action: 'staff:role_change',
          recordId: adminId || 'admin-user-id',
          reason: 'Promoted operational lead to Platform Admin role with separation of duties enforcement.',
          oldValue: { role: 'Support Agent', privileged_write: false },
          newValue: { role: 'Platform Admin', privileged_write: true },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          createdAt: new Date(now - 1 * 86400000),
        },
        {
          userId: adminId,
          tenantId: null,
          module: 'staff',
          action: 'staff:2fa_reset',
          recordId: 'usr-reset-target-99',
          reason: 'Approved two-admin 2FA reset request following hardware security token loss verification.',
          oldValue: { twoFactorEnrolled: true, resetStatus: 'pending_approval' },
          newValue: { twoFactorEnrolled: false, resetStatus: 'approved', approvedBy: 'Platform Admin' },
          ipAddress: '172.16.0.4',
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
          createdAt: new Date(now - 0.5 * 86400000),
        },
      ];

      for (const entry of seedEntries) {
        await this.db.platformAuditLog.create({
          data: entry,
        });
      }

      this.logger.log(`Successfully seeded ${seedEntries.length} platform audit log entries.`);
    } catch (err: any) {
      this.logger.warn(`Could not seed platform audit log history: ${err.message}`);
    }
  }
}
