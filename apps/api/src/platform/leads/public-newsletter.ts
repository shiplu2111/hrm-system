import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Injectable,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type {
  ApiResponse as ApiEnvelope,
  PublicNewsletterSubscribeResponse,
} from '@hrm/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { NoScriptInjection } from '../../common/validators/no-script.validator';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';

export class PublicNewsletterSubscribeDto {
  @ApiProperty({ example: 'alex@acme-corp.com' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(160)
  email!: string;

  @ApiPropertyOptional({ default: 'blog', example: 'blog' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @NoScriptInjection()
  channel?: string;

  @ApiProperty({ description: 'Explicit opt-in consent checkbox state' })
  @IsBoolean()
  consentGranted!: boolean;

  @ApiProperty({ description: 'Exact consent notice text accepted by the subscriber' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @NoScriptInjection()
  consentText!: string;

  @ApiPropertyOptional({ default: '2026-11' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  consentVersion?: string;

  @ApiPropertyOptional({ example: '/blog' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourcePage?: string;

  @ApiPropertyOptional({ description: 'Honeypot anti-bot field' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

const GENERIC_SUB_RESPONSE: PublicNewsletterSubscribeResponse = {
  accepted: true,
  message: 'Thank you for subscribing. Your email consent has been recorded.',
};

@Injectable()
export class PublicNewsletterService {
  private readonly logger = new Logger(PublicNewsletterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  async subscribe(
    dto: PublicNewsletterSubscribeDto,
    ipAddress?: string,
  ): Promise<PublicNewsletterSubscribeResponse> {
    if (dto.website && dto.website.trim().length > 0) {
      this.logger.debug('Honeypot triggered on newsletter subscribe — silently ignored.');
      return { ...GENERIC_SUB_RESPONSE };
    }

    if (!dto.consentGranted) {
      throw new BadRequestException({
        code: 'CONSENT_REQUIRED',
        message: 'Explicit email consent is required before subscribing.',
      });
    }

    const email = dto.email.trim().toLowerCase();
    const channel = (dto.channel?.trim().toLowerCase() || 'blog').replace(/[^a-z0-9_-]/g, '');
    const now = new Date();

    const row = await this.prisma.unscoped.emailSubscription.upsert({
      where: {
        email_channel: {
          email,
          channel,
        },
      },
      create: {
        email,
        channel,
        consentGranted: true,
        consentText: dto.consentText.trim(),
        consentVersion: dto.consentVersion?.trim() || '2026-11',
        consentAt: now,
        sourcePage: dto.sourcePage?.trim() || null,
        ipAddress: ipAddress || null,
      },
      update: {
        consentGranted: true,
        consentText: dto.consentText.trim(),
        consentVersion: dto.consentVersion?.trim() || '2026-11',
        consentAt: now,
        sourcePage: dto.sourcePage?.trim() || null,
        ipAddress: ipAddress || null,
        unsubscribedAt: null,
      },
    });

    await this.platformAudit.log({
      userId: null,
      action: 'public_newsletter.subscribed',
      module: 'marketing',
      recordId: row.id,
      reason: `Recorded consented email subscription on ${channel}`,
      newValue: {
        channel,
        emailDomain: email.split('@')[1] ?? '',
        consentVersion: row.consentVersion,
      },
    });

    return { ...GENERIC_SUB_RESPONSE };
  }
}

@ApiTags('public-newsletter')
@SkipTenantScope()
@Public()
@Controller('public/newsletter')
export class PublicNewsletterController {
  constructor(private readonly newsletterService: PublicNewsletterService) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Subscribe email to website blog/updates with explicit consent storage' })
  @ApiResponse({ status: 202, description: 'Subscription stored with consent timestamp' })
  async subscribe(
    @Body() dto: PublicNewsletterSubscribeDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PublicNewsletterSubscribeResponse>> {
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || undefined;
    const data = await this.newsletterService.subscribe(dto, ipAddress);
    return { data };
  }
}
