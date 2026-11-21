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
