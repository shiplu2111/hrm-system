import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type {
  ApiResponse as ApiEnvelope,
  PlatformAllSettingsView,
  PlatformBillingSettings,
  PlatformEmailSettings,
  PlatformPushSettings,
  PlatformSmsSettings,
  PlatformStorageSettings,
  TestBillingResult,
  TestEmailResult,
  TestPushResult,
  TestSmsResult,
  TestStorageResult,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformSettingsService } from './platform-settings.service';
import {
  SendTestEmailDto,
  SendTestSmsDto,
  UpdatePlatformBillingSettingsDto,
  UpdatePlatformEmailSettingsDto,
  UpdatePlatformPushSettingsDto,
  UpdatePlatformSmsSettingsDto,
  UpdatePlatformStorageSettingsDto,
} from './dto/platform-settings.dto';

interface PlatformStaffRequestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  roleName: string;
  permissions: Array<{ module: string; action: string }>;
}

@ApiTags('platform-settings')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/settings')
export class PlatformSettingsController {
  constructor(private readonly settingsService: PlatformSettingsService) {}

  /**
   * Enforces strict role-gating: only Platform Owner and Platform Admin
   * can view and edit platform operational settings and encrypted credentials.
   */
  private assertPlatformAdminOrOwner(req: Request): PlatformStaffRequestUser {
    const user = ((req as any).platformUser || (req as any).user) as PlatformStaffRequestUser;
    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Platform authentication required',
      });
    }

    if (user.roleName !== 'Platform Owner' && user.roleName !== 'Platform Admin') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Platform settings are restricted to Platform Owner and Platform Admin',
      });
    }

    return user;
  }

  private extractMeta(req: Request) {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  // ==========================================================================
  // Aggregate
  // ==========================================================================

  @Get()
  @RequirePlatformPermission('setting', 'view')
  @ApiOperation({ summary: 'Get all platform operational settings (secrets masked)' })
  async getAllSettings(@Req() req: Request): Promise<ApiEnvelope<PlatformAllSettingsView>> {
    this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.getAllSettings();
    return { data };
  }

  // ==========================================================================
  // 1. Email
  // ==========================================================================

  @Get('email')
  @RequirePlatformPermission('setting', 'view')
  @ApiOperation({ summary: 'Get platform default email/SMTP settings (password masked)' })
  async getEmailSettings(@Req() req: Request): Promise<ApiEnvelope<PlatformEmailSettings>> {
    this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.getEmailSettings();
    return { data };
  }

  @Patch('email')
  @RequirePlatformPermission('setting', 'manage')
  @ApiOperation({ summary: 'Update platform default email/SMTP settings (Replace secret semantics)' })
  async updateEmailSettings(
    @Req() req: Request,
    @Body() dto: UpdatePlatformEmailSettingsDto,
  ): Promise<ApiEnvelope<PlatformEmailSettings>> {
    const user = this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.updateEmailSettings(dto, user.id, this.extractMeta(req));
    return { data };
  }

  @Post('email/test')
  @RequirePlatformPermission('setting', 'manage')
  @ApiOperation({ summary: 'Send test email via platform configured SMTP provider' })
  async sendTestEmail(
    @Req() req: Request,
    @Body() dto: SendTestEmailDto,
  ): Promise<ApiEnvelope<TestEmailResult>> {
    this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.sendTestEmail(dto);
    return { data };
  }

  // ==========================================================================
  // 2. SMS
  // ==========================================================================

  @Get('sms')
  @RequirePlatformPermission('setting', 'view')
  @ApiOperation({ summary: 'Get platform default SMS settings (auth token masked)' })
  async getSmsSettings(@Req() req: Request): Promise<ApiEnvelope<PlatformSmsSettings>> {
    this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.getSmsSettings();
    return { data };
  }

  @Patch('sms')
  @RequirePlatformPermission('setting', 'manage')
  @ApiOperation({ summary: 'Update platform default SMS settings (Replace secret semantics)' })
  async updateSmsSettings(
    @Req() req: Request,
    @Body() dto: UpdatePlatformSmsSettingsDto,
  ): Promise<ApiEnvelope<PlatformSmsSettings>> {
    const user = this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.updateSmsSettings(dto, user.id, this.extractMeta(req));
    return { data };
  }

  @Post('sms/test')
  @RequirePlatformPermission('setting', 'manage')
  @ApiOperation({ summary: 'Send test SMS via platform configured SMS provider' })
  async sendTestSms(
    @Req() req: Request,
    @Body() dto: SendTestSmsDto,
  ): Promise<ApiEnvelope<TestSmsResult>> {
    this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.sendTestSms(dto);
    return { data };
  }

  // ==========================================================================
  // 3. Push
  // ==========================================================================

  @Get('push')
  @RequirePlatformPermission('setting', 'view')
  @ApiOperation({ summary: 'Get platform Firebase push notification settings (private key masked)' })
  async getPushSettings(@Req() req: Request): Promise<ApiEnvelope<PlatformPushSettings>> {
    this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.getPushSettings();
    return { data };
  }

  @Patch('push')
  @RequirePlatformPermission('setting', 'manage')
  @ApiOperation({ summary: 'Update platform Firebase push notification settings' })
  async updatePushSettings(
    @Req() req: Request,
    @Body() dto: UpdatePlatformPushSettingsDto,
  ): Promise<ApiEnvelope<PlatformPushSettings>> {
    const user = this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.updatePushSettings(dto, user.id, this.extractMeta(req));
    return { data };
  }

  @Post('push/test')
  @RequirePlatformPermission('setting', 'manage')
  @ApiOperation({ summary: 'Verify platform Firebase push credentials connection' })
  async testPushConnection(@Req() req: Request): Promise<ApiEnvelope<TestPushResult>> {
    this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.testPushConnection();
    return { data };
  }

  // ==========================================================================
  // 4. Storage
  // ==========================================================================

  @Get('storage')
  @RequirePlatformPermission('setting', 'view')
  @ApiOperation({ summary: 'Get platform default storage driver settings (S3 secret key masked)' })
  async getStorageSettings(@Req() req: Request): Promise<ApiEnvelope<PlatformStorageSettings>> {
    this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.getStorageSettings();
    return { data };
  }

  @Patch('storage')
  @RequirePlatformPermission('setting', 'manage')
  @ApiOperation({ summary: 'Update platform default storage driver settings' })
  async updateStorageSettings(
    @Req() req: Request,
    @Body() dto: UpdatePlatformStorageSettingsDto,
  ): Promise<ApiEnvelope<PlatformStorageSettings>> {
    const user = this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.updateStorageSettings(dto, user.id, this.extractMeta(req));
    return { data };
  }

  @Post('storage/test')
  @RequirePlatformPermission('setting', 'manage')
  @ApiOperation({ summary: 'Test platform storage driver connection and read/write probe' })
  async testStorageConnection(@Req() req: Request): Promise<ApiEnvelope<TestStorageResult>> {
    this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.testStorageConnection();
    return { data };
  }

  // ==========================================================================
  // 5. Billing
  // ==========================================================================

  @Get('billing')
  @RequirePlatformPermission('setting', 'view')
  @ApiOperation({ summary: 'Get platform Stripe billing settings (secrets masked)' })
  async getBillingSettings(@Req() req: Request): Promise<ApiEnvelope<PlatformBillingSettings>> {
    this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.getBillingSettings();
    return { data };
  }

  @Patch('billing')
  @RequirePlatformPermission('setting', 'manage')
  @ApiOperation({ summary: 'Update platform Stripe billing settings (Replace secret semantics)' })
  async updateBillingSettings(
    @Req() req: Request,
    @Body() dto: UpdatePlatformBillingSettingsDto,
  ): Promise<ApiEnvelope<PlatformBillingSettings>> {
    const user = this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.updateBillingSettings(dto, user.id, this.extractMeta(req));
    return { data };
  }

  @Post('billing/test')
  @RequirePlatformPermission('setting', 'manage')
  @ApiOperation({ summary: 'Verify Stripe API credentials and mode' })
  async testBillingConnection(@Req() req: Request): Promise<ApiEnvelope<TestBillingResult>> {
    this.assertPlatformAdminOrOwner(req);
    const data = await this.settingsService.testBillingConnection();
    return { data };
  }
}
