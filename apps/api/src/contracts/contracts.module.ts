import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationModule } from '../organization/organization.module';
import { StorageModule } from '../storage/storage.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { ContractExpiryAlertsService } from './contract-expiry-alerts.service';
import { ContractWorkflowService } from './contract-workflow.service';
import { EmploymentContractsController } from './employment-contracts.controller';
import { EmploymentContractsService } from './employment-contracts.service';

@Module({
  imports: [
    PrismaModule,
    OrganizationModule,
    StorageModule,
    AuditModule,
    WorkflowModule,
    NotificationsModule,
  ],
  controllers: [EmploymentContractsController],
  providers: [
    EmploymentContractsService,
    ContractWorkflowService,
    ContractExpiryAlertsService,
  ],
  exports: [EmploymentContractsService, ContractExpiryAlertsService],
})
export class ContractsModule {}
