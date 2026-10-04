import {
  ContractExpirySettingsService,
  contractExpirySettingsKey,
  parseWindowDays,
} from './contract-expiry-settings.service';

describe('parseWindowDays', () => {
  it('falls back to 30 days for missing or invalid values', () => {
    expect(parseWindowDays(undefined)).toBe(30);
    expect(parseWindowDays({ windowDays: 3 })).toBe(30);
    expect(parseWindowDays({ windowDays: 400 })).toBe(30);
    expect(parseWindowDays({ windowDays: 12.5 })).toBe(30);
    expect(parseWindowDays('60')).toBe(30);
  });

  it('accepts whole days inside the allowed range', () => {
    expect(parseWindowDays({ windowDays: 7 })).toBe(7);
    expect(parseWindowDays({ windowDays: 180 })).toBe(180);
  });
});

describe('ContractExpirySettingsService.windowsForCompanies', () => {
  it('maps each company to its stored window, defaulting the rest', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { tenantId: 't1', key: contractExpirySettingsKey('c1'), value: { windowDays: 60 } },
      // Same key stored under another tenant must not leak across.
      { tenantId: 't2', key: contractExpirySettingsKey('c2'), value: { windowDays: 90 } },
    ]);
    const service = new ContractExpirySettingsService(
      { unscoped: { tenantSetting: { findMany } } } as never,
      {} as never,
      {} as never,
    );

    const windows = await service.windowsForCompanies([
      { tenantId: 't1', companyId: 'c1' },
      { tenantId: 't1', companyId: 'c2' },
    ]);

    expect(windows.get('c1')).toBe(60);
    expect(windows.get('c2')).toBe(30);
  });
});
