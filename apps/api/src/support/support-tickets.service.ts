import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';
import type {
  SupportTicketDetail,
  SupportTicketMessageRecord,
  SupportTicketRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';

@Injectable()
export class SupportTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  canManage(user: AuthenticatedUser): boolean {
    return this.permissions.hasPermission(user, 'support', 'edit');
  }

  private toRecord(
    row: {
      id: string;
      tenantId: string;
      companyId: string | null;
      ticketNumber: string;
      subject: string;
      description: string;
      status: SupportTicketStatus;
      priority: SupportTicketPriority;
      requesterUserId: string;
      requesterEmployeeId: string | null;
      assignedToUserId: string | null;
      resolvedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      _count?: { messages: number };
    },
  ): SupportTicketRecord {
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
      assignedToUserId: row.assignedToUserId,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      messageCount: row._count?.messages,
    };
  }

  private toMessage(row: {
    id: string;
    ticketId: string;
    authorUserId: string;
    body: string;
    isInternal: boolean;
    createdAt: Date;
  }): SupportTicketMessageRecord {
    return {
      id: row.id,
      ticketId: row.ticketId,
      authorUserId: row.authorUserId,
      body: row.body,
      isInternal: row.isInternal,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async nextTicketNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.unscoped.supportTicket.count({
      where: { tenantId },
    });
    return `SUP-${String(count + 1).padStart(4, '0')}`;
  }

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
    return rows.map((row) => this.toRecord(row));
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

    return {
      ...this.toRecord(row),
      messages: messages.map((message) => this.toMessage(message)),
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
    const ticketNumber = await this.nextTicketNumber(tenantId);
    const row = await this.prisma.unscoped.supportTicket.create({
      data: {
        tenantId,
        companyId: input.companyId ?? null,
        ticketNumber,
        subject: input.subject.trim(),
        description: input.description.trim(),
        priority: input.priority ?? SupportTicketPriority.medium,
        requesterUserId: user.id,
        requesterEmployeeId: user.employeeId,
        status: SupportTicketStatus.open,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'create',
      module: 'support',
      recordId: row.id,
      newValue: { ticketNumber: row.ticketNumber, subject: row.subject },
    });

    return this.getTicket(tenantId, row.id, user);
  }

  async updateTicket(
    tenantId: string,
    ticketId: string,
    input: {
      status?: SupportTicketStatus;
      priority?: SupportTicketPriority;
      assignedToUserId?: string | null;
    },
    user: AuthenticatedUser,
  ): Promise<SupportTicketRecord> {
    const existing = await this.prisma.unscoped.supportTicket.findFirst({
      where: { id: ticketId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Ticket not found' });
    }

    const resolvedAt =
      input.status === SupportTicketStatus.resolved ||
      input.status === SupportTicketStatus.closed
        ? new Date()
        : input.status != null
          ? null
          : undefined;

    const row = await this.prisma.unscoped.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: input.status,
        priority: input.priority,
        assignedToUserId:
          input.assignedToUserId !== undefined
            ? input.assignedToUserId
            : undefined,
        resolvedAt,
      },
      include: { _count: { select: { messages: true } } },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'update',
      module: 'support',
      recordId: row.id,
      newValue: {
        status: row.status,
        priority: row.priority,
        assignedToUserId: row.assignedToUserId,
      },
    });

    return this.toRecord(row);
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

    await this.prisma.unscoped.supportTicketMessage.create({
      data: {
        tenantId,
        ticketId,
        authorUserId: user.id,
        body: input.body.trim(),
        isInternal: input.isInternal ?? false,
      },
    });

    if (
      manage &&
      ticket.status === SupportTicketStatus.open &&
      ticket.requesterUserId !== user.id
    ) {
      await this.prisma.unscoped.supportTicket.update({
        where: { id: ticketId },
        data: { status: SupportTicketStatus.in_progress },
      });
    } else if (
      !manage &&
      (ticket.status === SupportTicketStatus.waiting ||
        ticket.status === SupportTicketStatus.in_progress)
    ) {
      await this.prisma.unscoped.supportTicket.update({
        where: { id: ticketId },
        data: { status: SupportTicketStatus.open },
      });
    }

    await this.prisma.unscoped.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    return this.getTicket(tenantId, ticketId, user);
  }
}
