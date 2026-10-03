import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope, OvertimeRuleRecord } from '@hrm/shared-types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CreateOtRuleDto } from './dto/ot-rules.dto';
import { OtRulesService } from './ot-rules.service';

@ApiTags('shifts')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/ot-rules')
export class OtRulesController {
  constructor(private readonly otRulesService: OtRulesService) {}

  @Get()
  @RequirePermission('settings', 'view', {
    orAnyOf: [{ module: 'attendance', action: 'view' }],
  })
  @ApiOperation({ summary: 'List overtime rules selectable on shift definitions' })
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<ApiEnvelope<OvertimeRuleRecord[]>> {
    return { data: await this.otRulesService.list(companyId) };
  }

  @Post()
  @RequirePermission('settings', 'create')
  @ApiOperation({ summary: 'Create a company overtime rule' })
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateOtRuleDto,
  ): Promise<ApiEnvelope<OvertimeRuleRecord>> {
    return { data: await this.otRulesService.create(companyId, dto) };
  }
}
