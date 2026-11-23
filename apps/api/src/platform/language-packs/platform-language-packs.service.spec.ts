import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { PlatformLanguagePacksService } from './platform-language-packs.service';

describe('PlatformLanguagePacksService', () => {
  let service: PlatformLanguagePacksService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockPacks: any[];

  beforeEach(async () => {
    mockPacks = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        code: 'en',
        name: 'English',
        nativeName: 'English',
        direction: 'ltr',
        isAvailableToTenants: true,
        isDefault: true,
        totalKeys: 5,
        translatedKeys: 5,
        completenessPercent: new Prisma.Decimal(100.0),
        version: '1.0.0',
        translations: {
          common: { save: 'Save', cancel: 'Cancel', search: 'Search' },
          auth: { login: 'Sign In', logout: 'Sign Out' },
        },
        notes: 'Canonical English',
        lastImportedAt: null,
        lastExportedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        code: 'bn',
        name: 'Bengali',
        nativeName: 'বাংলা',
        direction: 'ltr',
        isAvailableToTenants: true,
        isDefault: false,
        totalKeys: 5,
        translatedKeys: 5,
        completenessPercent: new Prisma.Decimal(100.0),
        version: '1.0.0',
        translations: {
          common: { save: 'সংরক্ষণ', cancel: 'বাতিল', search: 'অনুসন্ধান' },
          auth: { login: 'লগইন', logout: 'লগআউট' },
        },
        notes: 'Bengali Localization',
        lastImportedAt: null,
        lastExportedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        direction: 'ltr',
        isAvailableToTenants: false,
        isDefault: false,
        totalKeys: 5,
        translatedKeys: 3,
        completenessPercent: new Prisma.Decimal(60.0),
        version: '1.0.0',
        translations: {
          common: { save: 'Guardar', cancel: 'Cancelar', search: 'Buscar' },
          auth: { login: '', logout: null }, // 2 missing/empty keys
        },
        notes: 'Spanish Draft',
        lastImportedAt: null,
        lastExportedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ];

    mockPrisma = {
      unscoped: {
        platformLanguagePack: {
          count: jest.fn().mockImplementation(async () => mockPacks.length),
          findMany: jest.fn().mockImplementation(async ({ where }: any = {}) => {
            let res = [...mockPacks];
            if (where?.isAvailableToTenants) {
              res = res.filter((p) => p.isAvailableToTenants);
            }
            if (where?.OR) {
              const query = where.OR[0].code.contains;
              res = res.filter(
                (p) =>
                  p.code.toLowerCase().includes(query) ||
                  p.name.toLowerCase().includes(query) ||
                  p.nativeName.toLowerCase().includes(query),
              );
            }
            return res;
          }),
          findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
            return mockPacks.find((p) => p.code === where.code) || null;
          }),
          findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
            if (where?.isDefault) {
              return mockPacks.find((p) => p.isDefault) || null;
            }
            return mockPacks[0] || null;
          }),
          create: jest.fn().mockImplementation(async ({ data }: any) => {
            const newRecord = {
              id: '44444444-4444-4444-4444-444444444444',
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockPacks.push(newRecord);
            return newRecord;
          }),
          update: jest.fn().mockImplementation(async ({ where, data }: any) => {
            const index = mockPacks.findIndex((p) => p.id === where.id || p.code === where.code);
            if (index === -1) throw new Error('Not found in mock');
            mockPacks[index] = {
              ...mockPacks[index],
              ...data,
              updatedAt: new Date(),
            };
            return mockPacks[index];
          }),
        },
      },
    };

    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformLanguagePacksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<PlatformLanguagePacksService>(PlatformLanguagePacksService);
  });

  describe('Flatten / Unflatten / Stats', () => {
    it('flattens nested object keys into dot-notation paths', () => {
      const nested = {
        common: { save: 'Save', alert: { ok: 'OK' } },
        nav: { home: 'Home' },
      };
      const flat = service.flattenTranslations(nested);
      expect(flat).toEqual({
        'common.save': 'Save',
        'common.alert.ok': 'OK',
        'nav.home': 'Home',
      });
    });

    it('unflattens dot-notation paths into nested objects', () => {
      const flat = {
        'common.save': 'Save',
        'common.actions.delete': 'Delete',
      };
      const nested = service.unflattenTranslations(flat);
      expect(nested).toEqual({
        common: {
          save: 'Save',
          actions: { delete: 'Delete' },
        },
      });
    });

    it('calculates completeness percentage correctly', () => {
      const baseFlat = { 'a.1': 'One', 'a.2': 'Two', 'b.1': 'Three', 'b.2': 'Four' };
      const targetFlat = { 'a.1': 'Uno', 'a.2': '', 'b.1': 'Tres' }; // 2 out of 4 translated

      const stats = service.calculateStats(baseFlat, targetFlat);
      expect(stats.totalBaseKeys).toBe(4);
      expect(stats.translatedKeys).toBe(2);
      expect(stats.missingKeysCount).toBe(2);
      expect(stats.completenessPercent).toBe(50.0);
    });
  });

  describe('listLanguagePacks', () => {
    it('returns all language pack summaries with completeness', async () => {
      const list = await service.listLanguagePacks();
      expect(list.length).toBe(3);
      expect(list[0].code).toBe('en');
      expect(list[0].completenessPercent).toBe(100.0);
      expect(list[2].code).toBe('es');
      expect(list[2].completenessPercent).toBe(60.0);
      expect(list[2].missingKeysCount).toBe(2);
    });

    it('filters by availability', async () => {
      const list = await service.listLanguagePacks({ availableOnly: true });
      expect(list.length).toBe(2);
      expect(list.every((p) => p.isAvailableToTenants)).toBe(true);
    });

    it('searches by code or name', async () => {
      const list = await service.listLanguagePacks({ search: 'span' });
      expect(list.length).toBe(1);
      expect(list[0].code).toBe('es');
    });
  });

  describe('getLanguagePack', () => {
    it('returns detail including full translations', async () => {
      const detail = await service.getLanguagePack('bn');
      expect(detail.code).toBe('bn');
      expect(detail.translations.common.save).toBe('সংরক্ষণ');
    });

    it('throws NotFoundException when code does not exist', async () => {
      await expect(service.getLanguagePack('xx')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMissingKeysReport', () => {
    it('generates a detailed report identifying missing and empty keys', async () => {
      const report = await service.getMissingKeysReport('es');
      expect(report.languageCode).toBe('es');
      expect(report.baseLanguageCode).toBe('en');
      expect(report.totalBaseKeys).toBe(5);
      expect(report.translatedKeys).toBe(3);
      expect(report.missingKeysCount).toBe(2);
      expect(report.completenessPercent).toBe(60.0);

      // Namespaces breakdown
      expect(report.namespaces.length).toBe(2); // common and auth
      const commonNs = report.namespaces.find((n) => n.namespace === 'common');
      const authNs = report.namespaces.find((n) => n.namespace === 'auth');
      expect(commonNs?.completenessPercent).toBe(100.0);
      expect(authNs?.completenessPercent).toBe(0.0);

      // Missing keys list
      expect(report.missingKeys.length).toBe(2);
      expect(report.missingKeys.map((k) => k.key).sort()).toEqual(['auth.login', 'auth.logout'].sort());
    });
  });

  describe('exportTranslations', () => {
    it('exports nested JSON catalog and touches lastExportedAt', async () => {
      const result = await service.exportTranslations('en', 'nested');
      expect(result.filename).toBe('en-translations.json');
      expect(result.data.common.save).toBe('Save');
    });

    it('exports flat format', async () => {
      const result = await service.exportTranslations('en', 'flat');
      expect(result.data['common.save']).toBe('Save');
    });

    it('exports missing-template format for translators', async () => {
      const result = await service.exportTranslations('es', 'missing-template');
      expect(result.filename).toBe('es-missing-keys.json');
      expect(result.data.auth.login).toBe('');
      expect(result.data.auth.logout).toBe('');
      expect(result.data.common).toBeUndefined(); // already translated
    });
  });

  describe('importTranslations', () => {
    it('merges new translations and updates completeness', async () => {
      const importInput = {
        translations: {
          auth: { login: 'Iniciar sesión' }, // fill in 1 missing key
        },
        mode: 'merge' as const,
      };

      const result = await service.importTranslations('es', importInput, 'user-123');
      expect(result.code).toBe('es');
      expect(result.translatedKeys).toBe(4);
      expect(result.missingKeysCount).toBe(1);
      expect(result.completenessPercent).toBe(80.0);
      expect(result.version).toBe('1.1.0');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          module: 'PlatformLanguagePacks',
        }),
      );
    });

    it('can automatically mark available to tenants when completeness reaches threshold', async () => {
      const importInput = {
        translations: {
          auth: { login: 'Iniciar sesión', logout: 'Cerrar sesión' }, // 100% complete
        },
        markAvailableIfComplete: true,
      };

      const result = await service.importTranslations('es', importInput, 'user-123');
      expect(result.completenessPercent).toBe(100.0);
      expect(result.isAvailableToTenants).toBe(true);
    });
  });

  describe('setAvailability', () => {
    it('updates tenant availability for a non-default language pack', async () => {
      const updated = await service.setAvailability('es', {
        isAvailableToTenants: true,
        reason: 'Spanish translations approved for enterprise tenants',
      }, 'user-admin');

      expect(updated.isAvailableToTenants).toBe(true);
      expect(mockAudit.log).toHaveBeenCalled();
    });

    it('throws BadRequestException when trying to disable availability of canonical default language', async () => {
      await expect(
        service.setAvailability('en', { isAvailableToTenants: false }, 'user-admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createLanguagePack', () => {
    it('creates a new language pack and computes initial completeness', async () => {
      const created = await service.createLanguagePack({
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        direction: 'ltr',
        translations: { common: { save: 'Enregistrer' } },
      }, 'user-admin');

      expect(created.code).toBe('fr');
      expect(created.totalKeys).toBe(5);
      expect(created.translatedKeys).toBe(1);
      expect(created.completenessPercent).toBe(20.0);
      expect(mockAudit.log).toHaveBeenCalled();
    });

    it('throws ConflictException on duplicate language code', async () => {
      await expect(
        service.createLanguagePack({
          code: 'en',
          name: 'English duplicate',
          nativeName: 'English',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listAvailableForTenants', () => {
    it('returns only languages marked available to tenants', async () => {
      const available = await service.listAvailableForTenants();
      expect(available.length).toBe(2);
      expect(available.map((l) => l.code).sort()).toEqual(['bn', 'en'].sort());
    });
  });
});
