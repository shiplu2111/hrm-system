import { NotificationChannelType, NotificationDeliveryStatus } from '@prisma/client';
import { NotificationDeliveryService } from './notification-delivery.service';

describe('NotificationDeliveryService push channel', () => {
  it('persists in-app before push is attempted (offline-safety)', async () => {
    const inAppCreate = jest.fn().mockResolvedValue({
      id: 'notif-1',
      eventType: 'leave.approved',
      title: 'Leave approved',
      body: 'Approved',
      payload: {},
      readAt: null,
      createdAt: new Date(),
    });
    const pushCreate = jest.fn();

    const service = new NotificationDeliveryService(
      {
        unscoped: {
          inAppNotification: { create: inAppCreate },
          notificationDelivery: { create: pushCreate, update: jest.fn() },
        },
      } as never,
      {} as never,
      {} as never,
      { shouldBroadcastLive: jest.fn().mockResolvedValue(false) } as never,
      { pushNotification: jest.fn() } as never,
      { listTokensForUser: jest.fn().mockResolvedValue(['token-a']) } as never,
      { isConfigured: jest.fn().mockReturnValue(true), sendToTokens: jest.fn() } as never,
    );

    await service.deliverInApp({
      tenantId: 'tenant-1',
      companyId: 'company-1',
      userId: 'user-1',
      eventType: 'leave.approved',
      title: 'Leave approved',
      body: 'Approved',
      payload: {},
    });

    expect(inAppCreate).toHaveBeenCalled();
    expect(pushCreate).not.toHaveBeenCalled();
  });

  it('logs push delivery attempts to notification_deliveries', async () => {
    const deliveryCreate = jest.fn().mockResolvedValue({ id: 'delivery-1' });
    const deliveryUpdate = jest.fn().mockResolvedValue(undefined);

    const service = new NotificationDeliveryService(
      {
        unscoped: {
          inAppNotification: { create: jest.fn() },
          notificationDelivery: {
            create: deliveryCreate,
            update: deliveryUpdate,
          },
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { listTokensForUser: jest.fn().mockResolvedValue(['token-a']) } as never,
      {
        isConfigured: jest.fn().mockReturnValue(true),
        sendToTokens: jest.fn().mockResolvedValue({
          successCount: 1,
          invalidTokens: [],
        }),
      } as never,
    );

    await service.deliverPushWithRetry({
      tenantId: 'tenant-1',
      companyId: 'company-1',
      eventType: 'leave.approved',
      recipientUserId: 'user-1',
      title: 'Leave approved',
      body: 'Approved',
      payload: {},
    });

    expect(deliveryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: NotificationChannelType.push,
          status: NotificationDeliveryStatus.pending,
        }),
      }),
    );
    expect(deliveryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationDeliveryStatus.sent,
        }),
      }),
    );
  });
});
