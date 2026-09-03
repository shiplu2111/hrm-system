import { BadRequestException, Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { DecryptedSmtpSettings } from './smtp-settings.utils';

export interface SendMailInput {
  settings: DecryptedSmtpSettings;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  async sendMail(input: SendMailInput): Promise<void> {
    const transport = nodemailer.createTransport({
      host: input.settings.host,
      port: input.settings.port,
      secure: input.settings.useTls && input.settings.port === 465,
      requireTLS: input.settings.useTls && input.settings.port !== 465,
      auth: {
        user: input.settings.username,
        pass: input.settings.password ?? '',
      },
    });

    try {
      await transport.sendMail({
        from: {
          name: input.settings.fromName,
          address: input.settings.fromAddress,
        },
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'SMTP delivery failed';
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Failed to send email: ${message}`,
      });
    } finally {
      transport.close();
    }
  }

  async sendTestEmail(
    settings: DecryptedSmtpSettings,
    toEmail: string,
    companyName: string,
  ): Promise<void> {
    await this.sendMail({
      settings,
      to: toEmail,
      subject: `${companyName} — SMTP test email`,
      text: [
        'This is a test email from your HRM admin panel SMTP configuration.',
        '',
        `Host: ${settings.host}:${settings.port}`,
        `From: ${settings.fromName} <${settings.fromAddress}>`,
        '',
        'If you received this message, your SMTP settings are working.',
      ].join('\n'),
      html: `<p>This is a test email from your HRM admin panel SMTP configuration.</p>
<p><strong>Host:</strong> ${settings.host}:${settings.port}<br/>
<strong>From:</strong> ${settings.fromName} &lt;${settings.fromAddress}&gt;</p>
<p>If you received this message, your SMTP settings are working.</p>`,
    });
  }
}
