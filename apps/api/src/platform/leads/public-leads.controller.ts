import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  ApiResponse as ApiEnvelope,
  PublicCaptchaChallengeResponse,
  PublicLeadSubmissionResponse,
} from '@hrm/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PublicCaptchaService } from '../signup/public-captcha.service';
import {
  BaseLeadSubmissionDto,
  PublicContactMessageDto,
  PublicDemoRequestDto,
} from './dto/public-leads.dto';
import { PublicLeadsService } from './public-leads.service';

@ApiTags('public-leads')
@SkipTenantScope()
@Public()
@Controller('public')
export class PublicLeadsController {
  constructor(
    private readonly leadsService: PublicLeadsService,
    private readonly captchaService: PublicCaptchaService,
  ) {}

  @Get('leads/captcha')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Issue human-verification CAPTCHA challenge for demo and contact forms' })
  issueCaptcha(): ApiEnvelope<PublicCaptchaChallengeResponse> {
    return {
      data: this.captchaService.issueChallenge(),
    };
  }

  @Post('leads')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Submit a general marketing lead with CAPTCHA, honeypot, and consent' })
  @ApiResponse({ status: 202, description: 'Lead accepted (or bot silently discarded)' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async submitLead(
    @Body() dto: BaseLeadSubmissionDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PublicLeadSubmissionResponse>> {
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || undefined;
    const data = await this.leadsService.submitLead(dto, ipAddress);
    return { data };
  }

  @Post('leads/demo')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Submit a Book a Demo request with CAPTCHA, honeypot, and consent' })
  @ApiResponse({ status: 202, description: 'Demo request accepted (or bot silently discarded)' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async submitDemoRequest(
    @Body() dto: PublicDemoRequestDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PublicLeadSubmissionResponse>> {
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || undefined;
    const data = await this.leadsService.submitDemoRequest(dto, ipAddress);
    return { data };
  }

  @Post('leads/contact')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Submit a Contact Sales / Contact Us inquiry' })
  @ApiResponse({ status: 202, description: 'Contact message accepted (or bot silently discarded)' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async submitLeadContact(
    @Body() dto: PublicContactMessageDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PublicLeadSubmissionResponse>> {
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || undefined;
    const data = await this.leadsService.submitContactMessage(dto, ipAddress);
    return { data };
  }

  @Post('contact')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Alias for submitting a Contact Sales / Contact Us inquiry' })
  async submitContactAlias(
    @Body() dto: PublicContactMessageDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PublicLeadSubmissionResponse>> {
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || undefined;
    const data = await this.leadsService.submitContactMessage(dto, ipAddress);
    return { data };
  }
}
