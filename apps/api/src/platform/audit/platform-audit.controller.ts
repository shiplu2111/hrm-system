// apps/api/src/platform/audit/platform-audit.controller.ts
import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type {
  ApiResponse as ApiEnvelope,
  PlatformAuditFilterOptions,
  PlatformAuditLogItem,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { PlatformAuditService } from './platform-audit.service';

@ApiTags('platform-audit')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/audit-logs')
export class PlatformAuditController {
  constructor(private readonly platformAuditService: PlatformAuditService) {}

  @Get()
  @RequirePlatformPermission('audit', 'view')
  @ApiOperation({ summary: 'List platform audit logs with multi-attribute filtering (append-only)' })
  @ApiQuery({ name: 'module', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'recordId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async listLogs(
    @Query('module') module?: string,
    @Query('userId') userId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('action') action?: string,
    @Query('recordId') recordId?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ): Promise<ApiEnvelope<PlatformAuditLogItem[]>> {
    const actor = req?.platformUser;
    const result = await this.platformAuditService.list(
      {
        module,
        userId,
        tenantId,
        action,
        recordId,
        search,
        from,
        to,
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 25,
      },
      actor,
    );

    return {
      data: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @Get('filters')
  @RequirePlatformPermission('audit', 'view')
  @ApiOperation({ summary: 'Get available filter options for platform audit logs' })
  async getFilterOptions(
    @Req() req?: any,
  ): Promise<ApiEnvelope<PlatformAuditFilterOptions>> {
    const actor = req?.platformUser;
    const data = await this.platformAuditService.getFilterOptions(actor);
    return { data };
  }

  @Get('export')
  @RequirePlatformPermission('audit', 'view')
  @ApiOperation({ summary: 'Export platform audit logs matching filters as CSV' })
  @ApiQuery({ name: 'module', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async exportCsv(
    @Query('module') module?: string,
    @Query('userId') userId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('action') action?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: any,
    @Req() req?: any,
  ): Promise<void> {
    const actor = req?.platformUser;
    const csv = await this.platformAuditService.exportCsv(
      {
        module,
        userId,
        tenantId,
        action,
        search,
        from,
        to,
      },
      actor,
    );

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `platform-audit-logs-${dateStr}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  }
}
