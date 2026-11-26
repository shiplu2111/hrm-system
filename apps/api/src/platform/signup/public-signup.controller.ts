import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  ApiResponse as ApiEnvelope,
  PublicCaptchaChallengeResponse,
  PublicSignupAcceptedResponse,
  PublicSignupVerificationResponse,
  PublicSubdomainAvailabilityResponse,
  PublicTrialConfigResponse,
} from '@hrm/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import {
  CheckSubdomainQueryDto,
  PublicSignupDto,
  VerifySignupDto,
} from './dto/public-signup.dto';
import { PublicCaptchaService } from './public-captcha.service';
import { PublicSignupService } from './public-signup.service';

@ApiTags('public-signup')
@SkipTenantScope()
@Public()
@Controller('public/signup')
export class PublicSignupController {
  constructor(
    private readonly signupService: PublicSignupService,
    private readonly captchaService: PublicCaptchaService,
  ) {}

  @Get('config')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=30, s-maxage=30')
  @ApiOperation({ summary: 'Get trial configuration, trial plan inclusions, and card requirement setting' })
  @ApiResponse({ status: 200, description: 'Trial configuration retrieved successfully' })
  async getTrialConfig(): Promise<ApiEnvelope<PublicTrialConfigResponse>> {
    const data = await this.signupService.getTrialConfig();
    return { data };
  }

  @Get('captcha')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Issue an accessible human-verification challenge for public signup' })
  @ApiResponse({ status: 200, description: 'Challenge issued successfully' })
  issueCaptchaChallenge(): ApiEnvelope<PublicCaptchaChallengeResponse> {
    return {
      data: this.captchaService.issueChallenge(),
    };
  }

  @Get('check-subdomain')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Check whether a workspace subdomain is available and non-reserved' })
  @ApiResponse({ status: 200, description: 'Availability result returned' })
  async checkSubdomain(
    @Query() query: CheckSubdomainQueryDto,
  ): Promise<ApiEnvelope<PublicSubdomainAvailabilityResponse>> {
    const data = await this.signupService.checkSubdomainAvailability(query.subdomain);
    return { data };
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Submit public self-service workspace signup',
    description:
      'Rate-limited and CAPTCHA-protected signup. Sends verification email before provisioning and returns an identical non-disclosing payload regardless of whether the email already exists.',
  })
  @ApiResponse({ status: 202, description: 'Signup accepted; verification instructions sent' })
  @ApiResponse({ status: 400, description: 'Validation, CAPTCHA, or disposable email rejection' })
  @ApiResponse({ status: 409, description: 'Desired subdomain is already taken' })
  @ApiResponse({ status: 429, description: 'Per-IP or per-email rate limit exceeded' })
  async submitSignup(
    @Body() dto: PublicSignupDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PublicSignupAcceptedResponse>> {
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || undefined;
    const userAgent = req?.headers?.['user-agent'] || undefined;
    const data = await this.signupService.submitSignup(dto, ipAddress, userAgent);
    return { data };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify signup email token and trigger workspace provisioning' })
  @ApiResponse({ status: 200, description: 'Workspace provisioned and login URL returned' })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification token' })
  async verifySignup(
    @Body() dto: VerifySignupDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PublicSignupVerificationResponse>> {
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || undefined;
    const userAgent = req?.headers?.['user-agent'] || undefined;
    const data = await this.signupService.verifyAndProvision(
      dto.token,
      ipAddress,
      userAgent,
      Boolean(dto.async),
    );
    return { data };
  }

  @Get('status')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Poll signup verification / provisioning status by token' })
  async getVerificationStatus(
    @Query('token') token: string,
  ): Promise<ApiEnvelope<PublicSignupVerificationResponse>> {
    const data = await this.signupService.getVerificationStatus(token);
    return { data };
  }
}
