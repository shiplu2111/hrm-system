import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccountingProvider } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AccountingConnectionService } from './accounting-connection.service';
import { AccountingSyncQueueService } from './accounting-sync-queue.service';
import { AccountingService } from './accounting.service';
import { ContractorAccountingService } from './contractor-accounting.service';
import {
  BulkUpsertGlContractorMappingsDto,
  BulkUpsertGlPayrollMappingsDto,
  CreateGlAccountDto,
  UpdateGlAccountDto,
} from './dto/accounting.dto';

@ApiTags('accounting')
@ApiBearerAuth('access-token')
@Controller()
export class AccountingController {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly contractorAccountingService: ContractorAccountingService,
    private readonly connectionService: AccountingConnectionService,
    private readonly syncQueue: AccountingSyncQueueService,
  ) {}

  @Get('companies/:companyId/gl-accounts')
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'List chart of accounts for a company' })
  async listGlAccounts(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.accountingService.listGlAccounts(companyId) };
  }

  @Post('companies/:companyId/gl-accounts')
  @RequirePermission('payroll', 'create')
  async createGlAccount(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateGlAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.accountingService.createGlAccount(companyId, dto, user),
    };
  }

  @Patch('gl-accounts/:accountId')
  @RequirePermission('payroll', 'edit')
  async updateGlAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateGlAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.accountingService.updateGlAccount(accountId, dto, user),
    };
  }

  @Get('companies/:companyId/gl-payroll-mappings')
  @RequirePermission('payroll', 'view')
  async listMappings(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.accountingService.listPayrollMappings(companyId) };
  }

  @Post('companies/:companyId/gl-payroll-mappings')
  @RequirePermission('payroll', 'edit')
  async upsertMappings(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: BulkUpsertGlPayrollMappingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.accountingService.upsertPayrollMappings(
        companyId,
        dto,
        user,
      ),
    };
  }

  @Get('companies/:companyId/gl-contractor-mappings')
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'Contractor payment GL mappings (separate from payroll)' })
  async listContractorMappings(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return {
      data: await this.contractorAccountingService.listContractorMappings(companyId),
    };
  }

  @Post('companies/:companyId/gl-contractor-mappings')
  @RequirePermission('payroll', 'edit')
  async upsertContractorMappings(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: BulkUpsertGlContractorMappingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.contractorAccountingService.upsertContractorMappings(
        companyId,
        dto.mappings,
        user,
      ),
    };
  }

  @Get('contractor-payment-batches/:batchId/journal-preview')
  @RequirePermission('payroll', 'view')
  async previewContractorJournal(@Param('batchId', ParseUUIDPipe) batchId: string) {
    return {
      data: await this.contractorAccountingService.previewJournalForBatch(batchId),
    };
  }

  @Post('contractor-payment-batches/:batchId/journal-export')
  @RequirePermission('payroll', 'create')
  async exportContractorJournal(
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.contractorAccountingService.exportJournalForBatch(batchId, user),
    };
  }

  @Get('companies/:companyId/contractor-journal-exports')
  @RequirePermission('payroll', 'view')
  async listContractorJournalExports(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return {
      data: await this.contractorAccountingService.listContractorJournalExports(companyId),
    };
  }

  @Get('companies/:companyId/payroll-periods/:periodId/journal-preview')
  @RequirePermission('payroll', 'view')
  async previewJournal(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('periodId', ParseUUIDPipe) periodId: string,
  ) {
    return {
      data: await this.accountingService.previewJournalForPeriod(
        companyId,
        periodId,
      ),
    };
  }

  @Post('companies/:companyId/payroll-periods/:periodId/journal-export')
  @RequirePermission('payroll', 'create')
  async exportJournal(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.accountingService.exportJournalForPeriod(
        companyId,
        periodId,
        user,
      ),
    };
  }

  @Get('companies/:companyId/journal-exports')
  @RequirePermission('payroll', 'view')
  async listExports(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('payrollPeriodId') payrollPeriodId?: string,
  ) {
    return {
      data: await this.accountingService.listJournalExports(
        companyId,
        payrollPeriodId,
      ),
    };
  }

  @Get('companies/:companyId/accounting-connections')
  @RequirePermission('payroll', 'view')
  async listConnections(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return {
      data: await this.connectionService.listConnections(companyId),
    };
  }

  @Post('companies/:companyId/accounting/xero/connect')
  @RequirePermission('payroll', 'edit')
  async beginXeroConnect(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.connectionService.beginXeroConnect(companyId, user),
    };
  }

  @Delete('companies/:companyId/accounting/xero/disconnect')
  @RequirePermission('payroll', 'edit')
  async disconnectXero(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.connectionService.disconnect(companyId, 'xero', user),
    };
  }

  @Get('companies/:companyId/accounting-sync-jobs')
  @RequirePermission('payroll', 'view')
  async listSyncJobs(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('payrollPeriodId') payrollPeriodId?: string,
  ) {
    return {
      data: await this.accountingService.listAccountingSyncJobs(
        companyId,
        payrollPeriodId,
      ),
    };
  }

  @Post('companies/:companyId/accounting-sync-jobs/:jobId/retry')
  @RequirePermission('payroll', 'edit')
  async retrySyncJob(
    @Param('companyId', ParseUUIDPipe) _companyId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    await this.syncQueue.retrySyncJob(jobId);
    return { data: { retried: true } };
  }
}
