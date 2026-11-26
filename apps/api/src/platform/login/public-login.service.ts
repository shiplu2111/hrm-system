import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PlatformSettingCategory, TenantStatus } from '@prisma/client';
import type {
  PublicForgotCompanyResponse,
  PublicLoginDiscoverResponse,
  PublicPortalTarget,
} from '@hrm/shared-types';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../settings/mail.service';
import { PlatformAuditService } from '../audit/platform-audit.service';

const FORGOT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FORGOT_REQUESTS_PER_EMAIL = 5;

const UNKNOWN_COMPANY_MESSAGE = 'Please check the address or contact your administrator.';
const EMAIL_DISPATCH_NEUTRAL_MESSAGE =
  'If an active workspace is associated with that email address, we have sent the sign-in links to it. Check your inbox or contact your administrator.';

const ELIGIBLE_TENANT_STATUSES: TenantStatus[] = [
  TenantStatus.active,
  TenantStatus.trial,
  TenantStatus.past_due,
];

@Injectable()
export class PublicLoginService {
  private readonly logger = new Logger(PublicLoginService.name);
  private readonly forgotAttempts = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly fieldEncryption: FieldEncryptionService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  private getPortalBaseUrl(): string {
    return (
      process.env.APP_PORTAL_URL ||
      process.env.NEXT_PUBLIC_PORTAL_URL ||
      'http://localhost:5174'
    ).replace(/\/$/, '');
  }

  private getEmployeeAppBaseUrl(): string {
    return (
      process.env.EMPLOYEE_APP_URL ||
      process.env.NEXT_PUBLIC_EMPLOYEE_APP_URL ||
      this.getPortalBaseUrl()
    ).replace(/\/$/, '');
  }

  private buildTargetLoginUrl(
    subdomain: string,
    portal: PublicPortalTarget = 'portal',
    verifiedCustomDomain?: string | null,
  ): string {
    if (verifiedCustomDomain && portal === 'portal') {
      return `https://${verifiedCustomDomain}/login`;
    }
    const base =
      portal === 'employee' ? this.getEmployeeAppBaseUrl() : this.getPortalBaseUrl();
    const suffix = portal === 'employee' ? '&portal=employee' : '';
    return `${base}/login?tenant=${encodeURIComponent(subdomain)}${suffix}`;
  }

  private normalizeSubdomainOrHost(raw: string): { slug: string; host: string | null } {
    let cleaned = raw.trim().toLowerCase();
    cleaned = cleaned.replace(/^https?:\/\//, '').split('/')[0].split('?')[0].split('#')[0];
    const withoutPort = cleaned.split(':')[0];

    const host = withoutPort.includes('.') ? withoutPort : null;
    const firstLabel = withoutPort.split('.')[0] ?? withoutPort;
    const slug = firstLabel.replace(/[^a-z0-9-]/g, '');
    return { slug, host };
  }

  private enforceForgotRateLimit(email: string, now = Date.now()): void {
    const recent = (this.forgotAttempts.get(email) ?? []).filter(
      (ts) => now - ts < FORGOT_WINDOW_MS,
    );
    if (recent.length >= MAX_FORGOT_REQUESTS_PER_EMAIL) {
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message:
            'Too many workspace reminder requests for this email. Please wait before trying again.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.forgotAttempts.set(email, recent);
  }

  /**
   * Resolves a company subdomain (or emails workspace links if an email address is entered).
   * Never exposes customer existence beyond the redirect target needed for a valid subdomain.
   */
  async discoverLoginTarget(
    identifierRaw: string,
    portal: PublicPortalTarget = 'portal',
  ): Promise<PublicLoginDiscoverResponse> {
    const trimmed = identifierRaw.trim();
    if (!trimmed) {
      return {
        action: 'check_address',
        message: UNKNOWN_COMPANY_MESSAGE,
      };
    }

    // Never enumerate email addresses via HTTP responses; email links to owner instead.
    if (trimmed.includes('@')) {
      await this.dispatchForgotCompanyEmails(trimmed, portal);
      return {
        action: 'email_sent',
        message: EMAIL_DISPATCH_NEUTRAL_MESSAGE,
      };
    }

    const { slug, host } = this.normalizeSubdomainOrHost(trimmed);
    if (!slug) {
      return {
        action: 'check_address',
        message: UNKNOWN_COMPANY_MESSAGE,
      };
    }

    let tenant = await this.prisma.unscoped.tenant.findFirst({
      where: {
        subdomain: slug,
        deletedAt: null,
        status: { in: ELIGIBLE_TENANT_STATUSES },
      },
      select: {
        subdomain: true,
        customDomains: {
          where: { status: 'verified' },
          select: { domain: true },
          take: 1,
        },
      },
    });

    if (!tenant && host) {
      const domainMatch = await this.prisma.unscoped.tenantCustomDomain.findFirst({
        where: {
          domain: host,
          status: 'verified',
          tenant: {
            deletedAt: null,
            status: { in: ELIGIBLE_TENANT_STATUSES },
          },
        },
        select: {
          domain: true,
          tenant: { select: { subdomain: true } },
        },
      });
      if (domainMatch) {
        tenant = {
          subdomain: domainMatch.tenant.subdomain,
          customDomains: [{ domain: domainMatch.domain }],
        };
      }
    }

    if (!tenant) {
      return {
        action: 'check_address',
        message: UNKNOWN_COMPANY_MESSAGE,
      };
    }

    const customDomain = tenant.customDomains[0]?.domain ?? null;
    const redirectUrl = this.buildTargetLoginUrl(tenant.subdomain, portal, customDomain);

    return {
      action: 'redirect',
      redirectUrl,
      message: 'Redirecting to your workspace login...',
    };
  }

  /**
   * Emails workspace sign-in links exclusively to the work email owner for every
   * active/trial tenant associated with that email address, returning an identical
   * neutral confirmation regardless of whether any tenants match.
   */
  async forgotCompanyAddress(
    rawEmail: string,
    honeypot?: string,
  ): Promise<PublicForgotCompanyResponse> {
    if (honeypot && honeypot.trim().length > 0) {
      this.logger.debug('Honeypot triggered on forgot-company request — silently ignored.');
      return {
        accepted: true,
        message: EMAIL_DISPATCH_NEUTRAL_MESSAGE,
      };
    }

    await this.dispatchForgotCompanyEmails(rawEmail, 'portal');

    return {
      accepted: true,
      message: EMAIL_DISPATCH_NEUTRAL_MESSAGE,
    };
  }

  private async dispatchForgotCompanyEmails(
    rawEmail: string,
    portal: PublicPortalTarget,
  ): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    this.enforceForgotRateLimit(email);

    const userRows = await this.prisma.unscoped.user.findMany({
      where: {
        email,
        isActive: true,
        tenantId: { not: null },
        tenant: {
          deletedAt: null,
          status: { in: ELIGIBLE_TENANT_STATUSES },
        },
      },
      select: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            customDomains: {
              where: { status: 'verified' },
              select: { domain: true },
              take: 1,
            },
          },
        },
      },
    });

    const uniqueTenants = new Map<
      string,
      { name: string; subdomain: string; loginUrl: string }
    >();
    for (const row of userRows) {
      if (!row.tenant) continue;
      if (!uniqueTenants.has(row.tenant.id)) {
        uniqueTenants.set(row.tenant.id, {
          name: row.tenant.name,
          subdomain: row.tenant.subdomain,
          loginUrl: this.buildTargetLoginUrl(
            row.tenant.subdomain,
            portal,
            row.tenant.customDomains[0]?.domain ?? null,
          ),
        });
      }
    }

    await this.platformAudit.log({
      userId: null,
      action: 'public_login.forgot_company_requested',
      module: 'auth',
      reason: 'Workspace address reminder requested on public login page',
      newValue: {
        emailDomain: email.split('@')[1] ?? '',
        matchedWorkspaceCount: uniqueTenants.size,
      },
    });

    if (uniqueTenants.size === 0) {
      return;
    }

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

    const workspaceLines = Array.from(uniqueTenants.values()).map(
      (t) => `- ${t.name} (${t.subdomain}): ${t.loginUrl}`,
    );

    const subject = 'Your CMSN-HR workspace login link(s)';
    const text = [
      'Hello,',
      '',
      'You (or someone using this email address) requested a reminder of your CMSN-HR workspace address.',
      '',
      'Workspaces associated with your email:',
      ...workspaceLines,
      '',
      'If you did not request this email, you can safely ignore it.',
    ].join('\n');

    if (!smtp?.host || !smtp?.fromAddress) {
      this.logger.log(
        `[FORGOT_COMPANY_EMAIL_SIMULATED] to=${email} workspaces=${uniqueTenants.size}`,
      );
      return;
    }

    const password = smtp.passwordEnc ? this.fieldEncryption.decrypt(smtp.passwordEnc) : '';
    try {
      await this.mailService.sendMail({
        settings: {
          host: smtp.host,
          port: smtp.port ?? 587,
          useTls: Boolean(smtp.secure),
          username: smtp.username ?? '',
          password,
          fromAddress: smtp.fromAddress,
          fromName: smtp.fromName ?? 'CMSN-HR',
        },
        to: email,
        subject,
        text,
      });
    } catch (err: any) {
      this.logger.warn(
        `Failed sending forgot-company reminder email to ${email}: ${err?.message ?? 'unknown'}`,
      );
    }
  }
}
