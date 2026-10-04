import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type {
  ApiResponse as ApiEnvelope,
  ContractExpiryAlertRunResult,
  ContractExpiryAlertSettings,
  ContractExpiryAlertsView,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { ContractExpiryAlertsService } from './contract-expiry-alerts.service';
import { ContractExpirySettingsService } from './contract-expiry-settings.service';
import {
  ContractExpiryAlertsQueryDto,
  UpdateContractExpiryAlertSettingsDto,
} from './dto/contract-expiry-alerts.dto';

@ApiTags('employment-contracts')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/contract-expiry-alerts')
export class ContractExpiryAlertsController {
  constructor(
    private readonly alerts: ContractExpiryAlertsService,
    private readonly settings: ContractExpirySettingsService,
  ) {}

  @Get()
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Active contracts ending within the expiry window, plus overdue ones' })
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ContractExpiryAlertsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<ContractExpiryAlertsView>> {
    return { data: await this.alerts.getAlerts(companyId, user, query.windowDays) };
  }

  @Put('settings')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Set the contract expiry alert window (days before end date)' })
  async updateSettings(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateContractExpiryAlertSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ApiEnvelope<ContractExpiryAlertSettings>> {
    return {
      data: await this.settings.updateSettings(companyId, dto, user, {
        ipAddress: req.ip,
        device: req.headers['user-agent'],
      }),
    };
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Send due contract.expiring notifications now instead of waiting for the daily job' })
  async run(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<ContractExpiryAlertRunResult>> {
    return { data: await this.alerts.runNow(companyId, user) };
  }
}
