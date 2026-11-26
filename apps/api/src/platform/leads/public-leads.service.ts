import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { LeadStatus, PlatformSettingCategory } from '@prisma/client';
import type {
  PublicLeadErasureResult,
  PublicLeadSubmissionResponse,
} from '@hrm/shared-types';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { stripHeaderInjection } from '../../common/utils/html-escape';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../settings/mail.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PublicCaptchaService } from '../signup/public-captcha.service';
import {
  BaseLeadSubmissionDto,
  PublicContactMessageDto,
  PublicDemoRequestDto,
} from './dto/public-leads.dto';

type SubmissionKind = 'lead' | 'demo' | 'contact';

const PER_EMAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_EMAIL_SUBMISSIONS = 5;

const GENERIC_ACCEPTANCE: PublicLeadSubmissionResponse = {
  accepted: true,
  message: 'Thank you. Your inquiry has been received and a confirmation has been sent.',
};

@Injectable()
export class PublicLeadsService {
  private readonly logger = new Logger(PublicLeadsService.name);
  private readonly emailAttempts = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly captchaService: PublicCaptchaService,
    private readonly platformAudit: PlatformAuditService,
    private readonly mailService: MailService,
    private readonly fieldEncryption: FieldEncryptionService,
  ) {}

  async submitLead(
    dto: BaseLeadSubmissionDto,
    ipAddress?: string,
  ): Promise<PublicLeadSubmissionResponse> {
    return this.processSubmission('lead', dto, ipAddress);
  }

  async submitDemoRequest(
    dto: PublicDemoRequestDto,
    ipAddress?: string,
  ): Promise<PublicLeadSubmissionResponse> {
    return this.processSubmission('demo', dto, ipAddress);
  }

  async submitContactMessage(
    dto: PublicContactMessageDto,
    ipAddress?: string,
  ): Promise<PublicLeadSubmissionResponse> {
    return this.processSubmission('contact', dto, ipAddress);
  }

  /**
   * Resolves the configurable sales notification inbox address from PlatformSetting
   * (never hard-coded in application logic).
   */
  async resolveSalesInboxAddress(): Promise<string | null> {
    const settings = await this.prisma.unscoped.platformSetting.findMany({
      where: {
        category: PlatformSettingCategory.email,
        key: { in: ['sales_inbox', 'leads', 'default'] },
      },
      select: { key: true, value: true },
    });

    for (const key of ['sales_inbox', 'leads', 'default']) {
      const row = settings.find((s) => s.key === key);
      const val = row?.value as Record<string, unknown> | null;
      if (!val) continue;
      const candidate =
        (typeof val.salesInboxEmail === 'string' && val.salesInboxEmail) ||
        (typeof val.address === 'string' && val.address) ||
        (typeof val.email === 'string' && val.email) ||
        null;
      if (candidate && candidate.includes('@')) {
        return candidate.trim().toLowerCase();
      }
    }

    const envFallback = process.env.SALES_INBOX_EMAIL?.trim().toLowerCase();
    return envFallback && envFallback.includes('@') ? envFallback : null;
  }

  /**
   * Deletes all captured lead, demo request, and contact message records matching
   * a data subject email on request (SECURITY.md §9).
   */
  async eraseByEmail(
    rawEmail: string,
    reason: string,
    actorUserId?: string,
  ): Promise<PublicLeadErasureResult> {
    const email = rawEmail.trim().toLowerCase();

    const [leadsRes, demoRes, contactRes] = await this.prisma.unscoped.$transaction([
      this.prisma.unscoped.lead.deleteMany({ where: { workEmail: email } }),
      this.prisma.unscoped.demoRequest.deleteMany({ where: { workEmail: email } }),
      this.prisma.unscoped.contactMessage.deleteMany({ where: { workEmail: email } }),
    ]);

    const result: PublicLeadErasureResult = {
      leadsDeleted: leadsRes.count,
      demoRequestsDeleted: demoRes.count,
      contactMessagesDeleted: contactRes.count,
      totalDeleted: leadsRes.count + demoRes.count + contactRes.count,
    };

    await this.platformAudit.log({
      userId: actorUserId ?? null,
      action: 'public_lead.erased',
      module: 'leads',
      reason: reason.trim(),
      newValue: {
        emailDomain: email.split('@')[1] ?? '',
        ...result,
      },
    });

    return result;
  }

  private enforcePerEmailRateLimit(email: string, now = Date.now()): void {
    const recent = (this.emailAttempts.get(email) ?? []).filter(
      (ts) => now - ts < PER_EMAIL_WINDOW_MS,
    );
    if (recent.length >= MAX_EMAIL_SUBMISSIONS) {
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many submissions from this email address. Please wait before trying again.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.emailAttempts.set(email, recent);
  }

  private async processSubmission(
    kind: SubmissionKind,
    dto: BaseLeadSubmissionDto & { topic?: string },
    ipAddress?: string,
  ): Promise<PublicLeadSubmissionResponse> {
    // 1. Silent bot honeypot trap: discard without storing or sending email
    if (dto.website && dto.website.trim().length > 0) {
      this.logger.debug(`Honeypot triggered on ${kind} submission — silently discarded.`);
      return { ...GENERIC_ACCEPTANCE };
    }

    // 2. Enforce privacy consent before storing personal details
    if (!dto.privacyConsent) {
      throw new BadRequestException({
        code: 'PRIVACY_CONSENT_REQUIRED',
        message: 'Consent is required before submitting your inquiry.',
      });
    }

    // 3. Enforce CAPTCHA verification
    await this.captchaService.verifyToken(dto.captchaToken ?? '', ipAddress);

    const workEmail = dto.workEmail.trim().toLowerCase();
    this.enforcePerEmailRateLimit(workEmail);

    const now = new Date();
    const marketingConsent = Boolean(dto.marketingConsent);
    const allowAttribution = marketingConsent || Boolean(dto.attributionConsent);

    const commonData = {
      name: dto.name.trim(),
      workEmail,
      company: dto.company?.trim() || null,
      country: dto.country?.trim() || null,
      employeeCountBand: dto.employeeCountBand?.trim() || null,
      message: dto.message?.trim() || null,
      sourcePage: dto.sourcePage?.trim() || null,
      utmSource: allowAttribution ? dto.utmSource?.trim() || null : null,
      utmMedium: allowAttribution ? dto.utmMedium?.trim() || null : null,
      utmCampaign: allowAttribution ? dto.utmCampaign?.trim() || null : null,
      utmTerm: allowAttribution ? dto.utmTerm?.trim() || null : null,
      utmContent: allowAttribution ? dto.utmContent?.trim() || null : null,
      referrer: allowAttribution ? dto.referrer?.trim() || null : null,
      privacyConsent: true,
      marketingConsent,
      consentAt: now,
      status: LeadStatus.new,
    };

    let createdId: string;
    if (kind === 'lead') {
      const row = await this.prisma.unscoped.lead.create({ data: commonData });
      createdId = row.id;
    } else if (kind === 'demo') {
      const row = await this.prisma.unscoped.demoRequest.create({
        data: {
          ...commonData,
          company: commonData.company ?? 'Unspecified',
        },
      });
      createdId = row.id;
    } else {
      const row = await this.prisma.unscoped.contactMessage.create({
        data: {
          ...commonData,
          topic: dto.topic?.trim().toLowerCase() || 'general',
          message: commonData.message ?? '',
        },
      });
      createdId = row.id;
    }

    await this.platformAudit.log({
      userId: null,
      action: `public_${kind}.submitted`,
      module: 'leads',
      recordId: createdId,
      reason: `Captured public ${kind} inquiry`,
      newValue: {
        kind,
        sourcePage: commonData.sourcePage,
        country: commonData.country,
        marketingConsent,
      },
    });

    await this.dispatchSubmissionEmails(kind, createdId, commonData, dto.topic);

    return { ...GENERIC_ACCEPTANCE };
  }

  private async dispatchSubmissionEmails(
    kind: SubmissionKind,
    recordId: string,
    data: {
      name: string;
      workEmail: string;
      company: string | null;
      country: string | null;
      employeeCountBand: string | null;
      message: string | null;
      sourcePage: string | null;
    },
    topic?: string,
  ): Promise<void> {
    const emailRow = await this.prisma.unscoped.platformSetting.findUnique({
      where: {
        category_key: {
          category: PlatformSettingCategory.email,
          key: 'default',
        },
      },
      select: { value: true },
    });

    const smtp = emailRow?.value as
      | {
          host?: string;
          port?: number;
          secure?: boolean;
          username?: string;
          passwordEnc?: string | null;
          fromAddress?: string;
          fromName?: string;
        }
      | undefined;

    const salesInbox = await this.resolveSalesInboxAddress();

    const visitorSubject =
      kind === 'demo'
        ? 'We received your CMSN-HR demo request'
        : 'We received your message — CMSN-HR';
    const visitorBody = [
      `Hello ${data.name},`,
      ``,
      `Thank you for reaching out to CMSN-HR${data.company ? ` on behalf of ${data.company}` : ''}.`,
      `Your request (reference ${recordId}) has been received and our team will follow up via email.`,
    ].join('\n');

    const salesSubject = `[CMSN-HR ${kind.toUpperCase()}] New inquiry from ${stripHeaderInjection(data.company || data.name)}`;
    const salesBody = [
      `Type: ${kind}${topic ? ` (${topic})` : ''}`,
      `Reference ID: ${recordId}`,
      `Name: ${data.name}`,
      `Work Email: ${data.workEmail}`,
      `Company: ${data.company || 'N/A'}`,
      `Country: ${data.country || 'N/A'}`,
      `Employee Band: ${data.employeeCountBand || 'N/A'}`,
      `Source Page: ${data.sourcePage || 'N/A'}`,
      `Message: ${data.message || '(none)'}`,
    ].join('\n');

    if (!smtp?.host || !smtp?.fromAddress) {
      this.logger.log(`[LEAD_CONFIRMATION_EMAIL_SIMULATED] to=${data.workEmail} ref=${recordId}`);
      if (salesInbox) {
        this.logger.log(`[SALES_NOTIFICATION_EMAIL_SIMULATED] to=${salesInbox} ref=${recordId}`);
      } else {
        this.logger.warn(
          `[SALES_INBOX_UNCONFIGURED] Set PlatformSetting email.sales_inbox to enable sales team email alerts (ref=${recordId}).`,
        );
      }
      return;
    }

    const password = smtp.passwordEnc ? this.fieldEncryption.decrypt(smtp.passwordEnc) : '';
    const settings = {
      host: smtp.host,
      port: smtp.port ?? 587,
      useTls: Boolean(smtp.secure),
      username: smtp.username ?? '',
      password,
      fromAddress: smtp.fromAddress,
      fromName: smtp.fromName ?? 'CMSN-HR',
    };

    try {
      await this.mailService.sendMail({
        settings,
        to: data.workEmail,
        subject: visitorSubject,
        text: visitorBody,
      });
    } catch (err: any) {
      this.logger.warn(`Failed sending confirmation email to visitor: ${err?.message ?? 'unknown'}`);
    }

    if (salesInbox) {
      try {
        await this.mailService.sendMail({
          settings,
          to: salesInbox,
          subject: salesSubject,
          text: salesBody,
        });
      } catch (err: any) {
        this.logger.warn(`Failed sending notification email to sales inbox: ${err?.message ?? 'unknown'}`);
      }
    } else {
      this.logger.warn(
        `[SALES_INBOX_UNCONFIGURED] Set PlatformSetting email.sales_inbox to enable sales team email alerts (ref=${recordId}).`,
      );
    }
  }
}
