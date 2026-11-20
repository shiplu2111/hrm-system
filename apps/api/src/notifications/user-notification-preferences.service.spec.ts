import { BadRequestException } from '@nestjs/common';
import { TenantSettingCategory } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { FirebasePushService } from '../push/firebase-push.service';
import { SmtpSettingsService } from '../settings/smtp-settings.service';
import { UserNotificationPreferencesService } from './user-notification-preferences.service';

describe('UserNotificationPreferencesService', () => {
  let service: UserNotificationPreferencesService;
  let prisma: {
    unscoped: {
      employee: { findUnique: jest.Mock };
      company: { findFirst: jest.Mock };
      tenantSetting: { findUnique: jest.Mock; upsert: jest.Mock };
    };
  };
  let smtpSettings: { getSmtpSettings: jest.Mock };
  let firebasePush: { isConfigured: jest.Mock };

  const mockUser: AuthenticatedUser = {
    id: 'user-uuid-1',
    tenantId: 'tenant-uuid-1',
    roleId: 'role-uuid-1',
    roleName: 'Employee',
    email: 'employee@example.com',
    employeeId: 'emp-uuid-1',
    dataScope: 'own',
    permissions: [{ module: 'employee', action: 'view' }],
  };

  beforeEach(() => {
    prisma = {
      unscoped: {
        employee: {
          findUnique: jest.fn().mockResolvedValue({ companyId: 'company-uuid-1' }),
        },
        company: {
          findFirst: jest.fn().mockResolvedValue({ id: 'company-uuid-1' }),
        },
        tenantSetting: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn().mockResolvedValue({}),
        },
      },
    };

    smtpSettings = {
      getSmtpSettings: jest.fn().mockResolvedValue({ configured: true }),
    };

    firebasePush = {
      isConfigured: jest.fn().mockReturnValue(true),
    };

    service = new UserNotificationPreferencesService(
      prisma as unknown as PrismaService,
      smtpSettings as unknown as SmtpSettingsService,
      firebasePush as unknown as FirebasePushService,
    );
  });

  it('returns default preferences with security_critical non-suppressible', async () => {
    const res = await service.getPreferences(mockUser);
    expect(res.userId).toBe(mockUser.id);
    expect(res.categories.length).toBeGreaterThanOrEqual(6);

    const security = res.categories.find((c) => c.category === 'security_critical');
    expect(security).toBeDefined();
    expect(security?.isCritical).toBe(true);
    expect(security?.inApp).toBe(true);
    expect(security?.email).toBe(true);
  });

  it('allows updating non-critical channel preferences', async () => {
    const res = await service.updatePreferences(mockUser, {
      preferences: [
        {
          category: 'leave_attendance',
          inApp: true,
          email: false,
          push: true,
        },
      ],
    });

    expect(prisma.unscoped.tenantSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: `user_preferences:${mockUser.id}`,
          category: TenantSettingCategory.notification,
        }),
      }),
    );
    expect(res).toBeDefined();
  });

  it('rejects attempts to disable email on security_critical notifications', async () => {
    await expect(
      service.updatePreferences(mockUser, {
        preferences: [
          {
            category: 'security_critical',
            inApp: true,
            email: false,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects attempts to disable inApp on security_critical notifications', async () => {
    await expect(
      service.updatePreferences(mockUser, {
        preferences: [
          {
            category: 'security_critical',
            inApp: false,
            email: true,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('shouldDeliverToUser always returns true for security_critical inApp and email', async () => {
    // Even if setting was somehow stored as false
    prisma.unscoped.tenantSetting.findUnique.mockResolvedValue({
      value: {
        security_critical: { inApp: false, email: false },
      },
    });

    const inApp = await service.shouldDeliverToUser(
      mockUser.id,
      mockUser.tenantId!,
      'auth.password_changed',
      'inApp',
    );
    const email = await service.shouldDeliverToUser(
      mockUser.id,
      mockUser.tenantId!,
      'auth.password_changed',
      'email',
    );

    expect(inApp).toBe(true);
    expect(email).toBe(true);
  });

  it('shouldDeliverToUser respects opt-out for regular categories', async () => {
    prisma.unscoped.tenantSetting.findUnique.mockResolvedValue({
      value: {
        leave_attendance: { inApp: true, email: false, push: false },
      },
    });

    const inApp = await service.shouldDeliverToUser(
      mockUser.id,
      mockUser.tenantId!,
      'leave.approved',
      'inApp',
    );
    const email = await service.shouldDeliverToUser(
      mockUser.id,
      mockUser.tenantId!,
      'leave.approved',
      'email',
    );

    expect(inApp).toBe(true);
    expect(email).toBe(false);
  });
});
