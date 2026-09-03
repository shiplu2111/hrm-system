import { Injectable, NotFoundException } from '@nestjs/common';
import type { InAppNotificationRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { toInAppNotificationRecord } from './notification.mapper';

@Injectable()
export class InAppNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(
    user: AuthenticatedUser,
    query?: { unreadOnly?: boolean; limit?: number },
  ): Promise<InAppNotificationRecord[]> {
    const limit = Math.min(query?.limit ?? 50, 100);
    const rows = await this.prisma.unscoped.inAppNotification.findMany({
      where: {
        userId: user.id,
        ...(query?.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map((row) => toInAppNotificationRecord(row));
  }

  async markRead(
    user: AuthenticatedUser,
    notificationId: string,
  ): Promise<InAppNotificationRecord> {
    const row = await this.prisma.unscoped.inAppNotification.findFirst({
      where: { id: notificationId, userId: user.id },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Notification not found',
      });
    }

    if (row.readAt) {
      return toInAppNotificationRecord(row);
    }

    const updated = await this.prisma.unscoped.inAppNotification.update({
      where: { id: row.id },
      data: { readAt: new Date() },
    });

    return toInAppNotificationRecord(updated);
  }
}
