import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission, SelfService } from '../rbac/require-permission.decorator';
import {
  MyLocalizationQueryDto,
  UpdateLocalizationDto,
  UpdateMyLocalizationDto,
} from './dto/localization.dto';
import { LocalizationSettingsService } from './localization-settings.service';

@ApiTags('localization')
@ApiBearerAuth('access-token')
@Controller('tenant/localization')
export class LocalizationSettingsController {
  constructor(private readonly localization: LocalizationSettingsService) {}

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'Language, timezone and date/number formats per company and branch, with inheritance' })
  async overview(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.localization.getOverview(user.tenantId!) };
  }

  @Patch('companies/:companyId')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Set company localization overrides (null inherits from the country)' })
  async updateCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateLocalizationDto,
  ) {
    return { data: await this.localization.updateCompany(user.tenantId!, companyId, dto, user) };
  }

  @Patch('branches/:locationId')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Set branch localization overrides (null inherits from the company)' })
  async updateBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: UpdateLocalizationDto,
  ) {
    return { data: await this.localization.updateBranch(user.tenantId!, locationId, dto, user) };
  }
}

@ApiTags('localization')
@ApiBearerAuth('access-token')
@SelfService()
@Controller('me/localization')
export class MyLocalizationController {
  constructor(private readonly localization: LocalizationSettingsService) {}

  @Get()
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Effective language, timezone and formats for the signed-in user' })
  async get(@CurrentUser() user: AuthenticatedUser, @Query() query: MyLocalizationQueryDto) {
    return { data: await this.localization.forUser(user, query.companyId) };
  }

  @Patch()
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Set the signed-in user’s UI language (null follows the organization default)' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MyLocalizationQueryDto,
    @Body() dto: UpdateMyLocalizationDto,
  ) {
    return { data: await this.localization.setPreferredLanguage(user, dto.language, query.companyId) };
  }
}
