import { Module } from '@nestjs/common';
import { PlatformAuditModule } from './audit/platform-audit.module';
import { PlatformAuthModule } from './auth/platform-auth.module';
import { CountriesModule } from './countries/countries.module';
import { PlatformDashboardModule } from './dashboard/platform-dashboard.module';
import { PlatformInvoicesModule } from './invoices/platform-invoices.module';
import { PlatformPlansModule } from './plans/platform-plans.module';
import { PlatformStaffModule } from './staff/platform-staff.module';
import { PlatformSubscriptionsModule } from './subscriptions/platform-subscriptions.module';
import { PlatformSupportAccessModule } from './support-access/platform-support-access.module';
import { PlatformTenantsModule } from './tenants/platform-tenants.module';

@Module({
  imports: [
    CountriesModule,
    PlatformAuthModule,
    PlatformAuditModule,
    PlatformDashboardModule,
    PlatformInvoicesModule,
    PlatformPlansModule,
    PlatformStaffModule,
    PlatformSubscriptionsModule,
    PlatformSupportAccessModule,
    PlatformTenantsModule,
  ],
  exports: [
    CountriesModule,
    PlatformAuthModule,
    PlatformAuditModule,
    PlatformDashboardModule,
    PlatformInvoicesModule,
    PlatformPlansModule,
    PlatformStaffModule,
    PlatformSubscriptionsModule,
    PlatformSupportAccessModule,
    PlatformTenantsModule,
  ],
})
export class PlatformModule {}

