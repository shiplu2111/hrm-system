import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { PayrollModule } from '../payroll/payroll.module';
import { AccountingConnectionService } from './accounting-connection.service';
import { AccountingOAuthController } from './accounting-oauth.controller';
import { AccountingSyncQueueService } from './accounting-sync-queue.service';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { AccountingGlProviderFactory } from './providers/accounting-gl-provider.factory';
import { XeroGlProvider } from './providers/xero-gl.provider';

@Module({
  imports: [
    PrismaModule,
    OrganizationModule,
    AuditModule,
    forwardRef(() => PayrollModule),
  ],
  controllers: [AccountingController, AccountingOAuthController],
  providers: [
    AccountingService,
    AccountingConnectionService,
    AccountingSyncQueueService,
    XeroGlProvider,
    AccountingGlProviderFactory,
  ],
  exports: [AccountingService, AccountingSyncQueueService],
})
export class AccountingModule {}
