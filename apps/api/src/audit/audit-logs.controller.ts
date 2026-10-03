import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope, AuditLogEntry, AuditLogFilterOptions } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AuditLogQueryService } from './audit-log-query.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@ApiTags('audit')
@ApiBearerAuth('access-token')
@Controller('tenant/audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogQueryService) {}

  @Get()
  @RequirePermission('audit', 'view')
  @ApiOperation({ summary: 'Search the tenant audit trail by module, user, action, record and date range' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AuditLogQueryDto,
  ): Promise<ApiEnvelope<AuditLogEntry[]>> {
    if (!user.tenantId) {
      return { data: [], meta: { page: 1, total: 0, pageSize: query.pageSize ?? 0 } };
    }
    const result = await this.auditLogs.list(user.tenantId, query);
    return { data: result.data, meta: { page: result.page, total: result.total, pageSize: result.pageSize } };
  }

  @Get('filters')
  @RequirePermission('audit', 'view')
  @ApiOperation({ summary: 'Modules and users that appear in the tenant audit trail' })
  async filters(@CurrentUser() user: AuthenticatedUser): Promise<ApiEnvelope<AuditLogFilterOptions>> {
    if (!user.tenantId) return { data: { modules: [], actors: [] } };
    return { data: await this.auditLogs.filterOptions(user.tenantId) };
  }
}
