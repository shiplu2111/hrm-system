import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CountriesService } from './countries.service';

describe('CountriesService', () => {
  let service: CountriesService;
  let prisma: {
    unscoped: {
      country: {
        findMany: jest.Mock;
        findUnique: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
      };
      stateProvince: {
        findMany: jest.Mock;
        findFirst: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
      };
      taxBracket: {
        create: jest.Mock;
        update: jest.Mock;
        findFirst: jest.Mock;
        updateMany: jest.Mock;
      };
      countryRule: {
        create: jest.Mock;
        update: jest.Mock;
        findFirst: jest.Mock;
        updateMany: jest.Mock;
      };
    };
  };

  beforeEach(async () => {
    prisma = {
      unscoped: {
        country: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        stateProvince: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        taxBracket: {
          create: jest.fn(),
          update: jest.fn(),
          findFirst: jest.fn(),
          updateMany: jest.fn(),
        },
        countryRule: {
          create: jest.fn(),
          update: jest.fn(),
          findFirst: jest.fn(),
          updateMany: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CountriesService>(CountriesService);
  });

  describe('getCountryConfigStatus', () => {
    it('throws NotFoundException if country does not exist', async () => {
      prisma.unscoped.country.findUnique.mockResolvedValue(null);

      await expect(
        service.getCountryConfigStatus('e2e-country-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('reports missing categories when rules are incomplete', async () => {
      prisma.unscoped.country.findUnique.mockResolvedValue({
        id: 'country-aus',
        name: 'Australia',
        isoCode: 'AUS',
        status: 'draft',
        taxBrackets: [
          { status: 'published', effectiveFrom: new Date('2024-07-01') },
        ],
        countryRules: [
          { ruleType: 'leave', status: 'published', effectiveFrom: new Date('2024-01-01') },
          { ruleType: 'ot', status: 'published', effectiveFrom: new Date('2024-01-01') },
          { ruleType: 'public_holiday', status: 'published', effectiveFrom: new Date('2024-01-01') },
          // missing employment_rules!
        ],
      });

      const result = await service.getCountryConfigStatus('country-aus');
      expect(result.isReadyForActivation).toBe(false);
      expect(result.missingCategories).toEqual(['employment_rules']);

      const employmentCat = result.categories.find((c) => c.category === 'employment_rules');
      expect(employmentCat?.complete).toBe(false);

      const taxCat = result.categories.find((c) => c.category === 'tax');
      expect(taxCat?.complete).toBe(true);
      expect(taxCat?.ruleCount).toBe(1);
    });

    it('reports isReadyForActivation=true when all 5 required categories have published rules', async () => {
      prisma.unscoped.country.findUnique.mockResolvedValue({
        id: 'country-aus',
        name: 'Australia',
        isoCode: 'AUS',
        status: 'draft',
        taxBrackets: [
          { status: 'published', effectiveFrom: new Date('2024-07-01') },
        ],
        countryRules: [
          { ruleType: 'leave', status: 'published', effectiveFrom: new Date('2024-01-01') },
          { ruleType: 'ot', status: 'published', effectiveFrom: new Date('2024-01-01') },
          { ruleType: 'public_holiday', status: 'published', effectiveFrom: new Date('2024-01-01') },
          { ruleType: 'employment_rules', status: 'published', effectiveFrom: new Date('2024-01-01') },
        ],
      });

      const result = await service.getCountryConfigStatus('country-aus');
      expect(result.isReadyForActivation).toBe(true);
      expect(result.missingCategories).toHaveLength(0);
    });
  });

  describe('createCountry', () => {
    it('blocks creation directly with status=active when incomplete', async () => {
      await expect(
        service.createCountry({
          name: 'New Country',
          isoCode: 'NEW',
          currency: 'USD',
          timezone: 'UTC',
          dateFormat: 'YYYY-MM-DD',
          status: 'active',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates draft country with defaults', async () => {
      prisma.unscoped.country.create.mockResolvedValue({
        id: 'new-id',
        name: 'New Country',
        isoCode: 'NEW',
        currency: 'USD',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        numberFormat: '1,234.56',
        defaultFinancialYearStart: '01-01',
        defaultPayFrequency: 'monthly',
        status: 'draft',
      });

      const result = await service.createCountry({
        name: 'New Country',
        isoCode: 'NEW',
        currency: 'USD',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
      });

      expect(result.status).toBe('draft');
      expect(result.defaultFinancialYearStart).toBe('01-01');
      expect(result.defaultPayFrequency).toBe('monthly');
      expect(result.configStatus?.isReadyForActivation).toBe(false);
    });
  });

  describe('updateCountry', () => {
    it('blocks activation if country rules are incomplete', async () => {
      // Mock assertCountryExists
      prisma.unscoped.country.findUnique
        // first for assertCountryExists
        .mockResolvedValueOnce({ id: 'c1' })
        // second for getCountryConfigStatus
        .mockResolvedValueOnce({
          id: 'c1',
          name: 'Country 1',
          isoCode: 'C1',
          status: 'draft',
          taxBrackets: [],
          countryRules: [],
        });

      await expect(
        service.updateCountry('c1', { status: 'active' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows activation when all 5 required rule categories are published', async () => {
      prisma.unscoped.country.findUnique
        .mockResolvedValueOnce({ id: 'c1' })
        .mockResolvedValueOnce({
          id: 'c1',
          name: 'Country 1',
          isoCode: 'C1',
          status: 'draft',
          taxBrackets: [
            { status: 'published', effectiveFrom: new Date('2024-07-01') },
          ],
          countryRules: [
            { ruleType: 'leave', status: 'published', effectiveFrom: new Date('2024-01-01') },
            { ruleType: 'ot', status: 'published', effectiveFrom: new Date('2024-01-01') },
            { ruleType: 'public_holiday', status: 'published', effectiveFrom: new Date('2024-01-01') },
            { ruleType: 'employment_rules', status: 'published', effectiveFrom: new Date('2024-01-01') },
          ],
        });

      prisma.unscoped.country.update.mockResolvedValue({
        id: 'c1',
        name: 'Country 1',
        isoCode: 'C1',
        currency: 'AUD',
        timezone: 'Australia/Sydney',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: '1,234.56',
        defaultFinancialYearStart: '07-01',
        defaultPayFrequency: 'monthly',
        status: 'active',
        companies: [],
        statesProvinces: [],
        countryRules: [
          { ruleType: 'leave', status: 'published', effectiveFrom: new Date('2024-01-01'), updatedAt: new Date() },
          { ruleType: 'ot', status: 'published', effectiveFrom: new Date('2024-01-01'), updatedAt: new Date() },
          { ruleType: 'public_holiday', status: 'published', effectiveFrom: new Date('2024-01-01'), updatedAt: new Date() },
          { ruleType: 'employment_rules', status: 'published', effectiveFrom: new Date('2024-01-01'), updatedAt: new Date() },
        ],
        taxBrackets: [
          { status: 'published', effectiveFrom: new Date('2024-07-01'), updatedAt: new Date() },
        ],
      });

      const updated = await service.updateCountry('c1', { status: 'active' });
      expect(updated.status).toBe('active');
      expect(updated.configStatus?.isReadyForActivation).toBe(true);
    });
  });

  describe('States and Provinces', () => {
    it('creates state and returns view', async () => {
      prisma.unscoped.country.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.unscoped.stateProvince.create.mockResolvedValue({
        id: 'sp-1',
        countryId: 'c1',
        name: 'New South Wales',
        code: 'NSW',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      const state = await service.createState('c1', {
        name: 'New South Wales',
        code: 'nsw',
      });

      expect(state.name).toBe('New South Wales');
      expect(state.code).toBe('NSW');
    });

    it('rejects duplicate state code with ConflictException', async () => {
      prisma.unscoped.country.findUnique.mockResolvedValue({ id: 'c1' });
      const error = new Prisma.PrismaClientKnownRequestError('Duplicate key', {
        code: 'P2002',
        clientVersion: '6.19.3',
      });
      prisma.unscoped.stateProvince.create.mockRejectedValue(error);

      await expect(
        service.createState('c1', { name: 'New South Wales', code: 'NSW' }),
      ).rejects.toThrow(ConflictException);
    });

    it('lists states with calculated company and tenant counts', async () => {
      prisma.unscoped.country.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.unscoped.stateProvince.findMany.mockResolvedValue([
        {
          id: 'sp-nsw',
          countryId: 'c1',
          name: 'New South Wales',
          code: 'NSW',
          status: 'active',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          companies: [{ id: 'comp-1', tenantId: 'tenant-alpha' }],
          locations: [
            { company: { id: 'comp-1', tenantId: 'tenant-alpha' } },
            { company: { id: 'comp-2', tenantId: 'tenant-beta' } },
          ],
        },
      ]);

      const list = await service.listStates('c1');
      expect(list).toHaveLength(1);
      expect(list[0].code).toBe('NSW');
      expect(list[0].companiesCount).toBe(2);
      expect(list[0].tenantsCount).toBe(2);
      expect(list[0].status).toBe('active');
    });

    it('updates state and returns updated view', async () => {
      prisma.unscoped.country.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.unscoped.stateProvince.findFirst.mockResolvedValue({
        id: 'sp-1',
        countryId: 'c1',
        name: 'New South Wales',
        code: 'NSW',
        status: 'active',
      });
      prisma.unscoped.stateProvince.update.mockResolvedValue({
        id: 'sp-1',
        countryId: 'c1',
        name: 'NSW (Updated)',
        code: 'NSW',
        status: 'retired',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        companies: [],
        locations: [],
      });

      const updated = await service.updateState('c1', 'sp-1', {
        name: 'NSW (Updated)',
        status: 'retired',
      });

      expect(updated.name).toBe('NSW (Updated)');
      expect(updated.status).toBe('retired');
      expect(prisma.unscoped.stateProvince.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sp-1' },
          data: { name: 'NSW (Updated)', status: 'retired' },
        }),
      );
    });

    it('throws NotFoundException when updating non-existent state', async () => {
      prisma.unscoped.country.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.unscoped.stateProvince.findFirst.mockResolvedValue(null);

      await expect(
        service.updateState('c1', 'missing-id', { name: 'Foo' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('bulk imports states by upserting and collecting line errors', async () => {
      prisma.unscoped.country.findUnique.mockResolvedValue({ id: 'c1' });
      // First state already exists
      prisma.unscoped.stateProvince.findFirst
        .mockResolvedValueOnce({ id: 'sp-nsw', code: 'NSW' })
        .mockResolvedValueOnce(null); // Second state does not exist
      prisma.unscoped.stateProvince.update.mockResolvedValue({});
      prisma.unscoped.stateProvince.create.mockResolvedValue({});
      prisma.unscoped.stateProvince.findMany.mockResolvedValue([
        {
          id: 'sp-nsw',
          countryId: 'c1',
          name: 'New South Wales',
          code: 'NSW',
          status: 'active',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          companies: [],
          locations: [],
        },
        {
          id: 'sp-vic',
          countryId: 'c1',
          name: 'Victoria',
          code: 'VIC',
          status: 'active',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          companies: [],
          locations: [],
        },
      ]);

      const result = await service.bulkImportStates('c1', {
        states: [
          { name: 'New South Wales', code: 'nsw' },
          { name: 'Victoria', code: 'VIC' },
          { name: '', code: 'ERR' }, // Missing name -> error
        ],
      });

      expect(result.updatedCount).toBe(1);
      expect(result.createdCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].line).toBe(3);
      expect(result.states).toHaveLength(2);
    });

    it('deletes state by id', async () => {
      prisma.unscoped.country.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.unscoped.stateProvince.findFirst.mockResolvedValue({
        id: 'sp-1',
        countryId: 'c1',
      });
      prisma.unscoped.stateProvince.delete.mockResolvedValue({});

      await service.deleteState('c1', 'sp-1');
      expect(prisma.unscoped.stateProvince.delete).toHaveBeenCalledWith({
        where: { id: 'sp-1' },
      });
    });
  });
});
