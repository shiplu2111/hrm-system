import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  SendSmtpTestEmailDto,
  UpdateSmtpSettingsDto,
} from './dto/smtp-settings.dto';
import { MailService } from './mail.service';
import { SmtpSettingsService } from './smtp-settings.service';
import { CompanyScopeService } from '../organization/company-scope.service';

@ApiTags('settings')
@ApiBearerAuth('access-token')
@Controller('organization/companies/:companyId/settings/smtp')
export class SmtpSettingsController {
  constructor(
    private readonly smtpSettingsService: SmtpSettingsService,
    private readonly mailService: MailService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({
    summary: 'Get company SMTP settings (password masked)',
  })
  async get(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return {
      data: await this.smtpSettingsService.getSmtpSettings(companyId),
    };
  }

  @Put()
  @RequirePermission('settings', 'edit')
  @ApiOperation({
    summary: 'Save company SMTP settings (password encrypted at rest)',
  })
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateSmtpSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return {
      data: await this.smtpSettingsService.updateSmtpSettings(
        companyId,
        dto,
        user,
        { ipAddress: req.ip, device: req.headers['user-agent'] },
      ),
    };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('settings', 'edit')
  @ApiOperation({
    summary: 'Send a test email using saved or draft SMTP settings',
  })
  async sendTest(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: SendSmtpTestEmailDto,
  ) {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const settings = await this.smtpSettingsService.resolveDecryptedSettings(
      companyId,
      {
        host: dto.host,
        port: dto.port,
        username: dto.username,
        password: dto.password,
        fromAddress: dto.fromAddress,
        fromName: dto.fromName,
        useTls: dto.useTls,
      },
    );

    await this.mailService.sendTestEmail(
      settings,
      dto.toEmail.trim(),
      company.name,
    );

    return {
      data: {
        sent: true,
        toEmail: dto.toEmail.trim(),
      },
    };
  }
}
