import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { InAppNotificationRecord } from '@hrm/shared-types';
import {
  REALTIME_SOCKET_EVENT,
  userRoom,
} from './realtime.constants';

@Injectable()
export class NotificationRealtimeService {
  private readonly logger = new Logger(NotificationRealtimeService.name);
  private server: Server | null = null;

  registerServer(server: Server): void {
    this.server = server;
  }

  pushNotification(userId: string, notification: InAppNotificationRecord): void {
    if (!this.server) {
      this.logger.debug(
        `Skipping realtime push for user ${userId} — WebSocket server not ready`,
      );
      return;
    }

    this.server
      .to(userRoom(userId))
      .emit(REALTIME_SOCKET_EVENT.notification, notification);
  }
}
