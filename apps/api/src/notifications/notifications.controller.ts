import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission, SelfService } from '../rbac/require-permission.decorator';
import {
  RegisterPushTokenDto,
  UnregisterPushTokenDto,
} from './dto/push-token.dto';
import { UpdateUserNotificationPreferencesDto } from './dto/user-notification-preferences.dto';
import { InAppNotificationsService } from './in-app-notifications.service';
import { PushDeviceTokensService } from './push-device-tokens.service';
import { UserNotificationPreferencesService } from './user-notification-preferences.service';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@SelfService()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly inAppNotificationsService: InAppNotificationsService,
    private readonly pushDeviceTokensService: PushDeviceTokensService,
    private readonly userPreferencesService: UserNotificationPreferencesService,
  ) {}

  @Get('preferences')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Get employee notification channel preferences' })
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.userPreferencesService.getPreferences(user),
    };
  }

  @Put('preferences')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Update employee notification channel preferences' })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateUserNotificationPreferencesDto,
  ) {
    return {
      data: await this.userPreferencesService.updatePreferences(user, body),
    };
  }

  @Get()
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'List in-app notifications for the current user' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    return {
      data: await this.inAppNotificationsService.listForUser(user, {
        unreadOnly: unreadOnly === 'true',
        limit: limit ? Number(limit) : undefined,
      }),
    };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Mark all in-app notifications as read' })
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.inAppNotificationsService.markAllRead(user),
    };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Mark an in-app notification as read' })
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      data: await this.inAppNotificationsService.markRead(user, id),
    };
  }

  @Post('push-tokens')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Register an FCM device token for push notifications' })
  async registerPushToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RegisterPushTokenDto,
  ) {
    return {
      data: await this.pushDeviceTokensService.register(user, body),
    };
  }

  @Delete('push-tokens')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Unregister push token for this device' })
  async unregisterPushToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UnregisterPushTokenDto,
  ) {
    await this.pushDeviceTokensService.unregister(user, body.deviceId);
  }

  @Delete('clear-all')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Clear all read in-app notifications' })
  async clearAllRead(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.inAppNotificationsService.clearAllRead(user),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Delete a single in-app notification' })
  async deleteNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      data: await this.inAppNotificationsService.delete(user, id),
    };
  }
}
