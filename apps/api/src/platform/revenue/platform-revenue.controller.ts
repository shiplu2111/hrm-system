import {
  Controller,
  Get,
  Header,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type {
  ApiResponse as ApiEnvelope,
  PlatformRevenueReportView,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { PlatformRevenueService } from './platform-revenue.service';

@ApiTags('platform-revenue')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/revenue')
export class PlatformRevenueController {
  constructor(
    private readonly platformRevenueService: PlatformRevenueService,
  ) {}

  @Get('report')
  @RequirePlatformPermission('billing', 'view')
  @ApiOperation({
    summary:
      'Get aggregate revenue metrics: MRR, ARR, 12-month movements, revenue by plan, revenue by country, and churn rates',
  })
  async getRevenueReport(): Promise<ApiEnvelope<PlatformRevenueReportView>> {
    const data = await this.platformRevenueService.getRevenueReport();
    return { data };
  }

  @Get('export')
  @RequirePlatformPermission('billing', 'view')
  @ApiOperation({
    summary: 'Export executive revenue report in CSV format',
  })
  async exportRevenueCsv(@Res() res: Response): Promise<void> {
    const csvContent = await this.platformRevenueService.exportRevenueCsv();
    const filename = `platform-revenue-report-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.status(200).send(csvContent);
  }
}
