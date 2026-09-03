import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import {
  NotificationChannelType,
  NotificationDeliveryStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { FirebasePushService } from '../push/firebase-push.service';
import { NotificationRealtimeService } from '../realtime/notification-realtime.service';
import { RealtimeNotificationSettingsService } from '../realtime/realtime-notification-settings.service';
import { MailService } from '../settings/mail.service';
import { SmtpSettingsService } from '../settings/smtp-settings.service';
import { isSupportedNotificationEvent } from './notification.constants';
import { toInAppNotificationRecord } from './notification.mapper';
import {
  EMAIL_MAX_ATTEMPTS,
  EMAIL_RETRY_DELAYS_MS,
  PUSH_MAX_ATTEMPTS,
  PUSH_RETRY_DELAYS_MS,
} from './notification.constants';
import { PushDeviceTokensService } from './push-device-tokens.service';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly smtpSettingsService: SmtpSettingsService,
    private readonly realtimeSettingsService: RealtimeNotificationSettingsService,
    private readonly notificationRealtimeService: NotificationRealtimeService,
    private readonly pushDeviceTokensService: PushDeviceTokensService,
    private readonly firebasePushService: FirebasePushService,
  ) {}

  async deliverInApp(input: {
    tenantId: string;
    companyId: string;
    userId: string;
    eventType: string;
    title: string;
    body: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const row = await this.prisma.unscoped.inAppNotification.create({
      data: {
        tenantId: input.tenantId,
        companyId: input.companyId,
        userId: input.userId,
        eventType: input.eventType,
        title: input.title,
        body: input.body,
        payload: input.payload as object,
      },
    });

    const record = toInAppNotificationRecord(row);

    if (
      isSupportedNotificationEvent(input.eventType) &&
      (await this.realtimeSettingsService.shouldBroadcastLive(
        input.companyId,
        input.eventType,
      ))
    ) {
      this.notificationRealtimeService.pushNotification(input.userId, record);
    }
  }

  /** Push delivery is best-effort; in-app is always persisted separately (NOTIFICATION_LOGIC.md §6). */
  async deliverPushWithRetry(input: {
    tenantId: string;
    companyId: string;
    eventType: string;
    recipientUserId: string;
    title: string;
    body: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const tokens = await this.pushDeviceTokensService.listTokensForUser(
      input.recipientUserId,
    );
    if (tokens.length === 0) {
      return;
    }

    const delivery = await this.prisma.unscoped.notificationDelivery.create({
      data: {
        tenantId: input.tenantId,
        companyId: input.companyId,
        eventType: input.eventType,
        channel: NotificationChannelType.push,
        recipientUserId: input.recipientUserId,
        status: NotificationDeliveryStatus.pending,
        payload: input.payload as object,
      },
    });

    if (!this.firebasePushService.isConfigured()) {
      await this.prisma.unscoped.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationDeliveryStatus.failed,
          attemptCount: 1,
          lastError: 'Firebase FCM is not configured',
        },
      });
      return;
    }

    const dataPayload: Record<string, string> = {
      eventType: input.eventType,
    };
    for (const [key, value] of Object.entries(input.payload)) {
      if (value === null || value === undefined) continue;
      dataPayload[key] =
        typeof value === 'string' ? value : JSON.stringify(value);
    }

    let lastError: string | null = null;
    let attemptsMade = 0;

    for (let attempt = 0; attempt < PUSH_MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await sleep(PUSH_RETRY_DELAYS_MS[attempt] ?? 0);
      }
      attemptsMade = attempt + 1;

      try {
        const result = await this.firebasePushService.sendToTokens({
          tokens,
          title: input.title,
          body: input.body,
          data: dataPayload,
        });

        if (result.invalidTokens.length > 0) {
          await this.pushDeviceTokensService.removeInvalidTokens(
            result.invalidTokens,
          );
        }

        if (result.successCount > 0) {
          await this.prisma.unscoped.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: NotificationDeliveryStatus.sent,
              attemptCount: attempt + 1,
              sentAt: new Date(),
              lastError: null,
            },
          });
          return;
        }

        lastError = 'All registered device tokens rejected the push message';
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : 'FCM delivery failed';
        this.logger.warn(
          `Push delivery attempt ${attempt + 1}/${PUSH_MAX_ATTEMPTS} failed for ${input.eventType}: ${lastError}`,
        );
      }
    }

    await this.prisma.unscoped.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: NotificationDeliveryStatus.failed,
        attemptCount: attemptsMade || 1,
        lastError,
      },
    });
  }

  async deliverEmailWithRetry(input: {
    tenantId: string;
    companyId: string;
    eventType: string;
    toEmail: string;
    recipientUserId: string | null;
    subject: string;
    text: string;
    html: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const delivery = await this.prisma.unscoped.notificationDelivery.create({
      data: {
        tenantId: input.tenantId,
        companyId: input.companyId,
        eventType: input.eventType,
        channel: NotificationChannelType.email,
        recipientUserId: input.recipientUserId,
        recipientEmail: input.toEmail,
        status: NotificationDeliveryStatus.pending,
        payload: input.payload as object,
      },
    });

    let lastError: string | null = null;
    let attemptsMade = 0;

    for (let attempt = 0; attempt < EMAIL_MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await sleep(EMAIL_RETRY_DELAYS_MS[attempt] ?? 0);
      }
      attemptsMade = attempt + 1;

      try {
        const smtp = await this.smtpSettingsService.resolveDecryptedSettings(
          input.companyId,
        );
        await this.mailService.sendMail({
          settings: smtp,
          to: input.toEmail,
          subject: input.subject,
          text: input.text,
          html: input.html,
        });

        await this.prisma.unscoped.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: NotificationDeliveryStatus.sent,
            attemptCount: attempt + 1,
            sentAt: new Date(),
            lastError: null,
          },
        });
        return;
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : 'SMTP delivery failed';
        this.logger.warn(
          `Email delivery attempt ${attempt + 1}/${EMAIL_MAX_ATTEMPTS} failed for ${input.eventType}: ${lastError}`,
        );

        if (this.isNonRetryableEmailError(error)) {
          break;
        }
      }
    }

    await this.prisma.unscoped.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: NotificationDeliveryStatus.failed,
        attemptCount: attemptsMade || 1,
        lastError,
      },
    });
  }

  private isNonRetryableEmailError(error: unknown): boolean {
    if (
      error instanceof BadRequestException ||
      error instanceof InternalServerErrorException
    ) {
      return true;
    }
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('smtp password is required') ||
        message.includes('field_encryption_key') ||
        message.includes('smtp host')
      );
    }
    return false;
  }
}
