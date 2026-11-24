// apps/api/src/platform/support-tickets/platform-support-tickets.service.spec.ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import {
  PlatformActorContext,
  PlatformSupportTicketsService,
} from './platform-support-tickets.service';

describe('PlatformSupportTicketsService', () => {
  let service: PlatformSupportTicketsService;
  let mockPrisma: any;

  const agentActor: PlatformActorContext = {
    id: 'staff-agent-uuid-1',
    email: 'support.agent@cmsnbd.com',
    roleName: 'Support Agent',
    permissions: [{ module: 'support', action: 'manage' }],
  };

  const ownerActor: PlatformActorContext = {
    id: 'owner-uuid-2',
    email: 'platform.owner@cmsnbd.com',
    roleName: 'Platform Owner',
    permissions: [{ module: 'platform', action: 'manage' }],
  };

  const unauthorizedActor: PlatformActorContext = {
    id: 'unauth-uuid-3',
    email: 'auditor@cmsnbd.com',
    roleName: 'Read-Only Auditor',
    permissions: [{ module: 'audit', action: 'view' }],
  };

  beforeEach(async () => {
    mockPrisma = {
      unscoped: {
        supportTicket: {
          count: jest.fn().mockResolvedValue(5),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          groupBy: jest.fn().mockResolvedValue([
            { status: 'open', _count: { _all: 2 } },
            { status: 'in_progress', _count: { _all: 1 } },
            { status: 'waiting', _count: { _all: 1 } },
            { status: 'resolved', _count: { _all: 1 } },
          ]),
          update: jest.fn(),
          create: jest.fn(),
        },
        supportTicketMessage: {
          create: jest.fn(),
        },
        supportAccessRequest: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        platformUser: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'staff-agent-uuid-1', email: 'support.agent@cmsnbd.com', firstName: 'Support', lastName: 'Agent' },
            { id: 'owner-uuid-2', email: 'platform.owner@cmsnbd.com', firstName: 'Platform', lastName: 'Owner' },
          ]),
          findFirst: jest.fn().mockResolvedValue({ id: 'staff-agent-uuid-1' }),
        },
        tenant: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        platformAuditLog: {
          create: jest.fn().mockResolvedValue({ id: 'audit-log-uuid-1' }),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSupportTicketsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PlatformSupportTicketsService>(PlatformSupportTicketsService);
  });

  describe('SLA Timer & Policy Calculations', () => {
    it('calculates 1h response and 4h resolution target for Enterprise plan', () => {
      const createdAt = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
      const sla = service.calculateSla(
        { createdAt, status: 'open', messages: [] },
        'enterprise',
      );

      expect(sla.responseTargetHours).toBe(1);
      expect(sla.resolutionTargetHours).toBe(4);
      expect(sla.isResponseBreached).toBe(false);
      expect(sla.status).toBe('warning'); // 30 mins left on 1h SLA
    });

    it('flags breached response SLA when overdue with no staff reply', () => {
      const createdAt = new Date(Date.now() - 75 * 60 * 1000); // 75 mins ago (> 1 hour)
      const sla = service.calculateSla(
        { createdAt, status: 'open', messages: [] },
        'enterprise',
      );

      expect(sla.isResponseBreached).toBe(true);
      expect(sla.status).toBe('breached');
      expect(sla.label).toContain('SLA Breached');
    });

    it('marks response SLA satisfied when public staff reply exists', () => {
      const createdAt = new Date(Date.now() - 75 * 60 * 1000);
      const sla = service.calculateSla(
        {
          createdAt,
          status: 'in_progress',
          messages: [{ authorUserId: 'staff-1', isInternal: false }],
        },
        'enterprise',
      );

      expect(sla.isResponseBreached).toBe(false);
      expect(sla.isResolutionBreached).toBe(false); // 4h resolution has ~2.75h left
      expect(sla.status).toBe('healthy');
    });

    it('marks status as met when ticket is resolved', () => {
      const createdAt = new Date(Date.now() - 60 * 60 * 1000);
      const resolvedAt = new Date(Date.now() - 10 * 60 * 1000);
      const sla = service.calculateSla(
        {
          createdAt,
          resolvedAt,
          status: 'resolved',
          messages: [{ authorUserId: 'staff-1', isInternal: false }],
        },
        'business',
      );

      expect(sla.status).toBe('met');
      expect(sla.label).toBe('Resolved within SLA');
    });
  });

  describe('Role-Gating & Access Enforcement', () => {
    it('allows Support Agent access', () => {
      expect(() => service.assertStaffAccess(agentActor)).not.toThrow();
    });

    it('allows Platform Owner access', () => {
      expect(() => service.assertStaffAccess(ownerActor)).not.toThrow();
    });

    it('rejects unauthorized roles with ForbiddenException', () => {
      expect(() => service.assertStaffAccess(unauthorizedActor)).toThrow(ForbiddenException);
    });
  });

  describe('Ticket Queue Across All Tenants', () => {
    it('retrieves tickets with tenant details and status counts', async () => {
      const mockTicketRows = [
        {
          id: 'tick-uuid-1',
          ticketNumber: 'SUP-4821',
          subject: 'Payroll submission blocked for November cycle',
          description: 'Payroll calculation error',
          status: 'open',
          priority: 'urgent',
          tenantId: 'tenant-globex-uuid',
          requesterUserId: 'user-1',
          assignedToUserId: null,
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
          updatedAt: new Date(),
          resolvedAt: null,
          tenant: {
            id: 'tenant-globex-uuid',
            name: 'Globex Industries',
            subdomain: 'globex',
            planId: 'enterprise',
          },
          messages: [{ authorUserId: 'user-1', isInternal: false }],
        },
      ];

      mockPrisma.unscoped.supportTicket.findMany.mockResolvedValue(mockTicketRows);
      mockPrisma.unscoped.supportTicket.count.mockResolvedValue(1);

      const res = await service.getQueue({ status: 'all' }, agentActor);

      expect(res.items.length).toBe(1);
      expect(res.items[0].ticketNumber).toBe('SUP-4821');
      expect(res.items[0].tenantName).toBe('Globex Industries');
      expect(res.items[0].sla.planName).toBe('Enterprise');
      expect(res.counts.all).toBe(5);
    });
  });

  describe('Ticket Status Flow & Updates', () => {
    it('updates status and sets resolvedAt timestamp when resolving', async () => {
      const mockTicket = {
        id: 'tick-uuid-1',
        ticketNumber: 'SUP-4821',
        status: 'in_progress',
        priority: 'high',
        assignedToUserId: 'staff-agent-uuid-1',
      };
      mockPrisma.unscoped.supportTicket.findUnique.mockResolvedValue({
        ...mockTicket,
        createdAt: new Date(),
        updatedAt: new Date(),
        tenant: { id: 't1', name: 'Acme', subdomain: 'acme', planId: 'business' },
        messages: [],
      });

      await service.updateTicket('tick-uuid-1', { status: 'resolved' }, agentActor);

      expect(mockPrisma.unscoped.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tick-uuid-1' },
          data: expect.objectContaining({
            status: 'resolved',
            resolvedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('Internal Notes vs Customer-Visible Replies', () => {
    it('creates an internal note without modifying ticket status', async () => {
      mockPrisma.unscoped.supportTicket.findUnique.mockResolvedValue({
        id: 'tick-uuid-1',
        ticketNumber: 'SUP-4821',
        tenantId: 'tenant-globex-uuid',
        status: 'open',
        assignedToUserId: null,
      });

      mockPrisma.unscoped.supportTicketMessage.create.mockResolvedValue({
        id: 'msg-uuid-1',
        ticketId: 'tick-uuid-1',
        authorUserId: agentActor.id,
        body: 'Internal note: verifying tax table configuration',
        isInternal: true,
        createdAt: new Date(),
      });

      const message = await service.createMessage(
        'tick-uuid-1',
        {
          body: 'Internal note: verifying tax table configuration',
          isInternal: true,
        },
        agentActor,
      );

      expect(message.isInternal).toBe(true);
      // Verify ticket status was NOT changed
      expect(mockPrisma.unscoped.supportTicket.update).not.toHaveBeenCalled();
    });

    it('creates a customer reply on an open ticket and transitions to in_progress with assignee', async () => {
      mockPrisma.unscoped.supportTicket.findUnique.mockResolvedValue({
        id: 'tick-uuid-1',
        ticketNumber: 'SUP-4821',
        tenantId: 'tenant-globex-uuid',
        status: 'open',
        assignedToUserId: null,
      });

      mockPrisma.unscoped.supportTicketMessage.create.mockResolvedValue({
        id: 'msg-uuid-2',
        ticketId: 'tick-uuid-1',
        authorUserId: agentActor.id,
        body: 'Hello, we are actively looking into your issue.',
        isInternal: false,
        createdAt: new Date(),
      });

      const message = await service.createMessage(
        'tick-uuid-1',
        {
          body: 'Hello, we are actively looking into your issue.',
          isInternal: false,
        },
        agentActor,
      );

      expect(message.isInternal).toBe(false);
      // Status moves to in_progress and ticket gets assigned to replying agent
      expect(mockPrisma.unscoped.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tick-uuid-1' },
          data: expect.objectContaining({
            status: 'in_progress',
            assignedToUserId: agentActor.id,
          }),
        }),
      );
    });
  });
});
