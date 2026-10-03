import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import { AuditLogQueryService } from './audit-log-query.service';
import { REDACTED } from './audit-redaction.utils';

const createdAt = new Date('2026-10-01T08:30:00.000Z');

function setup(rows: Record<string, unknown>[] = [], users: Record<string, unknown>[] = []) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const count = jest.fn().mockResolvedValue(rows.length);
  const userFindMany = jest.fn().mockResolvedValue(users);
  const prisma = {
    unscoped: {
      auditLog: { findMany, count },
      user: { findMany: userFindMany },
    },
  } as unknown as PrismaService;
  return { service: new AuditLogQueryService(prisma), findMany, count, userFindMany };
}

describe('AuditLogQueryService', () => {
  it('always scopes to the tenant and applies every filter', async () => {
    const { service, findMany, count } = setup();
    await service.list('t1', {
      module: 'payroll',
      userId: 'u1',
      recordId: 'r1',
      action: 'finalize',
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
      page: 3,
      pageSize: 10,
    });

    const where = {
      tenantId: 't1',
      module: 'payroll',
      userId: 'u1',
      recordId: 'r1',
      action: 'finalize',
      createdAt: {
        gte: new Date('2026-09-01T00:00:00.000Z'),
        lt: new Date('2026-10-01T00:00:00.000Z'),
      },
    };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 20, take: 10 }),
    );
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('rejects a date range that ends before it starts', async () => {
    const { service } = setup();
    await expect(
      service.list('t1', { from: '2026-10-02T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('names actors, falls back for unknown users and redacts stored values', async () => {
    const base = {
      module: 'employee',
      recordId: 'e1',
      ipAddress: '10.0.0.1',
      device: 'Chrome',
      createdAt,
    };
    const { service } = setup(
      [
        {
          ...base,
          id: 'a1',
          userId: 'u1',
          action: 'update',
          oldValue: { bankAccountNumber: '0123456789', status: 'active' },
          newValue: { bankAccountNumber: '9999888877', status: 'on_leave' },
        },
        { ...base, id: 'a2', userId: 'ghost', action: 'create', oldValue: null, newValue: { password: 'x' } },
      ],
      [{ id: 'u1', email: 'hr@demo.test', employee: { firstName: 'Ada', lastName: 'Lovelace' } }],
    );

    const result = await service.list('t1', {});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.data[0].actor).toEqual({ id: 'u1', name: 'Ada Lovelace', email: 'hr@demo.test' });
    expect(result.data[0].oldValue).toEqual({ bankAccountNumber: '******6789', status: 'active' });
    expect(result.data[0].createdAt).toBe(createdAt.toISOString());
    expect(result.data[1].actor).toEqual({ id: 'ghost', name: null, email: null });
    expect(result.data[1].oldValue).toBeNull();
    expect(result.data[1].newValue).toEqual({ password: REDACTED });
  });
});
