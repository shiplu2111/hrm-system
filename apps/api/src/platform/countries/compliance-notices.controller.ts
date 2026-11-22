import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  ApiResponse as ApiEnvelope,
  ComplianceNoticeView,
} from '@hrm/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { RequirePermission } from '../../rbac/require-permission.decorator';
import { ComplianceNoticeJobService } from './compliance-notice-job.service';
import { UpdateNoticeStatusDto } from './dto/compliance-events.dto';

@ApiTags('compliance')
@ApiBearerAuth('access-token')
@Controller('compliance/notices')
export class ComplianceNoticesController {
  constructor(
    private readonly complianceNoticeJobService: ComplianceNoticeJobService,
  ) {}

  @Get()
  @RequirePermission('settings', 'view', {
    orAnyOf: [{ module: 'payroll', action: 'view' }],
  })
  @ApiOperation({ summary: 'List compliance notices and deadlines for the current tenant' })
  async listTenantNotices(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ): Promise<ApiEnvelope<ComplianceNoticeView[]>> {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    return {
      data: await this.complianceNoticeJobService.getTenantComplianceNotices(
        user.tenantId,
        companyId,
      ),
    };
  }

  @Patch(':id/status')
  @RequirePermission('settings', 'edit', {
    orAnyOf: [{ module: 'payroll', action: 'edit' }],
  })
  @ApiOperation({ summary: 'Acknowledge, complete, or dismiss a compliance deadline notice' })
  async updateNoticeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoticeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<ComplianceNoticeView>> {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant context required');
    }

    return {
      data: await this.complianceNoticeJobService.updateNoticeStatus(
        user.tenantId,
        id,
        dto.status,
        user.id,
      ),
    };
  }
}
