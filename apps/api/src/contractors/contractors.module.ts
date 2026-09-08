import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OrganizationModule } from '../organization/organization.module';
import { AccountingModule } from '../accounting/accounting.module';
import { ContractorContractsService } from './contractor-contracts.service';
import { ContractorInvoicesService } from './contractor-invoices.service';
import { ContractorPaymentBatchesService } from './contractor-payment-batches.service';
import { ContractorsController } from './contractors.controller';
import { ContractorsService } from './contractors.service';

@Module({
  imports: [OrganizationModule, AuditModule, forwardRef(() => AccountingModule)],
  controllers: [ContractorsController],
  providers: [
    ContractorsService,
    ContractorContractsService,
    ContractorInvoicesService,
    ContractorPaymentBatchesService,
  ],
  exports: [
    ContractorsService,
    ContractorContractsService,
    ContractorInvoicesService,
    ContractorPaymentBatchesService,
  ],
})
export class ContractorsModule {}
