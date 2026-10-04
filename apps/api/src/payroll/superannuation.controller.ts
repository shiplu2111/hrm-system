import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { parseDateOnly } from '../rule-resolver/effective-date.utils';
import { SuperannuationSettingsQueryDto } from './dto/superannuation.dto';
import { SuperannuationSettingsService } from './superannuation-settings.service';

@ApiTags('superannuation')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/superannuation')
export class SuperannuationController {
  constructor(private readonly settingsService: SuperannuationSettingsService) {}

  @Get('settings')
  @RequirePermission('payroll', 'view')
  @ApiOperation({
    summary:
      'Resolved superannuation contribution settings: effective rates, the rule layer behind each value, version history and per-employee exceptions (read-only)',
  })
  async getSettings(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: SuperannuationSettingsQueryDto,
  ) {
    return {
      data: await this.settingsService.getSettings(
        companyId,
        query.asOf ? parseDateOnly(query.asOf) : undefined,
      ),
    };
  }
}
