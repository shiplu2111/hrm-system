import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationModule } from '../organization/organization.module';
import { StorageModule } from '../storage/storage.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseClaimsService } from './expense-claims.service';
import { ExpenseWorkflowService } from './expense-workflow.service';
import { ExpensesController } from './expenses.controller';

@Module({
  imports: [
    PrismaModule,
    OrganizationModule,
    StorageModule,
    AuditModule,
    WorkflowModule,
    NotificationsModule,
  ],
  controllers: [ExpensesController],
  providers: [
    ExpenseCategoriesService,
    ExpenseClaimsService,
    ExpenseWorkflowService,
  ],
  exports: [ExpenseClaimsService, ExpenseCategoriesService],
})
export class ExpensesModule {}
