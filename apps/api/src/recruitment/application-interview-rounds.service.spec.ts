import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { INTERVIEW_SCORECARD_CRITERIA } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApplicationInterviewRoundsService } from './application-interview-rounds.service';

const user = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: 'user-1',
  tenantId: 'tenant-1',
  roleId: 'role-1',
  roleName: 'Manager',
  employeeId: 'emp-interviewer',
  email: 'manager@example.com',
  permissions: [],
  ...overrides,
});

function round(overrides: Record<string, unknown> = {}) {
  return {
    id: 'round-1',
    tenantId: 'tenant-1',
    companyId: 'company-1',
    applicationId: 'app-1',
    roundType: 'technical',
    roundOrder: 1,
    status: 'scheduled',
    scheduledStartAt: new Date('2026-10-05T10:00:00Z'),
    scheduledEndAt: new Date('2026-10-05T11:00:00Z'),
    location: null,
    meetingUrl: null,
    interviewerEmployeeId: 'emp-interviewer',
    score: null,
    recommendation: null,
    feedback: null,
    scorecard: null,
    completedAt: null,
    completedByUserId: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    interviewer: { firstName: 'Mia', lastName: 'Manager' },
    completedBy: null,
    ...overrides,
  };
}

function build(options: { stage?: string; existing?: ReturnType<typeof round> } = {}) {
  const existing = options.existing ?? round();
  const prisma = {
    unscoped: {
      jobApplicationInterviewRound: {
        findUnique: jest.fn().mockResolvedValue(existing),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ ...existing, ...data }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      jobApplication: {
        findUnique: jest.fn().mockImplementation(({ select }) =>
          Promise.resolve(
            select
              ? {
                  candidate: { firstName: 'Cara', lastName: 'Candidate' },
                  requisition: { title: 'Backend Engineer' },
                  company: { timezone: 'Asia/Dhaka' },
                }
              : {
                  id: 'app-1',
                  tenantId: 'tenant-1',
                  companyId: 'company-1',
                  stage: options.stage ?? 'interview',
                },
          ),
        ),
        update: jest.fn(),
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue({ id: 'emp-interviewer' }),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Dhaka' }),
      },
    },
  };
  const notificationEngine = { emit: jest.fn() };
  const auditService = { log: jest.fn() };
  const service = new ApplicationInterviewRoundsService(
    prisma as never,
    { assertCompanyInTenant: jest.fn() } as never,
    auditService as never,
    notificationEngine as never,
    { getUrl: jest.fn() } as never,
  );
  return { service, prisma, notificationEngine, auditService };
}

const technicalRatings = INTERVIEW_SCORECARD_CRITERIA.technical.map((c) => ({
  key: c.key,
  rating: 4,
}));

describe('ApplicationInterviewRoundsService', () => {
  describe('complete', () => {
    it('stores the scorecard and derives the score from ratings', async () => {
      const { service, prisma } = build();

      const record = await service.complete(
        'round-1',
        { recommendation: 'yes', ratings: technicalRatings, score: 1 } as never,
        user(),
        { asInterviewer: true },
      );

      const { data } = prisma.unscoped.jobApplicationInterviewRound.update.mock.calls[0][0];
      expect(data.score).toBe(4);
      expect(data.scorecard.ratings).toHaveLength(technicalRatings.length);
      expect(record.scorecard?.ratings[0]).toEqual(
        expect.objectContaining({ key: technicalRatings[0].key, rating: 4 }),
      );
    });

    it('blocks interviewers who are not assigned to the round', async () => {
      const { service } = build();
      await expect(
        service.complete(
          'round-1',
          { recommendation: 'yes', ratings: technicalRatings } as never,
          user({ employeeId: 'someone-else' }),
          { asInterviewer: true },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('requires a score when no scorecard is given', async () => {
      const { service } = build();
      await expect(
        service.complete('round-1', { recommendation: 'yes' } as never, user()),
      ).rejects.toThrow(/scorecard ratings or an overall score/);
    });

    it('refuses rounds on applications that left the interview stage', async () => {
      const { service } = build({ stage: 'rejected' });
      await expect(
        service.complete('round-1', { recommendation: 'yes', score: 4 } as never, user()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('schedule', () => {
    const dto = {
      scheduledStartAt: '2026-10-06T09:00:00.000Z',
      scheduledEndAt: '2026-10-06T10:00:00.000Z',
      interviewerEmployeeId: 'emp-interviewer',
    };

    it('rejects double-booking the interviewer unless overridden', async () => {
      const { service, prisma } = build({ existing: round({ status: 'pending' }) });
      prisma.unscoped.jobApplicationInterviewRound.findMany.mockResolvedValue([
        {
          id: 'round-other',
          roundType: 'hr',
          scheduledStartAt: new Date('2026-10-06T09:30:00Z'),
          scheduledEndAt: null,
          application: { candidate: { firstName: 'Other', lastName: 'Person' } },
        },
      ]);

      await expect(service.schedule('round-1', dto, user())).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(service.schedule('round-1', dto, user())).rejects.toThrow(
        /HR interview with Other Person on .*GMT\+6/,
      );
      await expect(
        service.schedule('round-1', { ...dto, allowConflict: true }, user()),
      ).resolves.toEqual(expect.objectContaining({ status: 'scheduled' }));
    });

    it('notifies the interviewer when a booking is created', async () => {
      const { service, notificationEngine } = build({
        existing: round({ status: 'pending', scheduledStartAt: null, interviewerEmployeeId: null }),
      });

      await service.schedule('round-1', dto, user());

      expect(notificationEngine.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'interview.scheduled',
          subjectEmployeeId: 'emp-interviewer',
          variables: expect.objectContaining({
            candidate_name: 'Cara Candidate',
            round_name: 'Technical',
          }),
        }),
      );
    });

    it('does not re-notify when nothing about the booking changed', async () => {
      const { service, notificationEngine } = build({
        existing: round({
          scheduledStartAt: new Date(dto.scheduledStartAt),
          scheduledEndAt: new Date(dto.scheduledEndAt),
        }),
      });

      await service.schedule('round-1', dto, user());

      expect(notificationEngine.emit).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('returns a scheduled round to pending and clears the booking', async () => {
      const { service, prisma } = build();

      const record = await service.cancel('round-1', { reason: 'Candidate ill' }, user());

      expect(prisma.unscoped.jobApplicationInterviewRound.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending',
            scheduledStartAt: null,
            interviewerEmployeeId: null,
          }),
        }),
      );
      expect(record.status).toBe('pending');
    });

    it('only cancels scheduled rounds', async () => {
      const { service } = build({ existing: round({ status: 'completed' }) });
      await expect(service.cancel('round-1', {}, user())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
