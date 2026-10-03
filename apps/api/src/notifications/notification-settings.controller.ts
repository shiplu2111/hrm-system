import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { ApiResponse as ApiEnvelope, NotificationEventSettingsView } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { UpdateNotificationEventSettingsDto } from './dto/notification-settings.dto';
import { NotificationSettingsService } from './notification-settings.service';

@ApiTags('settings')
@ApiBearerAuth('access-token')
@Controller('organization/companies/:companyId/settings/notifications/events')
export class NotificationSettingsController {
  constructor(private readonly settings: NotificationSettingsService) {}

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'Per-event notification channels and live WebSocket toggles' })
  async get(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<ApiEnvelope<NotificationEventSettingsView>> {
    return { data: await this.settings.getSettings(companyId) };
  }

  @Put()
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Update notification channels and live toggles (takes effect immediately)' })
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateNotificationEventSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ApiEnvelope<NotificationEventSettingsView>> {
    return {
      data: await this.settings.updateSettings(companyId, dto, user, {
        ipAddress: req.ip,
        device: req.headers['user-agent'],
      }),
    };
  }
}
