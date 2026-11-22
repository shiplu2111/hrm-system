import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ComplianceEventsService } from './compliance-events.service';
import type { PrismaService } from '../../database/prisma.service';

describe('ComplianceEventsService', () => {
  let service: ComplianceEventsService;
  let prisma: any;

  const mockCountryId = '10000000-0000-4000-8000-000000000002';
  const mockStateId = '20000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    prisma = {
      unscoped: {
        country: {
          findUnique: jest.fn(),
        },
        stateProvince: {
          findFirst: jest.fn(),
        },
        complianceEvent: {
          count: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
      },
    };

    service = new ComplianceEventsService(prisma as unknown as PrismaService);
  });

  describe('listComplianceEvents', () => {
    it('should throw NotFoundException if country does not exist', async () => {
      prisma.unscoped.country.findUnique.mockResolvedValue(null);

      await expect(
        service.listComplianceEvents('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should auto-seed default statutory events when count is 0', async () => {
      prisma.unscoped.country.findUnique.mockResolvedValue({
        id: mockCountryId,
        name: 'Australia',
        isoCode: 'AU',
      });
      prisma.unscoped.complianceEvent.count.mockResolvedValue(0);
      prisma.unscoped.complianceEvent.create.mockResolvedValue({});
      prisma.unscoped.complianceEvent.findMany.mockResolvedValue([
        {
          id: 'event-1',
          countryId: mockCountryId,
          title: 'Monthly PAYG Withholding Return (IAS)',
          description: 'Monthly tax withholding',
          category: 'tax_filing',
          recurrence: 'monthly',
          dueDateRule: { dayOfMonth: 21 },
          applicablePlans: [],
          noticeDaysBefore: 7,
          status: 'active',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          country: { id: mockCountryId, name: 'Australia', isoCode: 'AU' },
        },
      ]);

      const events = await service.listComplianceEvents(mockCountryId, null, '2026-11-15');

      expect(prisma.unscoped.complianceEvent.create).toHaveBeenCalled();
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Monthly PAYG Withholding Return (IAS)');
      expect(events[0].nextDueDate).toBe('2026-11-21');
      expect(events[0].daysUntilDue).toBe(6);
      expect(events[0].isNoticeWindowActive).toBe(true);
    });
  });

  describe('createComplianceEvent', () => {
    it('should throw BadRequestException if fixed_date recurrence lacks specificDate', async () => {
      prisma.unscoped.country.findUnique.mockResolvedValue({ id: mockCountryId });

      await expect(
        service.createComplianceEvent({
          countryId: mockCountryId,
          title: 'One-off Labor Inspection Audit',
          recurrence: 'fixed_date',
          dueDateRule: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create event successfully and return view', async () => {
      prisma.unscoped.country.findUnique.mockResolvedValue({ id: mockCountryId });
      prisma.unscoped.complianceEvent.create.mockResolvedValue({
        id: 'new-event-1',
        countryId: mockCountryId,
        title: 'Quarterly Superannuation Remittance',
        category: 'social_security_remittance',
        recurrence: 'quarterly',
        dueDateRule: { dayOfMonth: 28, quarterMonthOffsets: [1, 4, 7, 10] },
        applicablePlans: [],
        noticeDaysBefore: 14,
        status: 'active',
        createdAt: new Date('2026-11-01'),
        updatedAt: new Date('2026-11-01'),
        country: { id: mockCountryId, name: 'Australia', isoCode: 'AU' },
      });

      const result = await service.createComplianceEvent({
        countryId: mockCountryId,
        title: 'Quarterly Superannuation Remittance',
        category: 'social_security_remittance',
        recurrence: 'quarterly',
        dueDateRule: { dayOfMonth: 28, quarterMonthOffsets: [1, 4, 7, 10] },
        noticeDaysBefore: 14,
      });

      expect(result.id).toBe('new-event-1');
      expect(result.recurrence).toBe('quarterly');
    });
  });

  describe('deleteComplianceEvent', () => {
    it('should delete event if found', async () => {
      prisma.unscoped.complianceEvent.findUnique.mockResolvedValue({ id: 'evt-1' });
      prisma.unscoped.complianceEvent.delete.mockResolvedValue({});

      const res = await service.deleteComplianceEvent('evt-1');
      expect(res.success).toBe(true);
      expect(prisma.unscoped.complianceEvent.delete).toHaveBeenCalledWith({ where: { id: 'evt-1' } });
    });

    it('should throw NotFoundException if event does not exist', async () => {
      prisma.unscoped.complianceEvent.findUnique.mockResolvedValue(null);

      await expect(service.deleteComplianceEvent('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
