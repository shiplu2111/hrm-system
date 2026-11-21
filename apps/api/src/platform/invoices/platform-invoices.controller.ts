import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type {
  ApiResponse as ApiEnvelope,
  PlatformInvoiceDetailView,
  PlatformInvoiceListItem,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import {
  IssueCreditNoteDto,
  MarkInvoicePaidDto,
  QueryPlatformInvoicesDto,
  ResendInvoiceEmailDto,
} from './dto/platform-invoices.dto';
import { PlatformInvoicesService } from './platform-invoices.service';

@ApiTags('platform-invoices')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/invoices')
export class PlatformInvoicesController {
  constructor(
    private readonly platformInvoicesService: PlatformInvoicesService,
  ) {}

  @Get()
  @RequirePlatformPermission('billing', 'view')
  @ApiOperation({
    summary:
      'List all tenant invoices with filters (tenant, status, date, amount) and search',
  })
  async listInvoices(
    @Query() query: QueryPlatformInvoicesDto,
  ): Promise<ApiEnvelope<PlatformInvoiceListItem[]>> {
    const list = await this.platformInvoicesService.listInvoices(query);
    return { data: list };
  }

  @Get(':id')
  @RequirePlatformPermission('billing', 'view')
  @ApiOperation({
    summary:
      'Get invoice detail with lines, linked payments, and credit notes',
  })
  async getInvoice(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiEnvelope<PlatformInvoiceDetailView>> {
    const detail = await this.platformInvoicesService.getInvoiceDetail(id);
    return { data: detail };
  }

  @Get(':id/pdf')
  @RequirePlatformPermission('billing', 'view')
  @ApiOperation({
    summary:
      'Download invoice PDF generated and stored via the FileStorage driver',
  })
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.platformInvoicesService.getOrGeneratePdf(id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  @Post(':id/resend-email')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({
    summary: 'Resend invoice email with attached PDF to tenant billing contact',
  })
  async resendInvoiceEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResendInvoiceEmailDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<{ success: boolean; recipient: string; sent: boolean }>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const result = await this.platformInvoicesService.resendInvoiceEmail(
      id,
      dto,
      actor,
      ipAddress,
      userAgent,
    );
    return { data: result };
  }

  @Post(':id/mark-paid')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({
    summary:
      'Mark an invoice as paid manually (with mandatory justification reason and audit logging)',
  })
  async markAsPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkInvoicePaidDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformInvoiceDetailView>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const updated = await this.platformInvoicesService.markAsPaidManually(
      id,
      dto,
      actor,
      ipAddress,
      userAgent,
    );
    return { data: updated };
  }

  @Post(':id/credit-note')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({
    summary:
      'Issue a credit note against an invoice (with mandatory justification reason and balance adjustment)',
  })
  async issueCreditNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueCreditNoteDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformInvoiceDetailView>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const updated = await this.platformInvoicesService.issueCreditNote(
      id,
      dto,
      actor,
      ipAddress,
      userAgent,
    );
    return { data: updated };
  }
}
