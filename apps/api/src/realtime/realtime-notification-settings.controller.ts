import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { UpdateRealtimeNotificationSettingsDto } from './dto/realtime-settings.dto';
import { RealtimeNotificationSettingsService } from './realtime-notification-settings.service';

@ApiTags('settings')
@ApiBearerAuth('access-token')
@Controller('organization/companies/:companyId/settings/notifications/realtime')
export class RealtimeNotificationSettingsController {
  constructor(
    private readonly realtimeSettingsService: RealtimeNotificationSettingsService,
  ) {}

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({
    summary: 'Get per-company real-time notification broadcast settings',
  })
  async get(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return {
      data: await this.realtimeSettingsService.getSettings(companyId),
    };
  }

  @Put()
  @RequirePermission('settings', 'edit')
  @ApiOperation({
    summary: 'Update which notification events broadcast live over WebSocket',
  })
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateRealtimeNotificationSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return {
      data: await this.realtimeSettingsService.updateSettings(
        companyId,
        dto,
        user,
        { ipAddress: req.ip, device: req.headers['user-agent'] },
      ),
    };
  }
}
