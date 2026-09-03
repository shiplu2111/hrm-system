import { Injectable, Logger } from '@nestjs/common';
import type { NotificationEmitInput } from '@hrm/shared-types';
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  renderNotificationTemplate,
} from './notification.constants';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationRecipientsService } from './notification-recipients.service';
import { NotificationRulesService } from './notification-rules.service';

@Injectable()
export class NotificationEngineService {
  private readonly logger = new Logger(NotificationEngineService.name);

  constructor(
    private readonly deliveryService: NotificationDeliveryService,
    private readonly recipientsService: NotificationRecipientsService,
    private readonly rulesService: NotificationRulesService,
  ) {}

  /** Event → rule → channel → recipient (NOTIFICATION_LOGIC.md §1). */
  async emit(input: NotificationEmitInput): Promise<void> {
    try {
      const rule = await this.rulesService.getRuleForEvent(
        input.companyId,
        input.eventType,
      );
      if (!rule.enabled) return;

      const templates = DEFAULT_NOTIFICATION_TEMPLATES[input.eventType];
      const title = renderNotificationTemplate(templates.title, input.variables);
      const body = renderNotificationTemplate(templates.body, input.variables);
      const emailSubject = renderNotificationTemplate(
        templates.emailSubject,
        input.variables,
      );
      const payload = input.payload ?? {};

      const recipients = await this.recipientsService.resolveRecipients(
        input.subjectEmployeeId,
        rule.recipients,
      );

      if (recipients.length === 0) {
        this.logger.warn(
          `No recipients resolved for ${input.eventType} (employee ${input.subjectEmployeeId})`,
        );
        return;
      }

      const seenInApp = new Set<string>();
      const seenEmail = new Set<string>();
      const seenPush = new Set<string>();

      for (const recipient of recipients) {
        if (rule.channels.inApp && recipient.userId && !seenInApp.has(recipient.userId)) {
          seenInApp.add(recipient.userId);
          await this.deliveryService.deliverInApp({
            tenantId: input.tenantId,
            companyId: input.companyId,
            userId: recipient.userId,
            eventType: input.eventType,
            title,
            body,
            payload,
          });
        }

        if (rule.channels.push && recipient.userId && !seenPush.has(recipient.userId)) {
          seenPush.add(recipient.userId);
          await this.deliveryService.deliverPushWithRetry({
            tenantId: input.tenantId,
            companyId: input.companyId,
            eventType: input.eventType,
            recipientUserId: recipient.userId,
            title,
            body,
            payload,
          });
        }

        if (rule.channels.email && recipient.email && !seenEmail.has(recipient.email)) {
          seenEmail.add(recipient.email);
          await this.deliveryService.deliverEmailWithRetry({
            tenantId: input.tenantId,
            companyId: input.companyId,
            eventType: input.eventType,
            toEmail: recipient.email,
            recipientUserId: recipient.userId,
            subject: emailSubject,
            text: body,
            html: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
            payload,
          });
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Notification dispatch failed';
      this.logger.error(
        `Failed to emit ${input.eventType}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
