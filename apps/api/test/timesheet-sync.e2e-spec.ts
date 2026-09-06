import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createTestApp } from './test-app';

describe('Timesheet offline sync (OFFLINE_SYNC.md §4, §10)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let employeeToken: string;
  let employeeId: string;
  const projectId = '10000000-0000-4000-8000-0000000000f0';
  const localIds = {
    logEntry: randomUUID(),
    submitEntry: randomUUID(),
    replayLogEntry: randomUUID(),
  };
  let entryId: string | null = null;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'employee@cmsnbd.com',
        password: 'password',
        tenantSubdomain: 'demo',
      })
      .expect(201);
    employeeToken = login.body.data.accessToken as string;
    employeeId = login.body.data.user.employeeId as string;

    await prisma.timesheetSyncEvent.deleteMany({
      where: { localId: { in: Object.values(localIds) } },
    });
    await prisma.timesheetEntry.deleteMany({
      where: { employeeId, localId: { in: [localIds.logEntry] } },
    });
  });

  afterAll(async () => {
    await prisma.timesheetSyncEvent.deleteMany({
      where: { localId: { in: Object.values(localIds) } },
    });
    if (entryId) {
      await prisma.workflowInstance
        .deleteMany({ where: { entityId: entryId } })
        .catch(() => undefined);
      await prisma.timesheetEntry
        .delete({ where: { id: entryId } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('creates a draft entry from log_entry and is idempotent on replay', async () => {
    const entryDate = '2026-03-25';
    const payload = {
      deviceId: 'mobile-test-device',
      events: [
        {
          local_id: localIds.logEntry,
          employee_id: employeeId,
          type: 'log_entry',
          timestamp_device: new Date().toISOString(),
          entry_date: entryDate,
          project_id: projectId,
          task_name: 'Offline API work',
          start_time: new Date(`${entryDate}T09:00:00.000Z`).toISOString(),
          end_time: new Date(`${entryDate}T12:00:00.000Z`).toISOString(),
          break_minutes: 0,
          is_billable: true,
        },
      ],
    };

    const first = await request(app.getHttpServer())
      .post('/api/v1/sync/timesheet')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(payload)
      .expect(201);

    expect(first.body.data.results).toHaveLength(1);
    expect(first.body.data.results[0].status).toBe('created');
    entryId = first.body.data.results[0].server_id as string;

    const second = await request(app.getHttpServer())
      .post('/api/v1/sync/timesheet')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(payload)
      .expect(201);

    expect(second.body.data.results[0].status).toBe('duplicate');
    expect(second.body.data.results[0].server_id).toBe(entryId);

    const count = await prisma.timesheetEntry.count({
      where: { employeeId, localId: localIds.logEntry },
    });
    expect(count).toBe(1);
  });

  it('submits a draft entry via submit_entry referencing entry_local_id', async () => {
    expect(entryId).toBeTruthy();

    const payload = {
      deviceId: 'mobile-test-device',
      events: [
        {
          local_id: localIds.submitEntry,
          employee_id: employeeId,
          type: 'submit_entry',
          timestamp_device: new Date().toISOString(),
          entry_local_id: localIds.logEntry,
        },
      ],
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/sync/timesheet')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(payload)
      .expect(201);

    expect(response.body.data.results[0].status).toBe('created');

    const entry = await prisma.timesheetEntry.findUniqueOrThrow({
      where: { id: entryId! },
    });
    expect(entry.status).toBe('pending_approval');
  });
});
