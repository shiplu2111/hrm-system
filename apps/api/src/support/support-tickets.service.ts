import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SupportTicketPriority,
  SupportTicketStatus,
  type SupportTicket,
  type SupportTicketMessage,
} from '@prisma/client';
import {
  SUPPORT_WORKFLOW_STATUSES,
  supportStatusAfterMessage,
  supportWorkflowStatus,
  type SupportAgent,
  type SupportQueueList,
  type SupportQueueQuery,
  type SupportTicketDetail,
  type SupportTicketMessageRecord,
  type SupportTicketRecord,
  type SupportWorkflowStatus,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';
import { PermissionsService } from '../rbac/permissions.service';
import { assertSupportTransition, supportStatusesFor } from './support.utils';

type TicketRow = SupportTicket & { _count?: { messages: number } };

interface UserSummary {
  name: string;
  email: string;
}

const TICKET_NUMBER_ATTEMPTS = 5;
const DEFAULT_QUEUE_PAGE_SIZE = 25;

@Injectable()
export class SupportTicketsService {
  private readonly logger = new Logger(SupportTicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly auditService: AuditService,
    private readonly notifications: NotificationDeliveryService,
  ) {}

  canManage(user: AuthenticatedUser): boolean {
    return this.permissions.hasPermission(user, 'support', 'edit');
  }

  /** Requester-only list used by My Space and the mobile app (managers see all). */
  async listTickets(
    tenantId: string,
    user: AuthenticatedUser,
  ): Promise<SupportTicketRecord[]> {
    const manage = this.canManage(user);
    const rows = await this.prisma.unscoped.supportTicket.findMany({
      where: {
        tenantId,
        ...(manage ? {} : { requesterUserId: user.id }),
      },
      orderBy: [{ updatedAt: 'desc' }],
      include: { _count: { select: { messages: true } } },
    });
    return this.toRecords(rows);
  }

  async listQueue(
    tenantId: string,
    user: AuthenticatedUser,
    query: SupportQueueQuery,
  ): Promise<SupportQueueList> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_QUEUE_PAGE_SIZE;
    const base: Prisma.SupportTicketWhereInput = { tenantId };

    if (query.priority) base.priority = query.priority;
    if (query.assignee === 'me') base.assignedToUserId = user.id;
    if (query.assignee === 'unassigned') base.assignedToUserId = null;

    const search = query.search?.trim();
    if (search) {
      const requesterIds = await this.findUserIdsMatching(tenantId, search);
      base.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        ...(requesterIds.length > 0 ? [{ requesterUserId: { in: requesterIds } }] : []),
      ];
    }

    const where: Prisma.SupportTicketWhereInput =
      query.status && query.status !== 'all'
        ? { ...base, status: { in: supportStatusesFor(query.status) } }
        : base;

    const [rows, total, grouped] = await Promise.all([
      this.prisma.unscoped.supportTicket.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { messages: true } } },
      }),
      this.prisma.unscoped.supportTicket.count({ where }),
      this.prisma.unscoped.supportTicket.groupBy({
        by: ['status'],
        where: base,
        _count: { _all: true },
      }),
    ]);

    const counts = Object.fromEntries(
      SUPPORT_WORKFLOW_STATUSES.map((status) => [status, 0]),
    ) as Record<SupportWorkflowStatus, number>;
    for (const group of grouped) {
      counts[supportWorkflowStatus(group.status)] += group._count._all;
    }

    return {
      items: await this.toRecords(rows),
      total,
      page,
      pageSize,
      counts,
    };
  }

  /** Active users who can work tickets (support:edit). */
  async listAgents(tenantId: string): Promise<SupportAgent[]> {
    const users = await this.prisma.unscoped.user.findMany({
      where: {
        tenantId,
        isActive: true,
        role: { permissions: { some: { module: 'support', action: 'edit' } } },
      },
      select: {
        id: true,
        email: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    });
    return users
      .map((user) => ({ id: user.id, name: displayName(user), email: user.email }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getTicket(
    tenantId: string,
    ticketId: string,
    user: AuthenticatedUser,
  ): Promise<SupportTicketDetail> {
    const manage = this.canManage(user);
    const row = await this.prisma.unscoped.supportTicket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Ticket not found' });
    }
    if (!manage && row.requesterUserId !== user.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    const messages = manage
      ? row.messages
      : row.messages.filter((message) => !message.isInternal);

    const names = await this.userSummaries([
      row.requesterUserId,
      row.assignedToUserId,
      ...messages.map((message) => message.authorUserId),
    ]);

    return {
      ...this.toRecord({ ...row, _count: { messages: messages.length } }, names),
      messages: messages.map((message) => this.toMessage(message, row, names)),
    };
  }

  async createTicket(
    tenantId: string,
    input: {
      subject: string;
      description: string;
      priority?: SupportTicketPriority;
      companyId?: string;
    },
    user: AuthenticatedUser,
  ): Promise<SupportTicketDetail> {
    let row: SupportTicket | null = null;
    for (let attempt = 0; attempt < TICKET_NUMBER_ATTEMPTS && !row; attempt += 1) {
      try {
        row = await this.prisma.unscoped.supportTicket.create({
          data: {
            tenantId,
            companyId: input.companyId ?? null,
            ticketNumber: await this.nextTicketNumber(tenantId, attempt),
            subject: input.subject.trim(),
            description: input.description.trim(),
            priority: input.priority ?? SupportTicketPriority.medium,
            requesterUserId: user.id,
            requesterEmployeeId: user.employeeId,
            status: SupportTicketStatus.open,
          },
        });
      } catch (error) {
        const duplicate =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!duplicate || attempt === TICKET_NUMBER_ATTEMPTS - 1) throw error;
      }
    }
    const created = row!;

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'create',
      module: 'support',
      recordId: created.id,
      newValue: { ticketNumber: created.ticketNumber, subject: created.subject },
    });

    return this.getTicket(tenantId, created.id, user);
  }

  async updateTicket(
    tenantId: string,
    ticketId: string,
    input: {
      status?: SupportWorkflowStatus;
      priority?: SupportTicketPriority;
      assignedToUserId?: string | null;
      note?: string;
    },
    user: AuthenticatedUser,
  ): Promise<SupportTicketDetail> {
    const existing = await this.prisma.unscoped.supportTicket.findFirst({
      where: { id: ticketId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Ticket not found' });
    }

    const note = input.note?.trim();
    if (note && !input.status) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A note can only be sent together with a status change',
      });
    }
    if (input.status) assertSupportTransition(existing.status, input.status);
    if (input.assignedToUserId) {
      await this.assertAgent(tenantId, input.assignedToUserId);
    }

    const statusChanged = input.status != null && input.status !== existing.status;
    const assigneeChanged =
      input.assignedToUserId !== undefined &&
      input.assignedToUserId !== existing.assignedToUserId;

    // Starting work on an unassigned ticket assigns it to whoever started it.
    const autoAssign =
      input.status === 'in_progress' &&
      input.assignedToUserId === undefined &&
      !existing.assignedToUserId;

    const data: Prisma.SupportTicketUpdateInput = {
      priority: input.priority,
      ...(statusChanged
        ? {
            status: input.status,
            resolvedAt: input.status === 'resolved' ? new Date() : null,
          }
        : {}),
      ...(assigneeChanged ? { assignedToUserId: input.assignedToUserId } : {}),
      ...(autoAssign ? { assignedToUserId: user.id } : {}),
    };

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      if (note) {
        await tx.supportTicketMessage.create({
          data: { tenantId, ticketId, authorUserId: user.id, body: note, isInternal: false },
        });
      }
      return tx.supportTicket.update({ where: { id: ticketId }, data });
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'update',
      module: 'support',
      recordId: row.id,
      oldValue: {
        status: existing.status,
        priority: existing.priority,
        assignedToUserId: existing.assignedToUserId,
      },
      newValue: {
        status: row.status,
        priority: row.priority,
        assignedToUserId: row.assignedToUserId,
      },
    });

    if (statusChanged && row.status === SupportTicketStatus.resolved) {
      await this.notifyRequester(row, user, {
        eventType: 'support.ticket_resolved',
        title: `${row.ticketNumber} resolved`,
        body: note ? truncate(note) : `Your ticket "${row.subject}" was marked as resolved.`,
      });
    } else if (note) {
      await this.notifyRequester(row, user, {
        eventType: 'support.ticket_reply',
        title: `New reply on ${row.ticketNumber}`,
        body: truncate(note),
      });
    }
    if (row.assignedToUserId && row.assignedToUserId !== existing.assignedToUserId) {
      await this.notifyAssignee(row, user);
    }

    return this.getTicket(tenantId, ticketId, user);
  }

  async addMessage(
    tenantId: string,
    ticketId: string,
    input: { body: string; isInternal?: boolean },
    user: AuthenticatedUser,
  ): Promise<SupportTicketDetail> {
    const manage = this.canManage(user);
    const ticket = await this.prisma.unscoped.supportTicket.findFirst({
      where: { id: ticketId, tenantId },
    });
    if (!ticket) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Ticket not found' });
    }
    if (!manage && ticket.requesterUserId !== user.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Access denied' });
    }
    if (input.isInternal && !manage) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Internal notes require support edit permission',
      });
    }

    const fromStaff = manage && ticket.requesterUserId !== user.id;
    const isInternal = input.isInternal ?? false;
    const body = input.body.trim();
    const nextStatus = supportStatusAfterMessage({
      status: ticket.status,
      fromStaff,
      isInternal,
      hasAssignee: ticket.assignedToUserId != null,
    });
    const assignToReplier = fromStaff && !isInternal && !ticket.assignedToUserId;

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.supportTicketMessage.create({
        data: { tenantId, ticketId, authorUserId: user.id, body, isInternal },
      });
      return tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          updatedAt: new Date(),
          ...(nextStatus
            ? {
                status: nextStatus,
                resolvedAt: nextStatus === 'resolved' ? new Date() : null,
              }
            : {}),
          ...(assignToReplier ? { assignedToUserId: user.id } : {}),
        },
      });
    });

    if (fromStaff && !isInternal) {
      await this.notifyRequester(row, user, {
        eventType: 'support.ticket_reply',
        title: `New reply on ${row.ticketNumber}`,
        body: truncate(body),
      });
    } else if (!fromStaff && row.assignedToUserId && row.assignedToUserId !== user.id) {
      await this.notify(row, row.assignedToUserId, {
        eventType: 'support.ticket_requester_reply',
        title: `${row.ticketNumber}: requester replied`,
        body: truncate(body),
      });
    }

    return this.getTicket(tenantId, ticketId, user);
  }

  private async nextTicketNumber(tenantId: string, offset: number): Promise<string> {
    const count = await this.prisma.unscoped.supportTicket.count({
      where: { tenantId },
    });
    return `SUP-${String(count + 1 + offset).padStart(4, '0')}`;
  }

  private async assertAgent(tenantId: string, userId: string): Promise<void> {
    const agent = await this.prisma.unscoped.user.findFirst({
      where: {
        id: userId,
        tenantId,
        isActive: true,
        role: { permissions: { some: { module: 'support', action: 'edit' } } },
      },
      select: { id: true },
    });
    if (!agent) {
      throw new BadRequestException({
        code: 'INVALID_ASSIGNEE',
        message: 'Tickets can only be assigned to active users with support edit permission',
      });
    }
  }

  private async findUserIdsMatching(tenantId: string, search: string): Promise<string[]> {
    const users = await this.prisma.unscoped.user.findMany({
      where: {
        tenantId,
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { employee: { firstName: { contains: search, mode: 'insensitive' } } },
          { employee: { lastName: { contains: search, mode: 'insensitive' } } },
        ],
      },
      select: { id: true },
      take: 200,
    });
    return users.map((user) => user.id);
  }

  private async userSummaries(
    userIds: Array<string | null>,
  ): Promise<Map<string, UserSummary>> {
    const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return new Map();
    const users = await this.prisma.unscoped.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        email: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    });
    return new Map(
      users.map((user) => [user.id, { name: displayName(user), email: user.email }]),
    );
  }

  private async toRecords(rows: TicketRow[]): Promise<SupportTicketRecord[]> {
    const names = await this.userSummaries(
      rows.flatMap((row) => [row.requesterUserId, row.assignedToUserId]),
    );
    return rows.map((row) => this.toRecord(row, names));
  }

  private toRecord(row: TicketRow, names: Map<string, UserSummary>): SupportTicketRecord {
    const requester = names.get(row.requesterUserId);
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      ticketNumber: row.ticketNumber,
      subject: row.subject,
      description: row.description,
      status: row.status,
      priority: row.priority,
      requesterUserId: row.requesterUserId,
      requesterEmployeeId: row.requesterEmployeeId,
      requesterName: requester?.name ?? null,
      requesterEmail: requester?.email ?? null,
      assignedToUserId: row.assignedToUserId,
      assigneeName: row.assignedToUserId
        ? (names.get(row.assignedToUserId)?.name ?? null)
        : null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      messageCount: row._count?.messages,
    };
  }

  private toMessage(
    row: SupportTicketMessage,
    ticket: SupportTicket,
    names: Map<string, UserSummary>,
  ): SupportTicketMessageRecord {
    return {
      id: row.id,
      ticketId: row.ticketId,
      authorUserId: row.authorUserId,
      authorName: names.get(row.authorUserId)?.name ?? null,
      fromStaff: row.authorUserId !== ticket.requesterUserId,
      body: row.body,
      isInternal: row.isInternal,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async notifyRequester(
    ticket: SupportTicket,
    actor: AuthenticatedUser,
    message: { eventType: string; title: string; body: string },
  ): Promise<void> {
    if (ticket.requesterUserId === actor.id) return;
    await this.notify(ticket, ticket.requesterUserId, message);
  }

  private async notifyAssignee(ticket: SupportTicket, actor: AuthenticatedUser): Promise<void> {
    if (!ticket.assignedToUserId || ticket.assignedToUserId === actor.id) return;
    await this.notify(ticket, ticket.assignedToUserId, {
      eventType: 'support.ticket_assigned',
      title: `${ticket.ticketNumber} assigned to you`,
      body: ticket.subject,
    });
  }

  /** Notifications are best-effort and never block the ticket update. */
  private async notify(
    ticket: SupportTicket,
    userId: string,
    message: { eventType: string; title: string; body: string },
  ): Promise<void> {
    try {
      const companyId = await this.notificationCompanyId(ticket, userId);
      if (!companyId) return;
      await this.notifications.deliverInApp({
        tenantId: ticket.tenantId,
        companyId,
        userId,
        eventType: message.eventType,
        title: message.title,
        body: message.body,
        payload: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
      });
    } catch (error) {
      this.logger.warn(
        `Support notification ${message.eventType} for ${ticket.ticketNumber} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async notificationCompanyId(
    ticket: SupportTicket,
    userId: string,
  ): Promise<string | null> {
    if (ticket.companyId) return ticket.companyId;
    const user = await this.prisma.unscoped.user.findFirst({
      where: { id: userId, tenantId: ticket.tenantId },
      select: { employee: { select: { companyId: true } } },
    });
    if (user?.employee?.companyId) return user.employee.companyId;
    const company = await this.prisma.unscoped.company.findFirst({
      where: { tenantId: ticket.tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return company?.id ?? null;
  }
}

function displayName(user: {
  email: string;
  employee: { firstName: string; lastName: string } | null;
}): string {
  return user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
    : user.email;
}

function truncate(value: string, max = 160): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
