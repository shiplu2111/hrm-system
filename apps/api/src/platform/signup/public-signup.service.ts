import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PendingSignupStatus, PlatformSettingCategory } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import type {
  PublicSignupAcceptedResponse,
  PublicSignupAuthMethod,
  PublicSignupVerificationResponse,
  PublicSubdomainAvailabilityResponse,
  PublicTrialConfigResponse,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { MailService } from '../../settings/mail.service';
import { escapeHtml, stripHeaderInjection } from '../../common/utils/html-escape';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PublicPlansService } from '../plans/public-plans.service';
import { TenantLifecycleQueueService } from '../tenants/tenant-lifecycle-queue.service';
import { PublicSignupDto } from './dto/public-signup.dto';
import { PublicCaptchaService } from './public-captcha.service';

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export const RESERVED_SUBDOMAINS = new Set<string>([
  'admin',
  'platform',
  'www',
  'api',
  'app',
  'portal',
  'mail',
  'smtp',
  'cdn',
  'status',
  'docs',
  'help',
  'billing',
  'support',
  'assets',
  'static',
  'root',
  'localhost',
  'staging',
  'prod',
  'production',
  'demo',
  'test',
  'auth',
  'oauth',
  'sso',
]);

export const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'yopmail.com',
  'throwaway.email',
  'trashmail.com',
  'getnada.com',
  'sharklasers.com',
  'dispostable.com',
  'fakeinbox.com',
  'maildrop.cc',
  'mintemail.com',
  'burnermail.io',
  'mohmal.com',
  'tempail.com',
  'emailondeck.com',
]);

const SIGNUP_TTL_HOURS = 24;
const SIGNUP_TTL_MS = SIGNUP_TTL_HOURS * 60 * 60 * 1000;
const PER_EMAIL_RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_EMAIL_WINDOW = 3;
const DEFAULT_TRIAL_DAYS = 14;

const GENERIC_ACCEPTED_RESPONSE: PublicSignupAcceptedResponse = {
  accepted: true,
  status: 'verification_sent',
  expiresInHours: SIGNUP_TTL_HOURS,
  message:
    'If this email is eligible, check your inbox for a verification link to finish creating your workspace. Links expire in 24 hours.',
};

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function splitOwnerName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: 'Workspace', lastName: 'Owner' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Owner' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class PublicSignupService {
  private readonly logger = new Logger(PublicSignupService.name);
  private readonly emailAttempts = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly captchaService: PublicCaptchaService,
    private readonly lifecycleQueue: TenantLifecycleQueueService,
    private readonly platformAudit: PlatformAuditService,
    private readonly mailService: MailService,
    private readonly fieldEncryption: FieldEncryptionService,
    @Optional() private readonly publicPlansService?: PublicPlansService,
  ) {}

  private getWebsiteBaseUrl(): string {
    return (process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5180').replace(/\/$/, '');
  }

  private getPortalBaseUrl(): string {
    return (process.env.APP_PORTAL_URL || process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:5174').replace(/\/$/, '');
  }

  private buildLoginUrl(subdomain: string): string {
    return `${this.getPortalBaseUrl()}/login?tenant=${encodeURIComponent(subdomain)}`;
  }

  private assertNotDisposableEmail(email: string): void {
    const atIdx = email.lastIndexOf('@');
    if (atIdx <= 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A valid work email address is required.',
      });
    }
    const domain = email.slice(atIdx + 1).trim().toLowerCase();
    for (const blocked of DISPOSABLE_EMAIL_DOMAINS) {
      if (domain === blocked || domain.endsWith(`.${blocked}`)) {
        throw new BadRequestException({
          code: 'DISPOSABLE_EMAIL_NOT_ALLOWED',
          message: 'Disposable email addresses are not permitted. Please use your work email.',
        });
      }
    }
  }

  private assertPasswordComplexityIfNeeded(authMethod: PublicSignupAuthMethod, password?: string): void {
    if (authMethod === 'magic_link') return;

    if (!password || password.length < 8) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters long.',
      });
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    if (!hasLetter || !hasDigit) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: 'Password must include both letters and numbers.',
      });
    }
  }

  private enforcePerEmailRateLimit(email: string, now = Date.now()): void {
    const recent = (this.emailAttempts.get(email) ?? []).filter(
      (ts) => now - ts < PER_EMAIL_RATE_WINDOW_MS,
    );
    if (recent.length >= MAX_ATTEMPTS_PER_EMAIL_WINDOW) {
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many signup attempts for this email address. Please wait before trying again.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.emailAttempts.set(email, recent);
  }

  async checkSubdomainAvailability(
    rawSubdomain: string,
    ignoreEmail?: string,
    now = new Date(),
  ): Promise<PublicSubdomainAvailabilityResponse> {
    const subdomain = rawSubdomain.trim().toLowerCase();

    if (!SUBDOMAIN_REGEX.test(subdomain)) {
      return {
        subdomain,
        available: false,
        reason: 'invalid_format',
        message:
          'Subdomain must be 3-63 lowercase letters, numbers, or hyphens, starting and ending with a letter or number.',
      };
    }

    if (RESERVED_SUBDOMAINS.has(subdomain)) {
      return {
        subdomain,
        available: false,
        reason: 'reserved',
        message: `Subdomain "${subdomain}" is reserved and cannot be used.`,
      };
    }

    const existingTenant = await this.prisma.unscoped.tenant.findUnique({
      where: { subdomain },
      select: { id: true },
    });
    if (existingTenant) {
      return {
        subdomain,
        available: false,
        reason: 'taken',
        message: `Subdomain "${subdomain}" is already in use.`,
      };
    }

    const activePending = await this.prisma.unscoped.pendingSignup.findFirst({
      where: {
        desiredSubdomain: subdomain,
        status: {
          in: [
            PendingSignupStatus.pending,
            PendingSignupStatus.verified,
            PendingSignupStatus.provisioning,
          ],
        },
        expiresAt: { gt: now },
      },
      select: { id: true, workEmail: true },
    });

    if (activePending && (!ignoreEmail || activePending.workEmail !== ignoreEmail)) {
      return {
        subdomain,
        available: false,
        reason: 'taken',
        message: `Subdomain "${subdomain}" is currently held by another pending signup.`,
      };
    }

    return {
      subdomain,
      available: true,
      reason: null,
      message: `Subdomain "${subdomain}" is available.`,
    };
  }

  /**
   * Resolves country by ISO-2 / ISO-3 code (e.g. AU, AUS, BD, BGD) or slug/name.
   */
  private async resolveSignupCountry(countryInput: string): Promise<{ isoCode: string; name: string }> {
    const ISO2_TO_ISO3: Record<string, string> = {
      AU: 'AUS',
      BD: 'BGD',
      US: 'USA',
      GB: 'GBR',
      UK: 'GBR',
      CA: 'CAN',
      SG: 'SGP',
      IN: 'IND',
      MY: 'MYS',
      AE: 'ARE',
      DE: 'DEU',
      FR: 'FRA',
      NL: 'NLD',
      NZ: 'NZL',
    };

    const raw = countryInput.trim();
    const upper = raw.toUpperCase();
    const mappedIso3 = ISO2_TO_ISO3[upper] ?? upper;
    const slug = toSlug(raw);

    const countries = await this.prisma.unscoped.country.findMany({
      select: { isoCode: true, name: true },
    });

    const exact = countries.find(
      (c) =>
        c.isoCode.toUpperCase() === upper ||
        c.isoCode.toUpperCase() === mappedIso3 ||
        toSlug(c.name) === slug ||
        c.name.toUpperCase() === upper,
    );

    if (!exact) {
      throw new BadRequestException({
        code: 'INVALID_COUNTRY',
        message: `Unsupported or unrecognized country "${countryInput}". Please choose a supported country.`,
      });
    }

    return exact;
  }

  /**
   * Reads trial length in days from platform settings, defaulting to 14 days.
   */
  async resolveTrialLengthDays(): Promise<number> {
    const settings = await this.prisma.unscoped.platformSetting.findMany({
      where: {
        category: PlatformSettingCategory.billing,
        key: { in: ['trial', 'signup_trial', 'default'] },
      },
      select: { key: true, value: true },
    });

    const priorityOrder = ['trial', 'signup_trial', 'default'];
    for (const key of priorityOrder) {
      const row = settings.find((s) => s.key === key);
      const val = row?.value as Record<string, unknown> | null;
      if (val && typeof val.trialDays === 'number' && val.trialDays >= 0 && val.trialDays <= 365) {
        return Math.floor(val.trialDays);
      }
      if (val && typeof val.trialLengthDays === 'number' && val.trialLengthDays >= 0) {
        return Math.floor(val.trialLengthDays);
      }
    }

    return DEFAULT_TRIAL_DAYS;
  }

  /**
   * Reads live trial duration, payment-card requirement flag from PlatformSetting,
   * and included features/limits directly from the platform's public trial/starter plan.
   */
  async getTrialConfig(): Promise<PublicTrialConfigResponse> {
    const [trialDays, billingSettings, publicPlans] = await Promise.all([
      this.resolveTrialLengthDays(),
      this.prisma.unscoped.platformSetting.findMany({
        where: {
          category: PlatformSettingCategory.billing,
          key: { in: ['trial', 'signup_trial', 'default'] },
        },
        select: { key: true, value: true },
      }),
      this.publicPlansService
        ? this.publicPlansService.listPublicPlans()
        : Promise.resolve([]),
    ]);

    let requirePaymentCard = false;
    let termsVersion = '2026-11';
    for (const key of ['trial', 'signup_trial', 'default']) {
      const row = billingSettings.find((s) => s.key === key);
      const val = row?.value as Record<string, unknown> | null;
      if (val && typeof val.requirePaymentCardOnTrial === 'boolean') {
        requirePaymentCard = val.requirePaymentCardOnTrial;
        break;
      }
    }
    for (const key of ['trial', 'signup_trial', 'default']) {
      const row = billingSettings.find((s) => s.key === key);
      const val = row?.value as Record<string, unknown> | null;
      if (val && typeof val.termsVersion === 'string' && val.termsVersion.trim()) {
        termsVersion = val.termsVersion.trim();
        break;
      }
    }

    const trialPlan =
      publicPlans.find((p) => p.code === 'trial') ??
      publicPlans.find((p) => p.code === 'starter') ??
      publicPlans[0];

    return {
      trialDays,
      requirePaymentCard,
      termsVersion,
      planCode: trialPlan?.code ?? 'starter',
      planName: trialPlan?.name ?? 'Trial',
      planDescription:
        trialPlan?.description ??
        'Explore HR, attendance, and configurable payroll in a dedicated trial workspace.',
      features: trialPlan?.features ?? [],
      limits: trialPlan?.limits ?? [],
    };
  }

  async submitSignup(
    dto: PublicSignupDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PublicSignupAcceptedResponse> {
    if (!dto.acceptedTerms) {
      throw new BadRequestException({
        code: 'TERMS_NOT_ACCEPTED',
        message: 'You must accept the Terms of Service and Privacy Policy to continue.',
      });
    }

    await this.captchaService.verifyToken(dto.captchaToken, ipAddress);

    const normalizedEmail = dto.workEmail.trim().toLowerCase();
    const desiredSubdomain = dto.desiredSubdomain.trim().toLowerCase();
    const companyName = dto.companyName.trim();
    const companyNameNormalized = companyName.toLowerCase();
    const authMethod: PublicSignupAuthMethod =
      dto.authMethod === 'magic_link' ? 'magic_link' : 'password';

    this.assertNotDisposableEmail(normalizedEmail);
    this.assertPasswordComplexityIfNeeded(authMethod, dto.password);

    // Per-email anti-abuse limit applies even before non-disclosure branch so repeating spammers are throttled
    this.enforcePerEmailRateLimit(normalizedEmail);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SIGNUP_TTL_MS);

    // Lazy cleanup of stale unverified signups for cleanliness
    await this.cleanupExpiredSignups(now);

    // Check DB per-email attempts across restarts
    const dbRecentAttempts = await this.prisma.unscoped.pendingSignup.findFirst({
      where: {
        workEmail: normalizedEmail,
        status: PendingSignupStatus.pending,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (
      dbRecentAttempts &&
      now.getTime() - dbRecentAttempts.attemptWindowStart.getTime() < PER_EMAIL_RATE_WINDOW_MS &&
      dbRecentAttempts.attemptCount >= MAX_ATTEMPTS_PER_EMAIL_WINDOW
    ) {
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many signup attempts for this email address. Please wait before trying again.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 1. Check whether owner email (or company + owner email) already exists in provisioned users
    const existingRegisteredUser = await this.prisma.unscoped.user.findFirst({
      where: {
        email: normalizedEmail,
        isActive: true,
      },
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (existingRegisteredUser) {
      const existingTenant = existingRegisteredUser.tenantId
        ? await this.prisma.unscoped.tenant.findUnique({
            where: { id: existingRegisteredUser.tenantId },
            select: { name: true, subdomain: true, deletedAt: true },
          })
        : null;

      if (!existingTenant || !existingTenant.deletedAt) {
        const loginUrl = existingTenant?.subdomain
          ? this.buildLoginUrl(existingTenant.subdomain)
          : `${this.getPortalBaseUrl()}/login`;
        await this.dispatchAlreadyRegisteredEmail(
          normalizedEmail,
          existingTenant?.name ?? 'your existing CMSN-HR workspace',
          loginUrl,
        );

        await this.platformAudit.log({
          userId: null,
          action: 'public_signup.duplicate_email_suppressed',
          module: 'signup',
          recordId: existingRegisteredUser.tenantId ?? existingRegisteredUser.id,
          reason:
            'Public signup attempted for already-registered email; generic response returned without disclosure',
          newValue: {
            desiredSubdomain,
            companyName,
            emailDomain: normalizedEmail.split('@')[1] ?? '',
          },
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        });

        return { ...GENERIC_ACCEPTED_RESPONSE };
      }
    }

    // 2. Check subdomain uniqueness and reserved list
    const subdomainCheck = await this.checkSubdomainAvailability(
      desiredSubdomain,
      normalizedEmail,
      now,
    );
    if (!subdomainCheck.available) {
      if (subdomainCheck.reason === 'taken') {
        throw new ConflictException({
          code: 'SUBDOMAIN_TAKEN',
          message: subdomainCheck.message,
        });
      }
      throw new BadRequestException({
        code: 'INVALID_SUBDOMAIN',
        message: subdomainCheck.message,
      });
    }

    // 3. Resolve country & hash password
    const country = await this.resolveSignupCountry(dto.country);
    const { firstName, lastName } = splitOwnerName(dto.ownerName);
    const passwordHash =
      authMethod === 'password' && dto.password ? await bcrypt.hash(dto.password, 10) : null;

    const rawVerificationToken = randomBytes(32).toString('hex');
    const verificationTokenHash = hashToken(rawVerificationToken);

    const marketingConsent = Boolean(dto.marketingConsent);
    const allowAttribution = marketingConsent || Boolean(dto.attributionConsent);
    const utmData = allowAttribution
      ? {
          utmSource: dto.utmSource?.trim() || null,
          utmMedium: dto.utmMedium?.trim() || null,
          utmCampaign: dto.utmCampaign?.trim() || null,
          utmTerm: dto.utmTerm?.trim() || null,
          utmContent: dto.utmContent?.trim() || null,
          referrer: dto.referrer?.trim() || null,
        }
      : {
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmTerm: null,
          utmContent: null,
          referrer: null,
        };

    // 4. Refresh existing pending signup (company + email / work email) OR create new pending record
    if (dbRecentAttempts) {
      const withinWindow =
        now.getTime() - dbRecentAttempts.attemptWindowStart.getTime() < PER_EMAIL_RATE_WINDOW_MS;

      await this.prisma.unscoped.pendingSignup.update({
        where: { id: dbRecentAttempts.id },
        data: {
          companyName,
          companyNameNormalized,
          countryCode: country.isoCode,
          ownerName: dto.ownerName.trim(),
          ownerFirstName: firstName,
          ownerLastName: lastName,
          authMethod,
          passwordHash,
          desiredSubdomain,
          termsVersion: dto.termsVersion.trim(),
          termsAcceptedAt: now,
          verificationTokenHash,
          expiresAt,
          lastAttemptAt: now,
          attemptWindowStart: withinWindow ? dbRecentAttempts.attemptWindowStart : now,
          attemptCount: withinWindow ? dbRecentAttempts.attemptCount + 1 : 1,
          ipAddress: ipAddress ?? null,
          marketingConsent,
          ...utmData,
        },
      });

      await this.dispatchVerificationEmail(
        normalizedEmail,
        companyName,
        desiredSubdomain,
        rawVerificationToken,
      );

      await this.platformAudit.log({
        userId: null,
        action: 'public_signup.verification_resent',
        module: 'signup',
        recordId: dbRecentAttempts.id,
        reason: 'Refreshed verification token for unverified public signup',
        newValue: {
          companyName,
          desiredSubdomain,
          countryCode: country.isoCode,
          termsVersion: dto.termsVersion.trim(),
          marketingConsent,
        },
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      });

      return { ...GENERIC_ACCEPTED_RESPONSE };
    }

    const created = await this.prisma.unscoped.pendingSignup.create({
      data: {
        companyName,
        companyNameNormalized,
        countryCode: country.isoCode,
        workEmail: normalizedEmail,
        ownerName: dto.ownerName.trim(),
        ownerFirstName: firstName,
        ownerLastName: lastName,
        authMethod,
        passwordHash,
        desiredSubdomain,
        termsVersion: dto.termsVersion.trim(),
        termsAcceptedAt: now,
        verificationTokenHash,
        attemptCount: 1,
        attemptWindowStart: now,
        lastAttemptAt: now,
        ipAddress: ipAddress ?? null,
        marketingConsent,
        ...utmData,
        status: PendingSignupStatus.pending,
        expiresAt,
      },
    });

    await this.dispatchVerificationEmail(
      normalizedEmail,
      companyName,
      desiredSubdomain,
      rawVerificationToken,
    );

    await this.platformAudit.log({
      userId: null,
      action: 'public_signup.requested',
      module: 'signup',
      recordId: created.id,
      reason: 'Public self-service signup initiated; awaiting email verification',
      newValue: {
        companyName,
        desiredSubdomain,
        countryCode: country.isoCode,
        authMethod,
        termsVersion: created.termsVersion,
        termsAcceptedAt: created.termsAcceptedAt.toISOString(),
        marketingConsent: created.marketingConsent,
        ...(marketingConsent ? utmData : {}),
      },
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });

    return { ...GENERIC_ACCEPTED_RESPONSE };
  }

  async verifyAndProvision(
    rawToken: string,
    ipAddress?: string,
    userAgent?: string,
    asyncMode = false,
  ): Promise<PublicSignupVerificationResponse> {
    const trimmed = rawToken?.trim();
    if (!trimmed) {
      throw new BadRequestException({
        code: 'TOKEN_INVALID',
        message: 'Verification token is required.',
      });
    }

    const tokenDigest = hashToken(trimmed);
    const pending = await this.prisma.unscoped.pendingSignup.findUnique({
      where: { verificationTokenHash: tokenDigest },
    });

    if (!pending) {
      throw new BadRequestException({
        code: 'TOKEN_INVALID',
        message: 'This verification link is invalid or has already expired.',
      });
    }

    if (
      pending.status === PendingSignupStatus.provisioned &&
      pending.provisionedTenantId &&
      pending.loginUrl
    ) {
      return {
        status: 'provisioned',
        tenantId: pending.provisionedTenantId,
        subdomain: pending.desiredSubdomain,
        loginUrl: pending.loginUrl,
        authMethod: pending.authMethod as PublicSignupAuthMethod,
        message: 'Your workspace is ready. You can log in now.',
      };
    }

    if (pending.status === PendingSignupStatus.provisioning && asyncMode) {
      return {
        status: 'provisioning',
        subdomain: pending.desiredSubdomain,
        authMethod: pending.authMethod as PublicSignupAuthMethod,
        message: 'Workspace setup is already in progress.',
      };
    }

    const now = new Date();
    if (pending.status === PendingSignupStatus.expired || pending.expiresAt <= now) {
      await this.prisma.unscoped.pendingSignup.update({
        where: { id: pending.id },
        data: { status: PendingSignupStatus.expired, passwordHash: null },
      });
      throw new BadRequestException({
        code: 'TOKEN_EXPIRED',
        message: 'Your verification link expired after 24 hours. Please start a new signup.',
      });
    }

    // Double-check subdomain uniqueness before provisioning
    const existingTenant = await this.prisma.unscoped.tenant.findUnique({
      where: { subdomain: pending.desiredSubdomain },
      select: { id: true },
    });
    if (existingTenant) {
      await this.prisma.unscoped.pendingSignup.update({
        where: { id: pending.id },
        data: {
          status: PendingSignupStatus.failed,
          failureReason: 'Subdomain was claimed before verification completed.',
        },
      });
      throw new ConflictException({
        code: 'SUBDOMAIN_TAKEN',
        message: `Subdomain "${pending.desiredSubdomain}" is no longer available. Please sign up with a different subdomain.`,
      });
    }

    const trialDays = await this.resolveTrialLengthDays();

    await this.prisma.unscoped.pendingSignup.update({
      where: { id: pending.id },
      data: {
        status: PendingSignupStatus.provisioning,
        verifiedAt: pending.verifiedAt ?? now,
        failureReason: null,
      },
    });

    if (asyncMode) {
      setImmediate(() => {
        void this.executeProvisioningJob(pending, trialDays, now, ipAddress, userAgent).catch(() => {
          // Failure state, audit entry, and staff incident alert are recorded inside executeProvisioningJob
        });
      });

      return {
        status: 'provisioning',
        subdomain: pending.desiredSubdomain,
        trialDays,
        authMethod: pending.authMethod as PublicSignupAuthMethod,
        message: 'Email verified. Setting up your workspace...',
      };
    }

    return this.executeProvisioningJob(pending, trialDays, now, ipAddress, userAgent);
  }

  private async executeProvisioningJob(
    pending: any,
    trialDays: number,
    now: Date,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PublicSignupVerificationResponse> {
    const magicFallbackHash = pending.passwordHash
      ? undefined
      : await bcrypt.hash(randomBytes(32).toString('hex'), 10);

    try {
      const provisioned = await this.lifecycleQueue.enqueueProvisioning({
        name: pending.companyName,
        subdomain: pending.desiredSubdomain,
        planId: 'trial',
        trialDays,
        countryCode: pending.countryCode,
        ownerEmail: pending.workEmail,
        ownerFirstName: pending.ownerFirstName,
        ownerLastName: pending.ownerLastName,
        reason: `Public self-service signup verified (terms ${pending.termsVersion})`,
        ownerPasswordHash: pending.passwordHash ?? magicFallbackHash,
        mustChangePassword: false,
      });

      const loginUrl = this.buildLoginUrl(provisioned.subdomain);
      const trialEndsAt =
        trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString() : null;

      await this.prisma.unscoped.pendingSignup.update({
        where: { id: pending.id },
        data: {
          status: PendingSignupStatus.provisioned,
          verifiedAt: pending.verifiedAt ?? now,
          provisionedTenantId: provisioned.tenantId,
          loginUrl,
          passwordHash: null,
          failureReason: null,
        },
      });

      await this.platformAudit.log({
        userId: null,
        action: 'public_signup.verified_and_provisioned',
        module: 'signup',
        recordId: provisioned.tenantId,
        tenantId: provisioned.tenantId,
        reason: 'Verified email and provisioned trial workspace',
        newValue: {
          pendingSignupId: pending.id,
          tenantId: provisioned.tenantId,
          subdomain: provisioned.subdomain,
          countryCode: pending.countryCode,
          trialDays,
          termsVersion: pending.termsVersion,
          termsAcceptedAt: pending.termsAcceptedAt.toISOString(),
          marketingConsent: pending.marketingConsent,
          utmSource: pending.utmSource ?? null,
          utmMedium: pending.utmMedium ?? null,
          utmCampaign: pending.utmCampaign ?? null,
          referrer: pending.referrer ?? null,
        },
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      });

      return {
        status: 'provisioned',
        tenantId: provisioned.tenantId,
        subdomain: provisioned.subdomain,
        loginUrl,
        trialDays,
        trialEndsAt,
        authMethod: pending.authMethod as PublicSignupAuthMethod,
        message: 'Email verified and workspace provisioned successfully.',
      };
    } catch (err: any) {
      const errorMsg = err?.message || 'Tenant provisioning job failed';
      this.logger.error(
        `[SIGNUP_PROVISIONING_ALERT] Pending signup ${pending.id} (${pending.desiredSubdomain}) failed provisioning: ${errorMsg}`,
      );

      // Keep signup record safely (do NOT erase passwordHash/company details so retry succeeds)
      await this.prisma.unscoped.pendingSignup.update({
        where: { id: pending.id },
        data: {
          status: PendingSignupStatus.failed,
          failureReason: errorMsg,
        },
      });

      // Raise a real platform staff incident alert
      await this.prisma.unscoped.platformIncident
        ?.create?.({
          data: {
            incidentNumber: `INC-SIGNUP-${Date.now()}-${randomBytes(2).toString('hex').toUpperCase()}`,
            title: `Self-service tenant provisioning failed for "${pending.desiredSubdomain}"`,
            subsystem: 'signup',
            severity: 'major',
            status: 'investigating',
            impact: `Verified signup ${pending.id} could not complete automated workspace provisioning and requires review or retry.`,
            rootCause: errorMsg,
            updates: [
              {
                timestamp: new Date().toISOString(),
                status: 'investigating',
                message: `Automated alert raised when provisioning pending signup ${pending.id}: ${errorMsg}`,
              },
            ],
            metadata: {
              pendingSignupId: pending.id,
              desiredSubdomain: pending.desiredSubdomain,
              countryCode: pending.countryCode,
            },
            createdBy: 'system:public-signup',
          },
        })
        .catch((incErr: any) => {
          this.logger.warn(`Failed to persist PlatformIncident for signup alert: ${incErr?.message}`);
        });

      await this.platformAudit.log({
        userId: null,
        action: 'public_signup.provisioning_failed',
        module: 'signup',
        recordId: pending.id,
        reason: `Provisioning failed after signup verification: ${errorMsg}`,
        newValue: {
          pendingSignupId: pending.id,
          desiredSubdomain: pending.desiredSubdomain,
          countryCode: pending.countryCode,
          alertRaised: true,
        },
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      });

      throw new InternalServerErrorException({
        code: 'PROVISIONING_FAILED',
        message:
          'We verified your email, but workspace setup encountered an unexpected error. Our platform team has been alerted and your signup details were preserved.',
      });
    }
  }

  async getVerificationStatus(rawToken: string): Promise<PublicSignupVerificationResponse> {
    const trimmed = rawToken?.trim();
    if (!trimmed) {
      throw new BadRequestException({
        code: 'TOKEN_INVALID',
        message: 'Verification token is required.',
      });
    }

    const pending = await this.prisma.unscoped.pendingSignup.findUnique({
      where: { verificationTokenHash: hashToken(trimmed) },
      select: {
        status: true,
        provisionedTenantId: true,
        desiredSubdomain: true,
        loginUrl: true,
        authMethod: true,
        expiresAt: true,
      },
    });

    if (!pending) {
      throw new BadRequestException({
        code: 'TOKEN_INVALID',
        message: 'Verification status not found or expired.',
      });
    }

    if (pending.status === PendingSignupStatus.provisioned && pending.loginUrl) {
      return {
        status: 'provisioned',
        tenantId: pending.provisionedTenantId ?? undefined,
        subdomain: pending.desiredSubdomain,
        loginUrl: pending.loginUrl,
        authMethod: pending.authMethod as PublicSignupAuthMethod,
        message: 'Workspace provisioned and ready for login.',
      };
    }

    if (pending.status === PendingSignupStatus.failed) {
      return {
        status: 'failed',
        subdomain: pending.desiredSubdomain,
        authMethod: pending.authMethod as PublicSignupAuthMethod,
        message:
          'Workspace setup hit a temporary issue. Your signup details are saved and platform support has been alerted.',
      };
    }

    return {
      status: 'provisioning',
      subdomain: pending.desiredSubdomain,
      authMethod: pending.authMethod as PublicSignupAuthMethod,
      message: 'Workspace setup is currently in progress.',
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSignups(now = new Date()): Promise<{ cleanedCount: number }> {
    const expired = await this.prisma.unscoped.pendingSignup.deleteMany({
      where: {
        status: PendingSignupStatus.pending,
        expiresAt: { lte: now },
      },
    });

    if (expired.count > 0) {
      this.logger.log(`Cleaned up ${expired.count} expired unverified public signup(s).`);
      await this.platformAudit
        .log({
          userId: null,
          action: 'public_signup.expired_cleaned',
          module: 'signup',
          reason: `Purged ${expired.count} unverified public signups past 24-hour expiration`,
          newValue: { cleanedCount: expired.count },
        })
        .catch(() => {});
    }

    return { cleanedCount: expired.count };
  }

  private async trySendPlatformEmail(to: string, subject: string, text: string, html: string): Promise<void> {
    try {
      const row = await this.prisma.unscoped.platformSetting.findUnique({
        where: {
          category_key: {
            category: PlatformSettingCategory.email,
            key: 'default',
          },
        },
        select: { value: true },
      });

      const cfg = row?.value as
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

      if (!cfg?.host || !cfg?.fromAddress) {
        this.logger.log(`[SIGNUP_EMAIL_SIMULATED] to=${to} subject="${subject}"`);
        return;
      }

      const password = cfg.passwordEnc ? this.fieldEncryption.decrypt(cfg.passwordEnc) : '';
      await this.mailService.sendMail({
        settings: {
          host: cfg.host,
          port: cfg.port ?? 587,
          useTls: Boolean(cfg.secure),
          username: cfg.username ?? '',
          password,
          fromAddress: cfg.fromAddress,
          fromName: cfg.fromName ?? 'CMSN-HR',
        },
        to,
        subject,
        text,
        html,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to deliver signup email via SMTP (${err?.message ?? 'unknown'})`);
    }
  }

  private async dispatchVerificationEmail(
    to: string,
    companyName: string,
    subdomain: string,
    rawToken: string,
  ): Promise<void> {
    const verifyUrl = `${this.getWebsiteBaseUrl()}/signup/verify?token=${encodeURIComponent(rawToken)}`;
    const safeSubjectCompany = stripHeaderInjection(companyName);
    const subject = `Verify your email to launch ${safeSubjectCompany} on CMSN-HR`;
    const text = [
      `Hello,`,
      ``,
      `Click the verification link below to finish setting up your ${safeSubjectCompany} (${subdomain}) workspace:`,
      verifyUrl,
      ``,
      `This link expires in ${SIGNUP_TTL_HOURS} hours.`,
    ].join('\n');

    const html = `<p>Hello,</p>
<p>Click below to verify your email and finish provisioning <strong>${escapeHtml(companyName)}</strong> (<code>${escapeHtml(subdomain)}</code>):</p>
<p><a href="${escapeHtml(verifyUrl)}">${escapeHtml(verifyUrl)}</a></p>
<p>This link expires in ${SIGNUP_TTL_HOURS} hours.</p>`;

    await this.trySendPlatformEmail(to, subject, text, html);
  }

  private async dispatchAlreadyRegisteredEmail(
    to: string,
    existingTenantName: string,
    loginUrl: string,
  ): Promise<void> {
    const subject = `Your CMSN-HR workspace sign-in details`;
    const safeTenantText = stripHeaderInjection(existingTenantName);
    const text = [
      `Hello,`,
      ``,
      `Someone recently requested a new CMSN-HR signup using this email address, which is already associated with "${safeTenantText}".`,
      ``,
      `You can log in to your existing workspace here:`,
      loginUrl,
    ].join('\n');

    const html = `<p>Hello,</p>
<p>Someone recently requested a new CMSN-HR signup using this email address, which is already linked to <strong>${escapeHtml(existingTenantName)}</strong>.</p>
<p>Sign in to your existing workspace here: <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>`;

    await this.trySendPlatformEmail(to, subject, text, html);
  }
}
