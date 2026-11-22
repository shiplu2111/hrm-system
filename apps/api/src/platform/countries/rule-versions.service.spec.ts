import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CountryRuleType, RuleVersionStatus } from '@prisma/client';
import { getDefaultWorkingHoursOtForCountry, getDefaultEmploymentTerminationForCountry } from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { RuleVersionsService } from './rule-versions.service';

describe('RuleVersionsService', () => {
  let service: RuleVersionsService;
  let prisma: {
    unscoped: {
      country: {
        findUnique: jest.Mock;
      };
      stateProvince: {
        findFirst: jest.Mock;
      };
      countryRule: {
        findMany: jest.Mock;
        findFirst: jest.Mock;
        findUnique: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
      };
      taxBracket: {
        findFirst: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
        deleteMany: jest.Mock;
      };
    };
  };
  let auditService: {
    log: jest.Mock;
  };

  const mockCountryId = 'country-au';
  const mockUserId = 'user-admin-123';

  beforeEach(async () => {
    prisma = {
      unscoped: {
        country: {
          findUnique: jest.fn().mockResolvedValue({ id: mockCountryId, name: 'Australia', isoCode: 'AU' }),
        },
        stateProvince: {
          findFirst: jest.fn(),
        },
        countryRule: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        taxBracket: {
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          deleteMany: jest.fn(),
        },
      },
    };

    auditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleVersionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PlatformAuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<RuleVersionsService>(RuleVersionsService);
  });

  describe('createVersion', () => {
    it('should create version 1 when no previous version exists and audit log write', async () => {
      prisma.unscoped.countryRule.findFirst.mockResolvedValue(null);
      prisma.unscoped.countryRule.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'rule-ver-1',
          ...data,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          stateProvince: null,
        }),
      );

      const result = await service.createVersion(
        mockCountryId,
        {
          ruleType: 'leave',
          effectiveFrom: '2024-01-01',
          sourceReference: 'National Employment Standards Act 2024',
          changeNote: 'Initial statutory leave baseline',
          payload: { annual_leave_days: 20 },
        },
        mockUserId,
      );

      expect(result.version).toBe(1);
      expect(result.status).toBe('draft');
      expect(result.sourceReference).toBe('National Employment Standards Act 2024');
      expect(prisma.unscoped.countryRule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            countryId: mockCountryId,
            ruleType: 'leave',
            version: 1,
            status: 'draft',
          }),
        }),
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          action: 'country_rule_version.create',
          recordId: 'rule-ver-1',
          oldValue: null,
        }),
      );
    });

    it('should increment version number when previous versions exist', async () => {
      prisma.unscoped.countryRule.findFirst.mockResolvedValue({
        id: 'rule-ver-2',
        version: 2,
      });
      prisma.unscoped.countryRule.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'rule-ver-3',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          stateProvince: null,
        }),
      );

      const result = await service.createVersion(
        mockCountryId,
        {
          ruleType: 'tax',
          effectiveFrom: '2025-07-01',
          sourceReference: 'Taxation Laws Amendment 2025',
          changeNote: 'Updated stage 3 tax thresholds',
          payload: {
            taxYear: 2025,
            brackets: [{ from: 0, to: null, rate: 10, fixedAmount: 0 }],
          },
        },
        mockUserId,
      );

      expect(result.version).toBe(3);
    });

    it('should reject when effectiveFrom is after effectiveTo', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'leave',
            effectiveFrom: '2025-12-31',
            effectiveTo: '2025-01-01',
            sourceReference: 'Doc Ref',
            changeNote: 'Note',
            payload: {},
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when sourceReference is empty', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'leave',
            effectiveFrom: '2025-01-01',
            sourceReference: '   ',
            changeNote: 'Note',
            payload: {},
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when changeNote is empty', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'leave',
            effectiveFrom: '2025-01-01',
            sourceReference: 'Ref 123',
            changeNote: '',
            payload: {},
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('overlap validation (assertNoPublishedOverlap)', () => {
    it('should reject creating published version when date range overlaps existing published version', async () => {
      prisma.unscoped.countryRule.findFirst.mockResolvedValue(null);
      // Existing published version: 2024-01-01 to 2024-12-31
      prisma.unscoped.countryRule.findMany.mockResolvedValue([
        {
          id: 'rule-existing',
          version: 1,
          status: 'published',
          effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
          effectiveTo: new Date('2024-12-31T00:00:00.000Z'),
        },
      ]);

      // Attempt to create published version overlapping: 2024-06-01 to 2025-06-01
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'ot',
            effectiveFrom: '2024-06-01',
            effectiveTo: '2025-06-01',
            status: 'published',
            sourceReference: 'Fair Work Commission OT Ruling 2024',
            changeNote: 'Overlap test',
            payload: getDefaultWorkingHoursOtForCountry('AUS') as unknown as Record<string, unknown>,
          },
          mockUserId,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow non-overlapping published versions', async () => {
      prisma.unscoped.countryRule.findFirst.mockResolvedValue(null);
      // Existing published version: 2024-01-01 to 2024-12-31
      prisma.unscoped.countryRule.findMany.mockResolvedValue([
        {
          id: 'rule-existing',
          version: 1,
          status: 'published',
          effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
          effectiveTo: new Date('2024-12-31T00:00:00.000Z'),
        },
      ]);

      prisma.unscoped.countryRule.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'rule-ver-2',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          stateProvince: null,
        }),
      );

      // New version starting exactly on 2025-01-01 (no overlap)
      const result = await service.createVersion(
        mockCountryId,
        {
          ruleType: 'ot',
          effectiveFrom: '2025-01-01',
          effectiveTo: '2025-12-31',
          status: 'published',
          sourceReference: 'Fair Work Act 2025 Overtime Schedule',
          changeNote: 'Next year overtime rules',
          payload: getDefaultWorkingHoursOtForCountry('AUS') as unknown as Record<string, unknown>,
        },
        mockUserId,
      );

      expect(result.status).toBe('published');
    });

    it('should detect open-ended (null effectiveTo) collisions', async () => {
      // Existing published version: 2024-01-01 onwards (effectiveTo = null)
      prisma.unscoped.countryRule.findMany.mockResolvedValue([
        {
          id: 'rule-open-ended',
          version: 1,
          status: 'published',
          effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
          effectiveTo: null,
        },
      ]);

      // Trying to publish new version starting 2025-01-01 without superseding existing
      await expect(
        service.assertNoPublishedOverlap(
          mockCountryId,
          null,
          'leave',
          new Date('2025-01-01T00:00:00.000Z'),
          null,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateVersion & immutability enforcement', () => {
    it('should reject altering payload of a published version', async () => {
      prisma.unscoped.countryRule.findFirst.mockResolvedValue({
        id: 'rule-pub-1',
        countryId: mockCountryId,
        version: 1,
        status: 'published',
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: null,
        sourceReference: 'Gazette 2024',
        changeNote: 'Initial publication',
        payload: { rate: 0.1 },
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        stateProvince: null,
      });

      await expect(
        service.updateVersion(
          mockCountryId,
          'rule-pub-1',
          {
            payload: { rate: 0.15 },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject altering effectiveFrom or sourceReference of a published version', async () => {
      prisma.unscoped.countryRule.findFirst.mockResolvedValue({
        id: 'rule-pub-1',
        countryId: mockCountryId,
        version: 1,
        status: 'published',
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: null,
        sourceReference: 'Gazette 2024',
        changeNote: 'Initial',
        payload: { rate: 0.1 },
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        stateProvince: null,
      });

      await expect(
        service.updateVersion(
          mockCountryId,
          'rule-pub-1',
          {
            effectiveFrom: '2024-02-01',
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow setting effectiveTo and transitioning published version to superseded', async () => {
      const existing = {
        id: 'rule-pub-1',
        countryId: mockCountryId,
        version: 1,
        status: 'published',
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: null,
        sourceReference: 'Gazette 2024',
        changeNote: 'Initial',
        payload: { rate: 0.1 },
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        stateProvince: null,
      };
      prisma.unscoped.countryRule.findFirst.mockResolvedValue(existing);
      prisma.unscoped.countryRule.update.mockResolvedValue({
        ...existing,
        status: 'superseded',
        effectiveTo: new Date('2024-12-31'),
      });

      const updated = await service.updateVersion(
        mockCountryId,
        'rule-pub-1',
        {
          status: 'superseded',
          effectiveTo: '2024-12-31',
        },
        mockUserId,
      );

      expect(updated.status).toBe('superseded');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'country_rule_version.supersede',
          oldValue: expect.objectContaining({ status: 'published' }),
          newValue: expect.objectContaining({ status: 'superseded' }),
        }),
      );
    });

    it('should allow modifying draft version payload and fields', async () => {
      const existing = {
        id: 'rule-draft-1',
        countryId: mockCountryId,
        version: 2,
        status: 'draft',
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: null,
        sourceReference: 'Draft Doc',
        changeNote: 'Working draft',
        payload: { days: 20 },
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        stateProvince: null,
      };
      prisma.unscoped.countryRule.findFirst.mockResolvedValue(existing);
      prisma.unscoped.countryRule.update.mockImplementation(({ data }) =>
        Promise.resolve({
          ...existing,
          ...data,
        }),
      );

      const result = await service.updateVersion(
        mockCountryId,
        'rule-draft-1',
        {
          payload: { days: 25 },
          changeNote: 'Increased to 25 days as per agreement',
        },
        mockUserId,
      );

      expect(result.payload).toEqual({ days: 25 });
      expect(result.changeNote).toBe('Increased to 25 days as per agreement');
    });
  });

  describe('publishVersion', () => {
    it('should successfully publish draft after verifying non-overlapping intervals', async () => {
      const draft = {
        id: 'rule-draft-2',
        countryId: mockCountryId,
        ruleType: 'leave',
        stateProvinceId: null,
        version: 2,
        status: 'draft',
        effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        effectiveTo: null,
        sourceReference: 'NES Update 2025',
        changeNote: 'Publishing 2025 version',
        payload: { annual_leave_days: 25 },
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        stateProvince: null,
      };
      prisma.unscoped.countryRule.findFirst.mockResolvedValue(draft);
      // No published versions found that overlap
      prisma.unscoped.countryRule.findMany.mockResolvedValue([]);
      prisma.unscoped.countryRule.update.mockResolvedValue({
        ...draft,
        status: 'published',
      });

      const published = await service.publishVersion(mockCountryId, 'rule-draft-2', mockUserId);
      expect(published.status).toBe('published');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'country_rule_version.publish',
          recordId: 'rule-draft-2',
        }),
      );
    });

    it('should reject publish when overlapping with an active published rule', async () => {
      const draft = {
        id: 'rule-draft-2',
        countryId: mockCountryId,
        ruleType: 'leave',
        stateProvinceId: null,
        version: 2,
        status: 'draft',
        effectiveFrom: new Date('2024-06-01T00:00:00.000Z'),
        effectiveTo: new Date('2024-12-31T00:00:00.000Z'),
        sourceReference: 'NES Mid-Year Update',
        changeNote: 'Attempt publish',
        payload: {},
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        stateProvince: null,
      };
      prisma.unscoped.countryRule.findFirst.mockResolvedValue(draft);
      prisma.unscoped.countryRule.findMany.mockResolvedValue([
        {
          id: 'rule-v1',
          version: 1,
          status: 'published',
          effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
          effectiveTo: new Date('2024-12-31T00:00:00.000Z'),
        },
      ]);

      await expect(
        service.publishVersion(mockCountryId, 'rule-draft-2', mockUserId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteVersion', () => {
    it('should reject deleting a published version', async () => {
      prisma.unscoped.countryRule.findFirst.mockResolvedValue({
        id: 'rule-pub',
        countryId: mockCountryId,
        status: 'published',
        stateProvince: null,
      });

      await expect(
        service.deleteVersion(mockCountryId, 'rule-pub', mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete a draft version and write to audit log', async () => {
      const draft = {
        id: 'rule-draft',
        countryId: mockCountryId,
        version: 3,
        status: 'draft',
        ruleType: 'leave',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        sourceReference: 'Test',
        changeNote: 'Delete me',
        payload: {},
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        stateProvince: null,
      };
      prisma.unscoped.countryRule.findFirst.mockResolvedValue(draft);
      prisma.unscoped.countryRule.delete.mockResolvedValue(draft);

      await service.deleteVersion(mockCountryId, 'rule-draft', mockUserId);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'country_rule_version.delete',
          recordId: 'rule-draft',
          newValue: null,
        }),
      );
    });
  });

  describe('compareVersions (side-by-side diff)', () => {
    it('should calculate metadata diff and payload field additions, removals, and modifications', async () => {
      const v1 = {
        id: 'v1',
        countryId: mockCountryId,
        ruleType: 'leave',
        stateProvinceId: null,
        version: 1,
        status: 'superseded',
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2024-12-31'),
        sourceReference: 'Fair Work Act 2024',
        changeNote: 'Baseline',
        payload: {
          annual_leave_days: 20,
          sick_leave_days: 10,
          legacy_bonus_days: 2,
        },
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        stateProvince: null,
      };

      const v2 = {
        id: 'v2',
        countryId: mockCountryId,
        ruleType: 'leave',
        stateProvinceId: null,
        version: 2,
        status: 'published',
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: null,
        sourceReference: 'Fair Work Act 2025 Revision',
        changeNote: 'Increased annual leave and added parental leave',
        payload: {
          annual_leave_days: 25, // modified
          sick_leave_days: 10, // unchanged
          parental_leave_weeks: 18, // added
          // legacy_bonus_days removed
        },
        createdBy: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date(),
        stateProvince: null,
      };

      prisma.unscoped.countryRule.findFirst.mockImplementation(({ where }) => {
        if (where.id === 'v1') return Promise.resolve(v1);
        if (where.id === 'v2') return Promise.resolve(v2);
        return Promise.resolve(null);
      });

      const diff = await service.compareVersions(mockCountryId, 'v1', 'v2');

      expect(diff.baseVersion.version).toBe(1);
      expect(diff.compareVersion.version).toBe(2);

      // Metadata changes
      const statusMeta = diff.metadataDiff.find((m) => m.field === 'status');
      expect(statusMeta?.hasChanged).toBe(true);
      expect(statusMeta?.baseValue).toBe('superseded');
      expect(statusMeta?.compareValue).toBe('published');

      const sourceMeta = diff.metadataDiff.find((m) => m.field === 'sourceReference');
      expect(sourceMeta?.hasChanged).toBe(true);

      // Field diff stats
      expect(diff.stats.added).toBe(1); // parental_leave_weeks
      expect(diff.stats.removed).toBe(1); // legacy_bonus_days
      expect(diff.stats.modified).toBe(1); // annual_leave_days
      expect(diff.stats.unchanged).toBe(1); // sick_leave_days

      const modifiedField = diff.payloadDiff.find((p) => p.path === 'annual_leave_days');
      expect(modifiedField).toBeDefined();
      expect(modifiedField?.type).toBe('modified');
      expect(modifiedField?.baseValue).toBe(20);
      expect(modifiedField?.compareValue).toBe(25);

      const addedField = diff.payloadDiff.find((p) => p.path === 'parental_leave_weeks');
      expect(addedField?.type).toBe('added');

      const removedField = diff.payloadDiff.find((p) => p.path === 'legacy_bonus_days');
      expect(removedField?.type).toBe('removed');
    });
  });

  describe('Tax Rules inline validation and synchronization', () => {
    it('should reject tax rule when brackets are overlapping', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'tax',
            effectiveFrom: '2025-07-01',
            sourceReference: 'ATO Schedule 2025',
            changeNote: 'Overlap test',
            payload: {
              taxYear: 2025,
              brackets: [
                { from: 0, to: 20000, rate: 0, fixedAmount: 0 },
                { from: 18000, to: 45000, rate: 16, fixedAmount: 0 }, // Overlaps 18000 < 20000
              ],
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject tax rule when there is a gap between brackets', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'tax',
            effectiveFrom: '2025-07-01',
            sourceReference: 'ATO Schedule 2025',
            changeNote: 'Gap test',
            payload: {
              taxYear: 2025,
              brackets: [
                { from: 0, to: 18200, rate: 0, fixedAmount: 0 },
                { from: 20000, to: 45000, rate: 16, fixedAmount: 0 }, // Gap 18200 -> 20000
              ],
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject tax rule when upper bound is not greater than lower bound', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'tax',
            effectiveFrom: '2025-07-01',
            sourceReference: 'ATO Schedule 2025',
            changeNote: 'Non-ascending test',
            payload: {
              taxYear: 2025,
              brackets: [
                { from: 0, to: 18200, rate: 0, fixedAmount: 0 },
                { from: 18200, to: 15000, rate: 16, fixedAmount: 0 }, // 15000 < 18200
              ],
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject tax rule when intermediate bracket is open-ended', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'tax',
            effectiveFrom: '2025-07-01',
            sourceReference: 'ATO Schedule 2025',
            changeNote: 'Premature open-ended test',
            payload: {
              taxYear: 2025,
              brackets: [
                { from: 0, to: null, rate: 0, fixedAmount: 0 }, // intermediate bracket has no upper bound
                { from: 18200, to: 45000, rate: 16, fixedAmount: 0 },
              ],
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid contiguous brackets where only the final bracket is open-ended and sync to tax_brackets', async () => {
      prisma.unscoped.countryRule.findFirst.mockResolvedValue(null);
      prisma.unscoped.countryRule.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'tax-ver-1',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          stateProvince: null,
        }),
      );
      prisma.unscoped.taxBracket.findFirst.mockResolvedValue(null);
      prisma.unscoped.taxBracket.create.mockResolvedValue({ id: 'tb-1' });

      const result = await service.createVersion(
        mockCountryId,
        {
          ruleType: 'tax',
          effectiveFrom: '2025-07-01',
          sourceReference: 'ATO Statutory Rates 2025-26',
          changeNote: 'Published 2025-26 Australian progressive rates',
          status: 'published',
          payload: {
            taxYear: 2025,
            currency: 'AUD',
            hasFilingStatuses: false,
            brackets: [
              { from: 0, to: 18200, rate: 0, fixedAmount: 0 },
              { from: 18200, to: 45000, rate: 16, fixedAmount: 0 },
              { from: 45000, to: 135000, rate: 30, fixedAmount: 4288 },
              { from: 135000, to: 190000, rate: 37, fixedAmount: 31288 },
              { from: 190000, to: null, rate: 45, fixedAmount: 51638 },
            ],
            rebates: [
              {
                id: 'rebate-1',
                name: 'Low Income Tax Offset',
                code: 'LITO',
                type: 'tapered',
                amount: 700,
                threshold: 37500,
                phaseOutRate: 0.015,
              },
            ],
            minimumTax: {
              enabled: false,
              amount: 0,
            },
          },
        },
        mockUserId,
      );

      expect(result.version).toBe(1);
      expect(result.status).toBe('published');
      expect(prisma.unscoped.taxBracket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            countryId: mockCountryId,
            taxYear: 2025,
            status: 'published',
          }),
        }),
      );
    });

    it('should validate filing status variants when hasFilingStatuses is true', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'tax',
            effectiveFrom: '2025-01-01',
            sourceReference: 'IRS Pub 15-T',
            changeNote: 'US Federal Filing Status with gap',
            payload: {
              taxYear: 2025,
              hasFilingStatuses: true,
              filingStatuses: [
                {
                  statusKey: 'married_joint',
                  label: 'Married Filing Jointly',
                  brackets: [
                    { from: 0, to: 23200, rate: 10, fixedAmount: 0 },
                    { from: 25000, to: null, rate: 12, fixedAmount: 2320 }, // Gap: 23200 -> 25000
                  ],
                  rebates: [],
                  minimumTax: { enabled: false, amount: 0 },
                },
              ],
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Social Security and Pension Rules inline validation', () => {
    it('should reject social security rule when schemeName is missing', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'social_security',
            effectiveFrom: '2025-01-01',
            sourceReference: 'Social Security Act',
            changeNote: 'Missing scheme name',
            payload: {
              schemeName: '',
              employerContributionRate: 6.2,
              employeeContributionRate: 6.2,
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject social security rule when employerContributionRate is out of range', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'social_security',
            effectiveFrom: '2025-01-01',
            sourceReference: 'Social Security Act',
            changeNote: 'Invalid rate > 100',
            payload: {
              schemeName: 'Statutory Pension',
              employerContributionRate: 105,
              employeeContributionRate: 5,
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject social security rule when wageCeiling is less than wageFloor', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'social_security',
            effectiveFrom: '2025-01-01',
            sourceReference: 'Social Security Act',
            changeNote: 'Ceiling < Floor',
            payload: {
              schemeName: 'National Social Insurance',
              employerContributionRate: 8.0,
              employeeContributionRate: 4.0,
              wageFloor: 5000,
              wageCeiling: 3000, // Invalid: ceiling < floor
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject social security rule when contributionFrequency is invalid', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'social_security',
            effectiveFrom: '2025-01-01',
            sourceReference: 'Social Security Act',
            changeNote: 'Invalid frequency',
            payload: {
              schemeName: 'National Social Insurance',
              employerContributionRate: 8.0,
              employeeContributionRate: 4.0,
              contributionFrequency: 'every_other_decade' as any,
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid social security and pension rule with rates, wage ceiling, floor, and fund details', async () => {
      prisma.unscoped.countryRule.findFirst.mockResolvedValue(null);
      prisma.unscoped.countryRule.findMany.mockResolvedValue([]);
      prisma.unscoped.countryRule.create.mockResolvedValue({
        id: 'rule-soc-1',
        countryId: mockCountryId,
        stateProvinceId: null,
        ruleType: 'social_security',
        version: 1,
        status: 'published',
        effectiveFrom: new Date('2025-07-01'),
        effectiveTo: null,
        sourceReference: 'Superannuation Guarantee (Administration) Act 1992',
        changeNote: 'AU Super Guarantee rate indexing to 11.5%',
        payload: {
          schemeName: 'Superannuation Guarantee',
          fundCode: 'SUPER_AU',
          administratorName: 'Australian Taxation Office (ATO)',
          contributionFrequency: 'monthly',
          contributionBase: 'gross',
          employerContributionRate: 11.5,
          employeeContributionRate: 0,
          wageFloor: 450,
          wageCeiling: 62270,
          voluntaryContributionAllowed: true,
          voluntaryContributionMaxRate: 15,
        },
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        stateProvince: null,
      });

      const result = await service.createVersion(
        mockCountryId,
        {
          ruleType: 'social_security',
          status: 'published',
          effectiveFrom: '2025-07-01',
          sourceReference: 'Superannuation Guarantee (Administration) Act 1992',
          changeNote: 'AU Super Guarantee rate indexing to 11.5%',
          payload: {
            schemeName: 'Superannuation Guarantee',
            fundCode: 'SUPER_AU',
            administratorName: 'Australian Taxation Office (ATO)',
            contributionFrequency: 'monthly',
            contributionBase: 'gross',
            employerContributionRate: 11.5,
            employeeContributionRate: 0,
            wageFloor: 450,
            wageCeiling: 62270,
            voluntaryContributionAllowed: true,
            voluntaryContributionMaxRate: 15,
          },
        },
        mockUserId,
      );

      expect(result.version).toBe(1);
      expect(result.status).toBe('published');
    });

    it('should validate statutory sub-funds array within pension or social security rules', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'pension',
            effectiveFrom: '2025-01-01',
            sourceReference: 'Pension Act',
            changeNote: 'Fund with invalid rate',
            payload: {
              schemeName: 'State Pension System',
              employerContributionRate: 10,
              employeeContributionRate: 5,
              funds: [
                {
                  id: 'f-1',
                  name: 'Retirement Fund',
                  code: 'RET',
                  category: 'pension',
                  employerRate: 120, // Invalid: > 100
                  employeeRate: 5,
                  contributionBase: 'gross',
                  preTax: true,
                },
              ],
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Statutory Leave Rules inline validation', () => {
    it('should reject leave rule when statutoryLeaves is missing or empty', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'leave',
            effectiveFrom: '2025-01-01',
            sourceReference: 'Employment Act',
            changeNote: 'Empty statutory leaves',
            payload: {
              statutoryLeaves: [],
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject leave rule when minimumEntitlementDays is negative', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'leave',
            effectiveFrom: '2025-01-01',
            sourceReference: 'Employment Act',
            changeNote: 'Negative leave days',
            payload: {
              statutoryLeaves: [
                {
                  id: 'leave-1',
                  category: 'annual',
                  leaveType: 'annual',
                  name: 'Annual Leave',
                  isPaid: true,
                  minimumEntitlementDays: -5, // Invalid negative
                  accrualMethod: 'monthly',
                  carryForwardAllowed: true,
                  maxCarryForwardDays: null,
                  carryForwardExpiryMonths: null,
                  encashmentAllowed: false,
                  maxEncashmentDays: null,
                  proRataApplicable: true,
                },
              ],
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject leave rule when accrualMethod is invalid', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'leave',
            effectiveFrom: '2025-01-01',
            sourceReference: 'Employment Act',
            changeNote: 'Invalid accrual method',
            payload: {
              statutoryLeaves: [
                {
                  id: 'leave-1',
                  category: 'annual',
                  leaveType: 'annual',
                  name: 'Annual Leave',
                  isPaid: true,
                  minimumEntitlementDays: 20,
                  accrualMethod: 'biweekly_random' as any, // Invalid
                  carryForwardAllowed: true,
                  maxCarryForwardDays: null,
                  carryForwardExpiryMonths: null,
                  encashmentAllowed: false,
                  maxEncashmentDays: null,
                  proRataApplicable: true,
                },
              ],
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid statutory leave rules with annual, sick, maternity, paternity, and compassionate', async () => {
      prisma.unscoped.countryRule.findFirst.mockResolvedValueOnce(null);
      prisma.unscoped.countryRule.create.mockResolvedValueOnce({
        id: 'leave-rule-1',
        countryId: mockCountryId,
        stateProvinceId: null,
        ruleType: 'leave',
        version: 1,
        status: 'published',
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: null,
        sourceReference: 'Fair Work Act 2009 (NES)',
        changeNote: 'Australian National Employment Standards statutory leave baseline',
        payload: {
          statutoryLeaves: [
            {
              id: 'aus-annual',
              category: 'annual',
              leaveType: 'annual',
              name: 'Annual Leave',
              isPaid: true,
              minimumEntitlementDays: 20,
              accrualMethod: 'monthly',
              carryForwardAllowed: true,
              maxCarryForwardDays: null,
              carryForwardExpiryMonths: null,
              encashmentAllowed: true,
              maxEncashmentDays: 10,
              proRataApplicable: true,
            },
            {
              id: 'aus-sick',
              category: 'sick',
              leaveType: 'sick',
              name: 'Sick & Carer Leave',
              isPaid: true,
              minimumEntitlementDays: 10,
              accrualMethod: 'monthly',
              carryForwardAllowed: true,
              maxCarryForwardDays: null,
              carryForwardExpiryMonths: null,
              encashmentAllowed: false,
              maxEncashmentDays: null,
              proRataApplicable: true,
            },
            {
              id: 'aus-maternity',
              category: 'maternity',
              leaveType: 'maternity',
              name: 'Maternity Leave',
              isPaid: true,
              minimumEntitlementDays: 84,
              accrualMethod: 'on_hire',
              carryForwardAllowed: false,
              maxCarryForwardDays: null,
              carryForwardExpiryMonths: null,
              encashmentAllowed: false,
              maxEncashmentDays: null,
              proRataApplicable: false,
            },
            {
              id: 'aus-paternity',
              category: 'paternity',
              leaveType: 'paternity',
              name: 'Paternity Leave',
              isPaid: true,
              minimumEntitlementDays: 10,
              accrualMethod: 'on_hire',
              carryForwardAllowed: false,
              maxCarryForwardDays: null,
              carryForwardExpiryMonths: null,
              encashmentAllowed: false,
              maxEncashmentDays: null,
              proRataApplicable: false,
            },
            {
              id: 'aus-compassionate',
              category: 'compassionate',
              leaveType: 'compassionate',
              name: 'Compassionate Leave',
              isPaid: true,
              minimumEntitlementDays: 2,
              accrualMethod: 'on_hire',
              carryForwardAllowed: false,
              maxCarryForwardDays: null,
              carryForwardExpiryMonths: null,
              encashmentAllowed: false,
              maxEncashmentDays: null,
              proRataApplicable: false,
            },
          ],
        },
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        stateProvince: null,
      });

      const result = await service.createVersion(
        mockCountryId,
        {
          ruleType: 'leave',
          status: 'published',
          effectiveFrom: '2025-01-01',
          sourceReference: 'Fair Work Act 2009 (NES)',
          changeNote: 'Australian National Employment Standards statutory leave baseline',
          payload: {
            statutoryLeaves: [
              {
                id: 'aus-annual',
                category: 'annual',
                leaveType: 'annual',
                name: 'Annual Leave',
                isPaid: true,
                minimumEntitlementDays: 20,
                accrualMethod: 'monthly',
                carryForwardAllowed: true,
                maxCarryForwardDays: null,
                carryForwardExpiryMonths: null,
                encashmentAllowed: true,
                maxEncashmentDays: 10,
                proRataApplicable: true,
              },
            ],
          },
        },
        mockUserId,
      );

      expect(result.version).toBe(1);
      expect(result.status).toBe('published');
    });
  });

  describe('Overtime and Working Hours inline validation (ATTENDANCE_LOGIC.md §4 & PAYROLL_LOGIC.md §9)', () => {
    it('should reject working hours/ot rule when standardDailyHours is invalid or negative', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'ot',
            effectiveFrom: '2025-01-01',
            sourceReference: 'NES',
            changeNote: 'Invalid standard hours',
            payload: {
              standardDailyHours: -5,
              standardWeeklyHours: 38,
              weekdayMultiplier: 1.5,
              weekendMultiplier: 2.0,
              holidayMultiplier: 2.5,
              nightMultiplier: 1.15,
              actionOnCapBreach: 'flag',
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject working hours/ot rule when maxDailyHours is less than standardDailyHours', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'ot',
            effectiveFrom: '2025-01-01',
            sourceReference: 'NES',
            changeNote: 'Max daily hours less than standard',
            payload: {
              standardDailyHours: 8,
              standardWeeklyHours: 40,
              maxDailyHours: 6, // invalid
              maxWeeklyHours: 48,
              weekdayMultiplier: 1.5,
              weekendMultiplier: 2.0,
              holidayMultiplier: 2.5,
              nightMultiplier: 1.15,
              actionOnCapBreach: 'flag',
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject working hours/ot rule when multipliers are out of range (< 1.0 or > 10.0)', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'ot',
            effectiveFrom: '2025-01-01',
            sourceReference: 'NES',
            changeNote: 'Invalid multiplier',
            payload: {
              standardDailyHours: 7.6,
              standardWeeklyHours: 38,
              weekdayMultiplier: 0.8, // invalid: less than 1.0
              weekendMultiplier: 2.0,
              holidayMultiplier: 2.5,
              nightMultiplier: 1.15,
              actionOnCapBreach: 'flag',
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject working hours/ot rule when actionOnCapBreach is invalid', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'ot',
            effectiveFrom: '2025-01-01',
            sourceReference: 'NES',
            changeNote: 'Invalid cap action',
            payload: {
              standardDailyHours: 7.6,
              standardWeeklyHours: 38,
              weekdayMultiplier: 1.5,
              weekendMultiplier: 2.0,
              holidayMultiplier: 2.5,
              nightMultiplier: 1.15,
              actionOnCapBreach: 'ignore' as any, // invalid
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid working hours and overtime rule and save version', async () => {
      prisma.unscoped.countryRule.findFirst.mockResolvedValueOnce(null);
      prisma.unscoped.countryRule.findMany.mockResolvedValueOnce([]);
      prisma.unscoped.countryRule.create.mockResolvedValueOnce({
        id: 'ot-version-1',
        countryId: mockCountryId,
        stateProvinceId: null,
        ruleType: 'ot',
        version: 1,
        status: 'published',
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: null,
        sourceReference: 'Fair Work Act 2009 (NES §62 & Modern Awards)',
        changeNote: 'Australian statutory standard hours and overtime multipliers',
        payload: {
          standardDailyHours: 7.6,
          standardWeeklyHours: 38,
          maxDailyHours: 10,
          maxWeeklyHours: 48,
          maxConsecutiveDays: 6,
          restBreakRequiredAfterHours: 5,
          minimumRestBreakMinutes: 30,
          dailyRestPeriodHours: 11,
          weekdayMultiplier: 1.5,
          enableWeekdayTiers: true,
          weekdayTier1HoursCap: 2,
          weekdayTier2Multiplier: 2.0,
          weekendMultiplier: 2.0,
          holidayMultiplier: 2.5,
          nightMultiplier: 1.15,
          nightShiftWindowStart: '18:00',
          nightShiftWindowEnd: '06:00',
          maxDailyOvertimeHours: 4,
          maxWeeklyOvertimeHours: 12,
          actionOnCapBreach: 'flag',
        },
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        stateProvince: null,
      });

      const result = await service.createVersion(
        mockCountryId,
        {
          ruleType: 'ot',
          status: 'published',
          effectiveFrom: '2025-01-01',
          sourceReference: 'Fair Work Act 2009 (NES §62 & Modern Awards)',
          changeNote: 'Australian statutory standard hours and overtime multipliers',
          payload: {
            standardDailyHours: 7.6,
            standardWeeklyHours: 38,
            maxDailyHours: 10,
            maxWeeklyHours: 48,
            maxConsecutiveDays: 6,
            restBreakRequiredAfterHours: 5,
            minimumRestBreakMinutes: 30,
            dailyRestPeriodHours: 11,
            weekdayMultiplier: 1.5,
            enableWeekdayTiers: true,
            weekdayTier1HoursCap: 2,
            weekdayTier2Multiplier: 2.0,
            weekendMultiplier: 2.0,
            holidayMultiplier: 2.5,
            nightMultiplier: 1.15,
            nightShiftWindowStart: '18:00',
            nightShiftWindowEnd: '06:00',
            maxDailyOvertimeHours: 4,
            maxWeeklyOvertimeHours: 12,
            actionOnCapBreach: 'flag',
          },
        },
        mockUserId,
      );

      expect(result.version).toBe(1);
      expect(result.status).toBe('published');
    });
  });

  describe('Employment and Termination Rules inline validation (Stage C.09 & Stage C.10)', () => {
    it('should reject employment rule when standardProbationMonths is invalid or negative', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'employment_rules',
            effectiveFrom: '2025-01-01',
            sourceReference: 'NES',
            changeNote: 'Invalid probation',
            payload: {
              standardProbationMonths: -2,
              maxProbationMonths: 6,
              standardNoticeWeeks: 4,
              contractRequirements: {
                minAgeOfEmployment: 15,
                minimumWageHourly: 24.1,
              },
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject employment rule when maxProbationMonths is less than standardProbationMonths', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'employment_rules',
            effectiveFrom: '2025-01-01',
            sourceReference: 'NES',
            changeNote: 'Invalid max probation',
            payload: {
              standardProbationMonths: 6,
              maxProbationMonths: 3,
              standardNoticeWeeks: 4,
              contractRequirements: {
                minAgeOfEmployment: 15,
                minimumWageHourly: 24.1,
              },
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject employment rule when minimumWageHourly is non-positive', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'employment_rules',
            effectiveFrom: '2025-01-01',
            sourceReference: 'NES',
            changeNote: 'Invalid minimum wage',
            payload: {
              standardProbationMonths: 6,
              maxProbationMonths: 6,
              standardNoticeWeeks: 4,
              contractRequirements: {
                minAgeOfEmployment: 15,
                minimumWageHourly: 0,
              },
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject employment rule when notice tier upper bound is less than lower bound', async () => {
      await expect(
        service.createVersion(
          mockCountryId,
          {
            ruleType: 'employment_rules',
            effectiveFrom: '2025-01-01',
            sourceReference: 'NES',
            changeNote: 'Invalid notice tier',
            payload: {
              standardProbationMonths: 6,
              maxProbationMonths: 6,
              standardNoticeWeeks: 4,
              noticeTiers: [
                { minTenureMonths: 24, maxTenureMonths: 12, noticeWeeks: 2 },
              ],
              contractRequirements: {
                minAgeOfEmployment: 15,
                minimumWageHourly: 24.1,
              },
            },
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid employment & termination rule with notice tiers, probation, final settlement, and structured severance', async () => {
      prisma.unscoped.countryRule.findFirst.mockResolvedValue(null);
      prisma.unscoped.countryRule.findMany.mockResolvedValue([]);

      const validPayload = getDefaultEmploymentTerminationForCountry('AUS');

      prisma.unscoped.countryRule.create.mockResolvedValue({
        id: 'rule-emp-1',
        countryId: mockCountryId,
        version: 1,
        ruleType: 'employment_rules',
        status: 'published',
        effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        effectiveTo: null,
        sourceReference: 'Fair Work Act 2009 (NES §117 & §119)',
        changeNote: 'Australian statutory employment and termination standards',
        payload: validPayload,
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        stateProvince: null,
      });

      const result = await service.createVersion(
        mockCountryId,
        {
          ruleType: 'employment_rules',
          status: 'published',
          effectiveFrom: '2025-01-01',
          sourceReference: 'Fair Work Act 2009 (NES §117 & §119)',
          changeNote: 'Australian statutory employment and termination standards',
          payload: validPayload as unknown as Record<string, unknown>,
        },
        mockUserId,
      );

      expect(result.version).toBe(1);
      expect(result.status).toBe('published');
    });
  });
});
