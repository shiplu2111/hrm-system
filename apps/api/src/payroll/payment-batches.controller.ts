import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CreatePaymentBatchDto,
  MarkPaymentBatchFailedDto,
  MarkPaymentBatchPaidDto,
} from './dto/payment-batches.dto';
import { PaymentBatchesService } from './payment-batches.service';

@ApiTags('payment-batches')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/payment-batches')
export class PaymentBatchesController {
  constructor(private readonly paymentBatchesService: PaymentBatchesService) {}

  @Get()
  @RequirePermission('payroll', 'view')
  async list(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.paymentBatchesService.list(companyId) };
  }

  @Get(':batchId')
  @RequirePermission('payroll', 'view')
  async get(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ) {
    return { data: await this.paymentBatchesService.get(companyId, batchId) };
  }

  @Post()
  @RequirePermission('payroll', 'create')
  @ApiOperation({
    summary: 'Create draft payment batch from finalized payroll runs',
  })
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreatePaymentBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.paymentBatchesService.create(companyId, dto, user),
    };
  }

  @Post(':batchId/submit')
  @RequirePermission('payroll', 'edit')
  @ApiOperation({ summary: 'Draft → Pending' })
  async submit(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.paymentBatchesService.submit(companyId, batchId, user),
    };
  }

  @Post(':batchId/mark-paid')
  @RequirePermission('payroll', 'finalize')
  @ApiOperation({ summary: 'Pending → Paid (no bank integration yet)' })
  async markPaid(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() dto: MarkPaymentBatchPaidDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.paymentBatchesService.markPaid(
        companyId,
        batchId,
        user,
        dto.transactionReference,
      ),
    };
  }

  @Post(':batchId/mark-failed')
  @RequirePermission('payroll', 'edit')
  @ApiOperation({ summary: 'Pending → Failed' })
  async markFailed(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() dto: MarkPaymentBatchFailedDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.paymentBatchesService.markFailed(
        companyId,
        batchId,
        user,
        dto.failureReason,
      ),
    };
  }
}
