import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlatformTemplateCategory, RuleVersionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import {
  PlatformDefaultTemplatesService,
  GLOBAL_DEFAULT_ROLES,
  GLOBAL_DEFAULT_DOC_TYPES,
  GLOBAL_DEFAULT_LEAVE_POLICIES,
  GLOBAL_DEFAULT_NOTIFICATION_TEMPLATES,
  GLOBAL_DEFAULT_ONBOARDING_CHECKLIST,
} from './platform-default-templates.service';

describe('PlatformDefaultTemplatesService', () => {
  let service: PlatformDefaultTemplatesService;
  let prisma: PrismaService;
  let auditService: PlatformAuditService;

  const mockTemplates: any[] = [];

  const mockPrisma: any = {
    unscoped: {
      platformDefaultTemplate: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      country: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => {
        return cb(mockPrisma.unscoped);
      }),
    },
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformDefaultTemplatesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlatformAuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<PlatformDefaultTemplatesService>(PlatformDefaultTemplatesService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<PlatformAuditService>(PlatformAuditService);
  });

  describe('seedBaselineTemplatesIfEmpty', () => {
    it('should seed global and AU defaults if database has 0 templates', async () => {
      (mockPrisma.unscoped.platformDefaultTemplate.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.unscoped.country.findFirst as jest.Mock).mockResolvedValue({
        id: 'country-au-1',
        isoCode: 'AUS',
      });
      (mockPrisma.unscoped.platformDefaultTemplate.create as jest.Mock).mockResolvedValue({ id: 'tmpl-1' });
      (mockPrisma.unscoped.platformDefaultTemplate.createMany as jest.Mock).mockResolvedValue({ count: 3 });

      await service.seedBaselineTemplatesIfEmpty();

      expect(mockPrisma.unscoped.platformDefaultTemplate.count).toHaveBeenCalled();
      // 5 global templates created
      expect(mockPrisma.unscoped.platformDefaultTemplate.create).toHaveBeenCalledTimes(5);
      // AU specific templates created
      expect(mockPrisma.unscoped.platformDefaultTemplate.createMany).toHaveBeenCalled();
    });

    it('should not re-seed if templates already exist in database', async () => {
      (mockPrisma.unscoped.platformDefaultTemplate.count as jest.Mock).mockResolvedValue(8);

      await service.seedBaselineTemplatesIfEmpty();

      expect(mockPrisma.unscoped.platformDefaultTemplate.create).not.toHaveBeenCalled();
      expect(mockPrisma.unscoped.platformDefaultTemplate.createMany).not.toHaveBeenCalled();
    });
  });

  describe('getEffectiveTemplatesForCountry (Resolver Chain)', () => {
    it('should resolve country-specific published templates when available', async () => {
      const countryId = '10000000-0000-4000-8000-000000000002';
      (mockPrisma.unscoped.country.findUnique as jest.Mock).mockResolvedValue({
        id: countryId,
        name: 'Australia',
        isoCode: 'AUS',
      });

      // Mock finding an AU template for leave_policies
      (mockPrisma.unscoped.platformDefaultTemplate.findFirst as jest.Mock).mockImplementation(
        ({ where }: any) => {
          if (where.countryId === countryId && where.category === PlatformTemplateCategory.leave_policies) {
            return Promise.resolve({
              id: 'au-leave-tmpl-v1',
              countryId,
              category: PlatformTemplateCategory.leave_policies,
              version: 1,
              name: 'Australia Fair Work (NES) Leave Policies',
              status: RuleVersionStatus.published,
              payload: [{ name: 'Annual Leave', entitlementDays: 20 }],
              effectiveFrom: new Date('2026-01-01'),
              effectiveTo: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          if (where.countryId === null && where.category === PlatformTemplateCategory.document_types) {
            return Promise.resolve({
              id: 'global-doc-tmpl-v1',
              countryId: null,
              category: PlatformTemplateCategory.document_types,
              version: 1,
              name: 'Global Standard Document Types',
              status: RuleVersionStatus.published,
              payload: [{ name: 'National ID' }],
              effectiveFrom: new Date('2026-01-01'),
              effectiveTo: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          return Promise.resolve(null);
        },
      );

      const result = await service.getEffectiveTemplatesForCountry(countryId);

      expect(result.countryCode).toBe('AUS');
      expect(result.sources.leave_policies).toBe('country');
      expect(result.templates.leave_policies?.id).toBe('au-leave-tmpl-v1');

      expect(result.sources.document_types).toBe('global');
      expect(result.templates.document_types?.id).toBe('global-doc-tmpl-v1');

      expect(result.sources.default_roles).toBe('system_fallback');
      expect(result.templates.default_roles?.payload).toEqual(GLOBAL_DEFAULT_ROLES);
    });
  });

  describe('createTemplate', () => {
    it('should increment version when a template already exists for that country and category', async () => {
      (mockPrisma.unscoped.platformDefaultTemplate.findFirst as jest.Mock).mockResolvedValue({
        version: 2,
      });

      (mockPrisma.unscoped.platformDefaultTemplate.create as jest.Mock).mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 'new-v3',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      const res = await service.createTemplate(
        {
          countryId: null,
          category: PlatformTemplateCategory.leave_policies,
          name: 'Updated Leave Policies v3',
          payload: [],
          changeSummary: 'Added parental leave',
        },
        'admin-user-1',
      );

      expect(res.version).toBe(3);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform_template.created',
          userId: 'admin-user-1',
        }),
      );
    });
  });

  describe('updateTemplate', () => {
    it('should disallow mutating already published templates directly (immutability)', async () => {
      (mockPrisma.unscoped.platformDefaultTemplate.findUnique as jest.Mock).mockResolvedValue({
        id: 'published-1',
        status: RuleVersionStatus.published,
        version: 1,
      });

      await expect(
        service.updateTemplate('published-1', { name: 'Trying to change published' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow updating draft templates', async () => {
      (mockPrisma.unscoped.platformDefaultTemplate.findUnique as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        status: RuleVersionStatus.draft,
        version: 2,
        name: 'Old Draft',
      });
      (mockPrisma.unscoped.platformDefaultTemplate.update as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        status: RuleVersionStatus.draft,
        version: 2,
        name: 'New Draft Name',
        category: PlatformTemplateCategory.document_types,
        effectiveFrom: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.updateTemplate('draft-1', { name: 'New Draft Name' });
      expect(res.name).toBe('New Draft Name');
    });
  });

  describe('publishTemplate', () => {
    it('should publish draft and close previous published version', async () => {
      (mockPrisma.unscoped.platformDefaultTemplate.findUnique as jest.Mock).mockResolvedValue({
        id: 'draft-v2',
        status: RuleVersionStatus.draft,
        version: 2,
        category: PlatformTemplateCategory.leave_policies,
        countryId: null,
      });

      (mockPrisma.unscoped.platformDefaultTemplate.update as jest.Mock).mockResolvedValue({
        id: 'draft-v2',
        status: RuleVersionStatus.published,
        version: 2,
        category: PlatformTemplateCategory.leave_policies,
        countryId: null,
        effectiveFrom: new Date('2026-12-01'),
        effectiveTo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.publishTemplate('draft-v2', {
        effectiveFrom: '2026-12-01',
        changeSummary: 'Publishing v2 policies',
      });

      expect(mockPrisma.unscoped.platformDefaultTemplate.updateMany).toHaveBeenCalledWith({
        where: {
          countryId: null,
          category: PlatformTemplateCategory.leave_policies,
          status: RuleVersionStatus.published,
          effectiveTo: null,
        },
        data: {
          effectiveTo: new Date('2026-12-01'),
        },
      });

      expect(res.status).toBe('published');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform_template.published',
        }),
      );
    });
  });

  describe('cloneAsDraft', () => {
    it('should clone existing published template into next version draft', async () => {
      (mockPrisma.unscoped.platformDefaultTemplate.findUnique as jest.Mock).mockResolvedValue({
        id: 'pub-v1',
        version: 1,
        name: 'Global Roles',
        category: PlatformTemplateCategory.default_roles,
        countryId: null,
        payload: GLOBAL_DEFAULT_ROLES,
      });

      (mockPrisma.unscoped.platformDefaultTemplate.findFirst as jest.Mock).mockResolvedValue({
        version: 1,
      });

      (mockPrisma.unscoped.platformDefaultTemplate.create as jest.Mock).mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 'draft-v2',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      const cloned = await service.cloneAsDraft('pub-v1', 'admin-user');

      expect(cloned.version).toBe(2);
      expect(cloned.status).toBe('draft');
      expect(cloned.payload).toEqual(GLOBAL_DEFAULT_ROLES);
    });
  });
});
