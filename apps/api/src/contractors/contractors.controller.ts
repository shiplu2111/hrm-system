import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { ContractorContractsService } from './contractor-contracts.service';
import { ContractorInvoicesService } from './contractor-invoices.service';
import { ContractorPaymentBatchesService } from './contractor-payment-batches.service';
import { ContractorsService } from './contractors.service';
import type {
  ContractorInvoiceActionDto,
  CreateContractorContractDto,
  CreateContractorDto,
  CreateContractorInvoiceDto,
  CreateContractorPaymentBatchDto,
  ListContractorInvoicesQueryDto,
  ListContractorsQueryDto,
} from './dto/contractors.dto';

@ApiTags('contractors')
@ApiBearerAuth('access-token')
@Controller()
export class ContractorsController {
  constructor(
    private readonly contractorsService: ContractorsService,
    private readonly contractsService: ContractorContractsService,
    private readonly invoicesService: ContractorInvoicesService,
    private readonly paymentBatchesService: ContractorPaymentBatchesService,
  ) {}

  @Get('companies/:companyId/contractors/summary')
  @RequirePermission('contractors', 'view')
  @ApiOperation({ summary: 'Contractor payroll summary (MODULES.md §31)' })
  async getSummary(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.contractorsService.getSummary(companyId) };
  }

  @Get('companies/:companyId/contractors')
  @RequirePermission('contractors', 'view')
  async listContractors(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListContractorsQueryDto,
  ) {
    return { data: await this.contractorsService.list(companyId, query) };
  }

  @Get('contractors/:id')
  @RequirePermission('contractors', 'view')
  async getContractor(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.contractorsService.getById(id) };
  }

  @Post('companies/:companyId/contractors')
  @RequirePermission('contractors', 'create')
  async createContractor(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateContractorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.contractorsService.create(companyId, dto, user) };
  }

  @Get('companies/:companyId/contractor-contracts')
  @RequirePermission('contractors', 'view')
  async listContracts(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.contractsService.list(companyId) };
  }

  @Get('contractors/:contractorId/contracts')
  @RequirePermission('contractors', 'view')
  async listContractsForContractor(
    @Param('contractorId', ParseUUIDPipe) contractorId: string,
  ) {
    return { data: await this.contractsService.listForContractor(contractorId) };
  }

  @Post('companies/:companyId/contractor-contracts')
  @RequirePermission('contractors', 'create')
  async createContract(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateContractorContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.contractsService.create(companyId, dto, user) };
  }

  @Get('companies/:companyId/contractor-invoices')
  @RequirePermission('contractors', 'view')
  async listInvoices(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListContractorInvoicesQueryDto,
  ) {
    return { data: await this.invoicesService.list(companyId, query) };
  }

  @Post('companies/:companyId/contractor-invoices')
  @RequirePermission('contractors', 'create')
  async createInvoice(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateContractorInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.invoicesService.create(companyId, dto, user) };
  }

  @Post('contractor-invoices/:id/submit')
  @RequirePermission('contractors', 'edit')
  async submitInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.invoicesService.submit(id, user) };
  }

  @Post('contractor-invoices/:id/approve')
  @RequirePermission('contractors', 'approve')
  async approveInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.invoicesService.approve(id, user) };
  }

  @Post('contractor-invoices/:id/reject')
  @RequirePermission('contractors', 'approve')
  async rejectInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContractorInvoiceActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.invoicesService.reject(id, user, dto) };
  }

  @Post('contractor-invoices/:id/mark-paid')
  @RequirePermission('contractors', 'finalize')
  async markInvoicePaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContractorInvoiceActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.invoicesService.markPaid(id, user, dto) };
  }

  @Get('companies/:companyId/contractor-payment-batches')
  @RequirePermission('contractors', 'view')
  async listPaymentBatches(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.paymentBatchesService.list(companyId) };
  }

  @Post('companies/:companyId/contractor-payment-batches')
  @RequirePermission('contractors', 'finalize')
  async createPaymentBatch(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateContractorPaymentBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.paymentBatchesService.createFromApprovedInvoices(
        companyId,
        dto,
        user,
      ),
    };
  }

  @Patch('contractor-payment-batches/:id/mark-paid')
  @RequirePermission('contractors', 'finalize')
  async markBatchPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.paymentBatchesService.markPaid(id, user) };
  }
}
