import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { site } from '@/lib/site';

export interface OutgoingMail {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return transporter;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
  });
  return transporter;
}

export function salesInbox(): string {
  return process.env.SALES_INBOX_EMAIL || site.contact.salesEmail;
}

export class MailUnavailableError extends Error {}

/**
 * Sends through SMTP when configured. Without SMTP, development logs the message so forms
 * can be tested; production refuses so enquiries are never silently dropped.
 */
export async function sendMail(mail: OutgoingMail): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    if (process.env.NODE_ENV === 'production') {
      throw new MailUnavailableError('SMTP is not configured');
    }
    console.info(`[mail:dev] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    return;
  }
  await transport.sendMail({
    from: process.env.MAIL_FROM || `${site.name} <no-reply@cmsnbd.com>`,
    to: mail.to,
    replyTo: mail.replyTo,
    subject: mail.subject,
    text: mail.text,
  });
}

export function makeReference(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}
