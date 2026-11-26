import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type {
  ApiResponse as ApiEnvelope,
  LeadStatus,
  PlatformLeadDetail,
  PlatformLeadRecordKind,
  PlatformLeadsListResponse,
  PublicLeadErasureResult,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PlatformActorContext } from '../audit/platform-audit.service';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { UpdatePlatformLeadDto } from './dto/platform-leads.dto';
import { EraseLeadDataDto } from './dto/public-leads.dto';
import { PlatformLeadsService } from './platform-leads.service';
import { PublicLeadsService } from './public-leads.service';

@ApiTags('platform-leads')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/leads')
export class PlatformLeadsController {
  constructor(
    private readonly platformLeadsService: PlatformLeadsService,
    private readonly publicLeadsService: PublicLeadsService,
  ) {}

  private getActor(req: any): PlatformActorContext {
    const user = req?.platformUser ?? req?.user;
    return {
      id: user?.id ?? user?.userId ?? user?.sub,
      email: user?.email,
      roleName: user?.roleName ?? user?.role_name,
      permissions: user?.permissions,
    };
  }

  @Get()
  @RequirePlatformPermission('leads', 'view')
  @ApiOperation({ summary: 'List captured leads, contact messages, or demo requests with filters' })
  @ApiQuery({ name: 'kind', required: false, enum: ['lead', 'demo', 'contact', 'leads_and_contacts'] })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'assigneeUserId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async listLeads(
    @Query('kind') kind?: PlatformLeadRecordKind | 'leads_and_contacts',
    @Query('status') status?: LeadStatus | 'all',
    @Query('country') country?: string,
    @Query('source') source?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('assigneeUserId') assigneeUserId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ): Promise<ApiEnvelope<PlatformLeadsListResponse>> {
    const data = await this.platformLeadsService.list(
      {
        kind,
        status,
        country,
        source,
        from,
        to,
        search,
        assigneeUserId,
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      },
      this.getActor(req),
    );

    return {
      data,
      meta: {
        page: data.page,
        pageSize: data.pageSize,
        total: data.total,
        totalPages: data.totalPages,
      },
    };
  }

  @Get('export')
  @RequirePlatformPermission('leads', 'view')
  @ApiOperation({ summary: 'Export matching leads or demo requests as CSV' })
  async exportCsv(
    @Query('kind') kind?: PlatformLeadRecordKind | 'leads_and_contacts',
    @Query('status') status?: LeadStatus | 'all',
    @Query('country') country?: string,
    @Query('source') source?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('assigneeUserId') assigneeUserId?: string,
    @Res() res?: any,
    @Req() req?: any,
  ): Promise<void> {
    const result = await this.platformLeadsService.exportCsv(
      { kind, status, country, source, from, to, search, assigneeUserId },
      this.getActor(req),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  }

  @Get(':kind/:id')
  @RequirePlatformPermission('leads', 'view')
  @ApiOperation({ summary: 'Get detailed lead, demo request, or contact record with audit activity' })
  async getDetail(
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Req() req?: any,
  ): Promise<ApiEnvelope<PlatformLeadDetail>> {
    const data = await this.platformLeadsService.getDetail(kind, id, this.getActor(req));
    return { data };
  }

  @Patch(':kind/:id')
  @RequirePlatformPermission('leads', 'edit')
  @ApiOperation({ summary: 'Assign lead/demo to staff, update status (audit-logged), and manage notes' })
  async updateLead(
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() dto: UpdatePlatformLeadDto,
    @Req() req?: any,
  ): Promise<ApiEnvelope<PlatformLeadDetail>> {
    const data = await this.platformLeadsService.update(kind, id, dto, this.getActor(req));
    return { data };
  }

  @Delete('erasure')
  @RequirePlatformPermission('support', 'manage')
  @ApiOperation({
    summary: 'Delete captured lead, demo, and contact records by email on request (SECURITY.md §9)',
  })
  async eraseByEmail(
    @Body() dto: EraseLeadDataDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PublicLeadErasureResult>> {
    const actor = req.platformUser ?? req.user;
    const data = await this.publicLeadsService.eraseByEmail(dto.email, dto.reason, actor?.id);
    return { data };
  }
}
