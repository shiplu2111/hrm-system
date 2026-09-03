import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Roster, Shifts & Holiday Calendar (MODULES.md §12, §14)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let companyId: string;
  let employeeId: string;
  let locationId: string;
  let createdShiftId: string | null = null;
  let createdRosterId: string | null = null;
  let createdHolidayId: string | null = null;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);
    adminToken = login.body.data.accessToken as string;

    const companies = await request(app.getHttpServer())
      .get('/api/v1/organization/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    companyId = companies.body.data[0].id as string;

    const employees = await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    employeeId = employees.body.data[0].id as string;

    const locations = await prisma.location.findMany({
      where: { companyId },
      take: 1,
    });
    locationId = locations[0]?.id ?? '';
  });

  afterAll(async () => {
    if (createdHolidayId) {
      await prisma.holiday.delete({ where: { id: createdHolidayId } }).catch(() => undefined);
    }
    if (createdRosterId) {
      await prisma.roster.delete({ where: { id: createdRosterId } }).catch(() => undefined);
    }
    if (createdShiftId) {
      await prisma.roster.deleteMany({ where: { shiftId: createdShiftId } }).catch(() => undefined);
      await prisma.shift.delete({ where: { id: createdShiftId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('lists seeded shift definitions', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/shifts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0]).toMatchObject({
      name: expect.any(String),
      startTime: expect.stringMatching(/^\d{2}:\d{2}$/),
      endTime: expect.stringMatching(/^\d{2}:\d{2}$/),
      shiftType: 'fixed',
    });
  });

  it('creates, updates, and lists a shift', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/shifts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Early Morning',
        shiftType: 'fixed',
        startTime: '06:00',
        endTime: '14:00',
        breakMinutes: 30,
        graceMinutes: 10,
        minimumMinutes: 450,
      })
      .expect(201);

    createdShiftId = created.body.data.id as string;
    expect(created.body.data.name).toBe('Early Morning');

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/companies/${companyId}/shifts/${createdShiftId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Early Morning (Warehouse)' })
      .expect(200);

    expect(updated.body.data.name).toBe('Early Morning (Warehouse)');
  });

  it('assigns employee to shift on a date (roster)', async () => {
    expect(createdShiftId).toBeTruthy();

    const date = '2099-06-01';
    await prisma.roster.deleteMany({
      where: { employeeId, date: new Date(`${date}T00:00:00.000Z`) },
    });

    const created = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/rosters`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId,
        shiftId: createdShiftId,
        date,
        locationId,
      })
      .expect(201);

    createdRosterId = created.body.data.id as string;
    expect(created.body.data).toMatchObject({
      employeeId,
      shiftId: createdShiftId,
      date,
      locationId,
    });

    const list = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/rosters`)
      .query({ employeeId, from: date, to: date })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(list.body.data.some((row: { id: string }) => row.id === createdRosterId)).toBe(
      true,
    );
  });

  it('rejects duplicate roster for same employee and date', async () => {
    expect(createdShiftId).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/rosters`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId,
        shiftId: createdShiftId,
        date: '2099-06-01',
        locationId,
      })
      .expect(409);
  });

  it('creates company holiday and resolves merged calendar', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/holidays`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        scope: 'company',
        name: 'E2E Test Holiday',
        date: '2099-12-24',
        recurring: false,
      })
      .expect(201);

    createdHolidayId = created.body.data.id as string;

    const calendar = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/holidays/calendar`)
      .query({ from: '2025-01-01', to: '2025-12-31', stateCode: 'NSW' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(calendar.body.data.entries.length).toBeGreaterThan(0);
    expect(
      calendar.body.data.entries.some(
        (entry: { scope: string; name: string }) =>
          entry.scope === 'country' && entry.name.includes('Christmas'),
      ),
    ).toBe(true);
    expect(
      calendar.body.data.entries.some(
        (entry: { scope: string }) => entry.scope === 'state' || entry.scope === 'company',
      ),
    ).toBe(true);
  });

  it('creates branch-scoped holiday', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/holidays`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        scope: 'branch',
        locationId,
        name: 'Branch Closure',
        date: '2099-03-15',
      })
      .expect(201);

    await prisma.holiday.delete({ where: { id: created.body.data.id } });
    expect(created.body.data.scope).toBe('branch');
  });
});
