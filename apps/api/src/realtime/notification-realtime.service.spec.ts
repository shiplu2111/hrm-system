import { NotificationRealtimeService } from './notification-realtime.service';
import { REALTIME_SOCKET_EVENT } from './realtime.constants';

describe('NotificationRealtimeService', () => {
  it('emits notification payloads to the user room', () => {
    const service = new NotificationRealtimeService();
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    service.registerServer({ to } as never);

    service.pushNotification('user-123', {
      id: 'n1',
      eventType: 'leave.approved',
      title: 'Leave approved',
      body: 'Your leave was approved.',
      payload: {},
      readAt: null,
      createdAt: '2026-09-03T00:00:00.000Z',
    });

    expect(to).toHaveBeenCalledWith('user:user-123');
    expect(emit).toHaveBeenCalledWith(
      REALTIME_SOCKET_EVENT.notification,
      expect.objectContaining({ eventType: 'leave.approved' }),
    );
  });
});
