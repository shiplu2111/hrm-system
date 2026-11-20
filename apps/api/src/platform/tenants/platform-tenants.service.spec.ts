import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PlatformTenantsService } from './platform-tenants.service';

describe('PlatformTenantsService', () => {
  let service: PlatformTenantsService;
  let mockPrisma: any;

  const sampleTenants = [
    {
      id: 'tenant-1',
      name: 'Acme Corp',
      subdomain: 'acme',
      planId: 'enterprise',
      status: 'active',
      createdAt: new Date('2026-01-10T10:00:00Z'),
      updatedAt: new Date('2026-03-01T12:00:00Z'),
      storageDriver: 'local',
      companies: [
        {
          id: 'comp-1',
          country: { name: 'United States', isoCode: 'USA' },
        },
      ],
      _count: { companies: 1, employees: 500 },
    },
    {
      id: 'tenant-2',
      name: 'Beta Logistics',
      subdomain: 'beta',
      planId: 'business',
      status: 'trial',
      createdAt: new Date('2026-02-15T10:00:00Z'),
      updatedAt: new Date('2026-02-20T10:00:00Z'),
      storageDriver: 's3',
      companies: [
        {
          id: 'comp-2',
          country: { name: 'Germany', isoCode: 'DEU' },
        },
      ],
      _count: { companies: 2, employees: 120 },
    },
    {
      id: 'tenant-3',
      name: 'Charlie Software',
      subdomain: 'charlie',
      planId: 'starter',
      status: 'suspended',
      createdAt: new Date('2026-03-01T10:00:00Z'),
      updatedAt: new Date('2026-03-05T10:00:00Z'),
      storageDriver: 'local',
      companies: [
        {
          id: 'comp-3',
          country: { name: 'Singapore', isoCode: 'SGP' },
        },
      ],
      _count: { companies: 1, employees: 25 },
    },
  ];

  beforeEach(async () => {
    mockPrisma = {
      unscoped: {
        tenant: {
          findMany: jest.fn().mockResolvedValue(sampleTenants),
          findUnique: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformTenantsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlatformAuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<PlatformTenantsService>(PlatformTenantsService);
  });

  it('should list all tenants and enrich metadata', async () => {
    const list = await service.listTenants();
    expect(list).toHaveLength(3);
    const acme = list.find((t) => t.id === 'tenant-1');
    expect(acme).toBeDefined();
    expect(acme?.country).toBe('United States');
    expect(acme?.countryCode).toBe('USA');
    expect(acme?.employeeCount).toBe(500);
    expect(acme?.plan).toBe('Enterprise');
    expect(acme?.status).toBe('Active');
  });

  it('should filter by search query (name or subdomain or country)', async () => {
    const list = await service.listTenants({ search: 'charlie' });
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Charlie Software');

    const countrySearch = await service.listTenants({ search: 'germany' });
    expect(countrySearch).toHaveLength(1);
    expect(countrySearch[0].name).toBe('Beta Logistics');
  });

  it('should filter by plan', async () => {
    const list = await service.listTenants({ plan: 'business' });
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Beta Logistics');
  });

  it('should filter by status', async () => {
    const list = await service.listTenants({ status: 'trial' });
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Beta Logistics');
  });

  it('should filter by country name or isoCode', async () => {
    const list = await service.listTenants({ country: 'Singapore' });
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Charlie Software');

    const isoList = await service.listTenants({ country: 'USA' });
    expect(isoList).toHaveLength(1);
    expect(isoList[0].name).toBe('Acme Corp');
  });

  it('should filter by created date range', async () => {
    const list = await service.listTenants({
      createdFrom: '2026-02-01',
      createdTo: '2026-02-28',
    });
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Beta Logistics');
  });

  it('should sort by name ascending and descending', async () => {
    const asc = await service.listTenants({ sortBy: 'name', sortOrder: 'asc' });
    expect(asc.map((t) => t.name)).toEqual([
      'Acme Corp',
      'Beta Logistics',
      'Charlie Software',
    ]);

    const desc = await service.listTenants({ sortBy: 'name', sortOrder: 'desc' });
    expect(desc.map((t) => t.name)).toEqual([
      'Charlie Software',
      'Beta Logistics',
      'Acme Corp',
    ]);
  });

  it('should sort by employees count', async () => {
    const asc = await service.listTenants({ sortBy: 'employees', sortOrder: 'asc' });
    expect(asc.map((t) => t.employeeCount)).toEqual([25, 120, 500]);

    const desc = await service.listTenants({ sortBy: 'employees', sortOrder: 'desc' });
    expect(desc.map((t) => t.employeeCount)).toEqual([500, 120, 25]);
  });

  it('should sort by plan hierarchy', async () => {
    const asc = await service.listTenants({ sortBy: 'plan', sortOrder: 'asc' });
    expect(asc.map((t) => t.plan)).toEqual(['Starter', 'Business', 'Enterprise']);

    const desc = await service.listTenants({ sortBy: 'plan', sortOrder: 'desc' });
    expect(desc.map((t) => t.plan)).toEqual(['Enterprise', 'Business', 'Starter']);
  });

  it('should sort by lastActivity date', async () => {
    const desc = await service.listTenants({
      sortBy: 'lastActivity',
      sortOrder: 'desc',
    });
    expect(desc[0].name).toBe('Charlie Software'); // Mar 5
    expect(desc[1].name).toBe('Acme Corp'); // Mar 1
    expect(desc[2].name).toBe('Beta Logistics'); // Feb 20
  });

  it('should handle pagination in listTenantsPaged', async () => {
    const paged = await service.listTenantsPaged({
      page: 1,
      pageSize: 2,
    });
    expect(paged.total).toBe(3);
    expect(paged.page).toBe(1);
    expect(paged.pageSize).toBe(2);
    expect(paged.totalPages).toBe(2);
    expect(paged.items).toHaveLength(2);

    const page2 = await service.listTenantsPaged({
      page: 2,
      pageSize: 2,
    });
    expect(page2.items).toHaveLength(1);
  });
});
