// apps/api/src/platform/support-tickets/platform-support-tickets.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  CreatePlatformTicketMessageInput,
  PLAN_SLA_POLICIES,
  PlanSlaPolicy,
  PlatformStaffAssignee,
  PlatformSupportQueueQuery,
  PlatformSupportQueueResponse,
  PlatformSupportTicketDetail,
  PlatformSupportTicketItem,
  PlatformSupportTicketPriority,
  PlatformSupportTicketStatus,
  PlatformTicketMessageItem,
  SlaStatus,
  TicketSlaMetrics,
  UpdatePlatformTicketInput,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';

export interface PlatformActorContext {
  id?: string;
  email?: string;
  roleName?: string;
  permissions?: Array<{ module: string; action: string }>;
}

@Injectable()
export class PlatformSupportTicketsService implements OnModuleInit {
  private readonly logger = new Logger(PlatformSupportTicketsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedCrossTenantTicketsIfEmpty();
  }

  /**
   * Calculate SLA target deadlines and remaining time based on tenant plan.
   */
  calculateSla(ticket: {
    createdAt: Date;
    resolvedAt?: Date | null;
    status: string;
    messages?: Array<{ authorUserId: string; isInternal: boolean }>;
  }, planCodeRaw: string): TicketSlaMetrics {
    const planCode = planCodeRaw ? planCodeRaw.toLowerCase() : 'default';
    const policy: PlanSlaPolicy =
      PLAN_SLA_POLICIES[planCode] || PLAN_SLA_POLICIES.default;

    const createdTime = ticket.createdAt.getTime();
    const now = Date.now();

    const responseTargetMs = policy.responseHours * 60 * 60 * 1000;
    const resolutionTargetMs = policy.resolutionHours * 60 * 60 * 1000;

    const responseDeadline = new Date(createdTime + responseTargetMs);
    const resolutionDeadline = new Date(createdTime + resolutionTargetMs);

    const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';

    // Has a staff member replied publicly?
    const hasStaffReply = ticket.messages?.some((m) => !m.isInternal) ?? false;

    let isResponseBreached = false;
    if (!hasStaffReply) {
      if (now > responseDeadline.getTime()) {
        isResponseBreached = true;
      }
    }

    let isResolutionBreached = false;
    if (!isResolved) {
      if (now > resolutionDeadline.getTime()) {
        isResolutionBreached = true;
      }
    } else if (ticket.resolvedAt) {
      if (ticket.resolvedAt.getTime() > resolutionDeadline.getTime()) {
        isResolutionBreached = true;
      }
    }

    // Remaining time calculation (target resolution deadline for open/in_progress/waiting)
    const targetMs = isResolved
      ? resolutionDeadline.getTime()
      : hasStaffReply
        ? resolutionDeadline.getTime()
        : responseDeadline.getTime();

    const diffMs = targetMs - now;
    const remainingMinutes = Math.round(diffMs / 60000);

    let status: SlaStatus = 'healthy';
    let label = '';

    if (isResolved) {
      status = 'met';
      label = isResolutionBreached ? 'Resolved (SLA Breached)' : 'Resolved within SLA';
    } else if (isResponseBreached || isResolutionBreached) {
      status = 'breached';
      const overdueMinutes = Math.abs(remainingMinutes);
      const overdueHours = Math.floor(overdueMinutes / 60);
      label = overdueHours > 0
        ? `SLA Breached (${overdueHours}h overdue)`
        : `SLA Breached (${overdueMinutes}m overdue)`;
    } else if (remainingMinutes < 60 || (diffMs / (hasStaffReply ? resolutionTargetMs : responseTargetMs)) < 0.25) {
      status = 'warning';
      label = remainingMinutes > 60
        ? `${Math.floor(remainingMinutes / 60)}h remaining`
        : `${remainingMinutes}m remaining`;
    } else {
      status = 'healthy';
      const remainingHours = Math.floor(remainingMinutes / 60);
      label = remainingHours > 0 ? `${remainingHours}h remaining` : `${remainingMinutes}m remaining`;
    }

    const planDisplayName =
      planCode.charAt(0).toUpperCase() + planCode.slice(1);

    return {
      planCode,
      planName: planDisplayName,
      responseTargetHours: policy.responseHours,
      resolutionTargetHours: policy.resolutionHours,
      responseDeadline: responseDeadline.toISOString(),
      resolutionDeadline: resolutionDeadline.toISOString(),
      isResponseBreached,
      isResolutionBreached,
      remainingMinutes,
      status,
      label,
    };
  }

  /**
   * Assert actor has platform staff privileges to access Support Tickets.
   */
  assertStaffAccess(actor?: PlatformActorContext): void {
    if (!actor) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Platform authentication required.',
      });
    }

    const role = actor.roleName || '';
    if (
      role === 'Platform Owner' ||
      role === 'Platform Admin' ||
      role === 'Support Agent'
    ) {
      return;
    }

    const hasPermission = actor.permissions?.some(
      (p) =>
        (p.module === 'support' || p.module === 'platform') &&
        (p.action === 'view' || p.action === 'manage' || p.action === 'edit'),
    );

    if (hasPermission) {
      return;
    }

    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Access restricted: Support Ticket Queue requires Support Agent, Platform Admin, or Platform Owner privileges.',
    });
  }

  /**
   * List platform support queue across all tenants with filtering, SLA metrics, and status counts.
   */
  async getQueue(
    query: PlatformSupportQueueQuery,
    actor?: PlatformActorContext,
  ): Promise<PlatformSupportQueueResponse> {
    this.assertStaffAccess(actor);

    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.tenantId && query.tenantId !== 'all') {
      where.tenantId = query.tenantId;
    }

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (query.priority && query.priority !== 'all') {
      where.priority = query.priority;
    }

    if (query.assigneeId && query.assigneeId !== 'all') {
      if (query.assigneeId === 'unassigned') {
        where.assignedToUserId = null;
      } else if (query.assigneeId === 'me' && actor?.id) {
        where.assignedToUserId = actor.id;
      } else {
        where.assignedToUserId = query.assigneeId;
      }
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { ticketNumber: { contains: term, mode: 'insensitive' } },
        { subject: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { tenant: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [rows, total, allStatusCounts, staffUsers] = await Promise.all([
      this.prisma.unscoped.supportTicket.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              subdomain: true,
              planId: true,
            },
          },
          messages: {
            select: {
              authorUserId: true,
              isInternal: true,
            },
          },
        },
      }),
      this.prisma.unscoped.supportTicket.count({ where }),
      this.prisma.unscoped.supportTicket.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.unscoped.platformUser.findMany({
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
    ]);

    const staffMap = new Map<string, { name: string; email: string }>();
    staffUsers.forEach((s) => {
      staffMap.set(s.id, {
        name: `${s.firstName} ${s.lastName}`.trim(),
        email: s.email,
      });
    });

    const items: PlatformSupportTicketItem[] = rows.map((r) => {
      const planCode = r.tenant.planId || 'default';
      const sla = this.calculateSla(r, planCode);
      const assignee = r.assignedToUserId ? staffMap.get(r.assignedToUserId) : null;

      return {
        id: r.id,
        ticketNumber: r.ticketNumber,
        subject: r.subject,
        description: r.description,
        status: r.status as PlatformSupportTicketStatus,
        priority: r.priority as PlatformSupportTicketPriority,
        tenantId: r.tenantId,
        tenantName: r.tenant.name,
        tenantSubdomain: r.tenant.subdomain,
        planId: r.tenant.planId || 'free',
        planName: sla.planName,
        requesterUserId: r.requesterUserId,
        requesterName: 'Tenant Requester',
        requesterEmail: 'user@tenant.local',
        assignedToUserId: r.assignedToUserId,
        assigneeName: assignee ? assignee.name : null,
        assigneeEmail: assignee ? assignee.email : null,
        messagesCount: r.messages.length,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
        sla,
      };
    });

    // Compute status counts
    const counts = {
      all: 0,
      open: 0,
      in_progress: 0,
      waiting: 0,
      resolved: 0,
      closed: 0,
    };

    allStatusCounts.forEach((sc) => {
      const st = sc.status as PlatformSupportTicketStatus;
      if (counts[st] !== undefined) {
        counts[st] += sc._count._all;
      }
      counts.all += sc._count._all;
    });

    // Compute SLA counts
    const slaCounts = {
      healthy: 0,
      warning: 0,
      breached: 0,
    };

    items.forEach((item) => {
      if (item.sla.status === 'breached') slaCounts.breached++;
      else if (item.sla.status === 'warning') slaCounts.warning++;
      else if (item.sla.status === 'healthy') slaCounts.healthy++;
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
      counts,
      slaCounts,
    };
  }

  /**
   * Get single Ticket Detail including all public and internal messages, tenant details, and SLA metrics.
   */
  async getTicketDetail(
    ticketId: string,
    actor?: PlatformActorContext,
  ): Promise<PlatformSupportTicketDetail> {
    this.assertStaffAccess(actor);

    const ticket = await this.prisma.unscoped.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            planId: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: `Support ticket ${ticketId} not found.`,
      });
    }

    const [staffUsers, activeSupportSession] = await Promise.all([
      this.prisma.unscoped.platformUser.findMany({
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      this.prisma.unscoped.supportAccessRequest.findFirst({
        where: {
          tenantId: ticket.tenantId,
          status: 'approved',
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const staffMap = new Map<string, { name: string; email: string }>();
    staffUsers.forEach((s) => {
      staffMap.set(s.id, {
        name: `${s.firstName} ${s.lastName}`.trim(),
        email: s.email,
      });
    });

    const planCode = ticket.tenant.planId || 'default';
    const sla = this.calculateSla(ticket, planCode);
    const assignee = ticket.assignedToUserId ? staffMap.get(ticket.assignedToUserId) : null;

    const messages: PlatformTicketMessageItem[] = ticket.messages.map((m) => {
      const staffAuthor = staffMap.get(m.authorUserId);
      const isStaff = Boolean(staffAuthor) || m.isInternal;

      return {
        id: m.id,
        ticketId: m.ticketId,
        authorUserId: m.authorUserId,
        authorName: staffAuthor ? staffAuthor.name : 'Customer Contact',
        authorEmail: staffAuthor ? staffAuthor.email : 'requester@tenant.local',
        authorRole: isStaff ? 'staff' : 'customer',
        body: m.body,
        isInternal: m.isInternal,
        createdAt: m.createdAt.toISOString(),
      };
    });

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status as PlatformSupportTicketStatus,
      priority: ticket.priority as PlatformSupportTicketPriority,
      tenantId: ticket.tenantId,
      tenantName: ticket.tenant.name,
      tenantSubdomain: ticket.tenant.subdomain,
      planId: ticket.tenant.planId || 'free',
      planName: sla.planName,
      requesterUserId: ticket.requesterUserId,
      requesterName: 'Tenant Contact',
      requesterEmail: 'user@tenant.local',
      assignedToUserId: ticket.assignedToUserId,
      assigneeName: assignee ? assignee.name : null,
      assigneeEmail: assignee ? assignee.email : null,
      messagesCount: messages.length,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
      sla,
      messages,
      activeSupportSession: activeSupportSession
        ? {
            id: activeSupportSession.id,
            status: activeSupportSession.status,
            expiresAt: activeSupportSession.expiresAt
              ? activeSupportSession.expiresAt.toISOString()
              : '',
            accessMode: activeSupportSession.accessMode,
          }
        : null,
    };
  }

  /**
   * Update support ticket status, priority, or assignee.
   */
  async updateTicket(
    ticketId: string,
    input: UpdatePlatformTicketInput,
    actor?: PlatformActorContext,
  ): Promise<PlatformSupportTicketDetail> {
    this.assertStaffAccess(actor);

    const existing = await this.prisma.unscoped.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: `Support ticket ${ticketId} not found.`,
      });
    }

    const data: any = {};
    if (input.priority) {
      data.priority = input.priority;
    }
    if (input.assignedToUserId !== undefined) {
      data.assignedToUserId = input.assignedToUserId;
    }
    if (input.status) {
      data.status = input.status;
      if (input.status === 'resolved' || input.status === 'closed') {
        data.resolvedAt = new Date();
      } else {
        data.resolvedAt = null;
      }
    }

    await this.prisma.unscoped.supportTicket.update({
      where: { id: ticketId },
      data,
    });

    // Write audit log
    try {
      await this.prisma.unscoped.platformAuditLog.create({
        data: {
          userId: actor?.id || null,
          action: 'SUPPORT_TICKET_UPDATED',
          module: 'support:tickets',
          recordId: ticketId,
          reason: `Ticket ${existing.ticketNumber} updated by ${actor?.email || 'Platform Staff'}`,
          oldValue: {
            status: existing.status,
            priority: existing.priority,
            assignedToUserId: existing.assignedToUserId,
          },
          newValue: data,
        },
      });
    } catch (auditErr: any) {
      this.logger.warn(`Failed to write audit log: ${auditErr.message}`);
    }

    return this.getTicketDetail(ticketId, actor);
  }

  /**
   * Add a public customer reply or an internal staff note.
   */
  async createMessage(
    ticketId: string,
    input: CreatePlatformTicketMessageInput,
    actor?: PlatformActorContext,
  ): Promise<PlatformTicketMessageItem> {
    this.assertStaffAccess(actor);

    if (!input.body?.trim()) {
      throw new BadRequestException({
        code: 'MESSAGE_BODY_REQUIRED',
        message: 'Message body cannot be empty.',
      });
    }

    const ticket = await this.prisma.unscoped.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: `Support ticket ${ticketId} not found.`,
      });
    }

    const authorUserId = actor?.id || '14c94176-c1c5-43fe-928f-e32624f71f87';

    const message = await this.prisma.unscoped.supportTicketMessage.create({
      data: {
        ticketId,
        tenantId: ticket.tenantId,
        authorUserId,
        body: input.body.trim(),
        isInternal: Boolean(input.isInternal),
      },
    });

    // Status transition rules:
    // 1. If explicit status provided in input, use it.
    // 2. If it's a customer-visible reply (isInternal === false):
    //    - If ticket was 'open', move to 'in_progress' and assign to replying staff if unassigned.
    //    - If replied with a question to customer, can move to 'waiting'.
    const ticketUpdates: any = {};
    if (input.status) {
      ticketUpdates.status = input.status;
      if (input.status === 'resolved' || input.status === 'closed') {
        ticketUpdates.resolvedAt = new Date();
      }
    } else if (!input.isInternal) {
      if (ticket.status === 'open') {
        ticketUpdates.status = 'in_progress';
      }
      if (!ticket.assignedToUserId && actor?.id) {
        ticketUpdates.assignedToUserId = actor.id;
      }
    }

    if (Object.keys(ticketUpdates).length > 0) {
      await this.prisma.unscoped.supportTicket.update({
        where: { id: ticketId },
        data: ticketUpdates,
      });
    }

    // Write audit log
    try {
      await this.prisma.unscoped.platformAuditLog.create({
        data: {
          userId: actor?.id || null,
          action: input.isInternal ? 'SUPPORT_TICKET_INTERNAL_NOTE' : 'SUPPORT_TICKET_REPLY',
          module: 'support:tickets',
          recordId: ticketId,
          reason: `${input.isInternal ? 'Internal note added' : 'Public reply sent'} to ${ticket.ticketNumber}`,
          oldValue: { messageId: message.id, isInternal: input.isInternal },
        },
      });
    } catch (auditErr: any) {
      this.logger.warn(`Failed to write audit log: ${auditErr.message}`);
    }

    return {
      id: message.id,
      ticketId: message.ticketId,
      authorUserId: message.authorUserId,
      authorName: actor?.email ? (actor.email.split('@')[0]) : 'Platform Staff',
      authorEmail: actor?.email || 'staff@platform.local',
      authorRole: 'staff',
      body: message.body,
      isInternal: message.isInternal,
      createdAt: message.createdAt.toISOString(),
    };
  }

  /**
   * Get list of active platform staff assignees.
   */
  async getStaffAssignees(): Promise<PlatformStaffAssignee[]> {
    const staff = await this.prisma.unscoped.platformUser.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: { select: { name: true } },
      },
      orderBy: { firstName: 'asc' },
    });

    return staff.map((s) => ({
      id: s.id,
      email: s.email,
      firstName: s.firstName,
      lastName: s.lastName,
      roleName: s.role.name,
    }));
  }

  /**
   * Seeds realistic demo support tickets across multiple tenants if database only has test tickets.
   */
  async seedCrossTenantTicketsIfEmpty(): Promise<void> {
    try {
      const count = await this.prisma.unscoped.supportTicket.count();
      if (count >= 5) return;

      const tenants = await this.prisma.unscoped.tenant.findMany({
        where: {
          subdomain: { in: ['globex', 'acme', 'techflow', 'vertex', 'northstar'] },
        },
        select: { id: true, subdomain: true, name: true, planId: true },
      });

      if (tenants.length === 0) return;

      const tenantMap = new Map(tenants.map((t) => [t.subdomain, t]));

      const globex = tenantMap.get('globex');
      const acme = tenantMap.get('acme');
      const techflow = tenantMap.get('techflow');
      const vertex = tenantMap.get('vertex');
      const northstar = tenantMap.get('northstar');

      const staff = await this.prisma.unscoped.platformUser.findFirst({
        where: { role: { name: { in: ['Platform Owner', 'Support Agent', 'Platform Admin'] } } },
      });

      const staffId = staff?.id || '14c94176-c1c5-43fe-928f-e32624f71f87';

      // 1. Globex (Enterprise) - SUP-4821
      if (globex) {
        const globexTicket = await this.prisma.unscoped.supportTicket.create({
          data: {
            tenantId: globex.id,
            ticketNumber: 'SUP-4821',
            subject: 'Payroll submission blocked for November cycle with tax calculation anomaly',
            description: 'Our HR manager attempted to finalize the monthly payroll batch for our UK division, but the system returned a 500 error regarding expired tax brackets. This is blocking salary disbursement for 180 employees.',
            status: 'open',
            priority: 'urgent',
            requesterUserId: staffId,
            createdAt: new Date(Date.now() - 40 * 60 * 1000), // 40m ago (Enterprise 1h SLA -> 20m remaining)
          },
        });

        await this.prisma.unscoped.supportTicketMessage.create({
          data: {
            tenantId: globex.id,
            ticketId: globexTicket.id,
            authorUserId: staffId,
            body: 'Customer attached export log: TaxRuleResolutionError for country GB.',
            isInternal: true,
          },
        });
      }

      // 2. Acme (Enterprise) - SUP-4818
      if (acme) {
        const acmeTicket = await this.prisma.unscoped.supportTicket.create({
          data: {
            tenantId: acme.id,
            ticketNumber: 'SUP-4818',
            subject: 'SAML SSO users receive an invalid audience error upon login',
            description: 'Employees logging in through our Okta SAML application receive an audience mismatch error on the assertion token callback.',
            status: 'in_progress',
            priority: 'high',
            requesterUserId: staffId,
            assignedToUserId: staffId,
            createdAt: new Date(Date.now() - 90 * 60 * 1000), // 90m ago
          },
        });

        await this.prisma.unscoped.supportTicketMessage.create({
          data: {
            tenantId: acme.id,
            ticketId: acmeTicket.id,
            authorUserId: staffId,
            body: 'We are reviewing the SP Entity ID configured for your tenant workspace (acme.cmsnbd.com). Please verify if your Okta app uses https://acme.cmsnbd.com/saml/metadata as audience.',
            isInternal: false,
            createdAt: new Date(Date.now() - 30 * 60 * 1000),
          },
        });

        await this.prisma.unscoped.supportTicketMessage.create({
          data: {
            tenantId: acme.id,
            ticketId: acmeTicket.id,
            authorUserId: staffId,
            body: 'Verified certificate validity: Let\'s encrypt cert renewed 2 days ago. Check Okta metadata XML upload.',
            isInternal: true,
            createdAt: new Date(Date.now() - 25 * 60 * 1000),
          },
        });
      }

      // 3. TechFlow (Business) - SUP-4812
      if (techflow) {
        const techflowTicket = await this.prisma.unscoped.supportTicket.create({
          data: {
            tenantId: techflow.id,
            ticketNumber: 'SUP-4812',
            subject: 'Custom annual leave balance import CSV error for probationers',
            description: 'When uploading the CSV for leave balances, the import fails on row 14 with "Invalid entitlement code". Which policy code should be used for employees under 3-month probation?',
            status: 'waiting',
            priority: 'medium',
            requesterUserId: staffId,
            assignedToUserId: staffId,
            createdAt: new Date(Date.now() - 150 * 60 * 1000),
          },
        });

        await this.prisma.unscoped.supportTicketMessage.create({
          data: {
            tenantId: techflow.id,
            ticketId: techflowTicket.id,
            authorUserId: staffId,
            body: 'Hello Ethan, for probationers you should reference policy code "AL-PROB-01" as configured in your company leave policy rules. Please let us know if that resolves the import.',
            isInternal: false,
            createdAt: new Date(Date.now() - 60 * 60 * 1000),
          },
        });
      }

      // 4. Vertex Health (Starter) - SUP-4804
      if (vertex) {
        await this.prisma.unscoped.supportTicket.create({
          data: {
            tenantId: vertex.id,
            ticketNumber: 'SUP-4804',
            subject: 'How to invite an additional HR payroll administrator',
            description: 'We recently hired a secondary payroll officer and would like to grant them access to process monthly wages without full owner privileges.',
            status: 'resolved',
            priority: 'low',
            requesterUserId: staffId,
            assignedToUserId: staffId,
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            resolvedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
          },
        });
      }

      // 5. Northstar Retail (Business) - SUP-4799
      if (northstar) {
        const northstarTicket = await this.prisma.unscoped.supportTicket.create({
          data: {
            tenantId: northstar.id,
            ticketNumber: 'SUP-4799',
            subject: 'Attendance biometric device clock skew sync delay',
            description: 'Punches recorded from mobile devices at Store #4 are lagging by 35 minutes on the live attendance roster dashboard.',
            status: 'in_progress',
            priority: 'high',
            requesterUserId: staffId,
            assignedToUserId: staffId,
            createdAt: new Date(Date.now() - 220 * 60 * 1000), // 3.6 hours ago (Business 4h SLA -> 20m left!)
          },
        });

        await this.prisma.unscoped.supportTicketMessage.create({
          data: {
            tenantId: northstar.id,
            ticketId: northstarTicket.id,
            authorUserId: staffId,
            body: 'Investigating BullMQ attendance-sync queue backlog for tenant Northstar.',
            isInternal: true,
          },
        });
      }

      this.logger.log('Successfully seeded cross-tenant demo support tickets with SLA timers.');
    } catch (err: any) {
      this.logger.warn(`Could not seed demo support tickets: ${err.message}`);
    }
  }
}
