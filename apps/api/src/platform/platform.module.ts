import { Module } from '@nestjs/common';
import { PlatformAuditModule } from './audit/platform-audit.module';
import { PlatformAuthModule } from './auth/platform-auth.module';
import { PlatformBrandingModule } from './branding/platform-branding.module';
import { CountriesModule } from './countries/countries.module';
import { PlatformDashboardModule } from './dashboard/platform-dashboard.module';
import { PlatformInvoicesModule } from './invoices/platform-invoices.module';
import { PlatformPaymentsModule } from './payments/platform-payments.module';
import { PlatformPlansModule } from './plans/platform-plans.module';
import { PlatformRevenueModule } from './revenue/platform-revenue.module';
import { PlatformStaffModule } from './staff/platform-staff.module';
import { PlatformSubscriptionsModule } from './subscriptions/platform-subscriptions.module';
import { PlatformSupportAccessModule } from './support-access/platform-support-access.module';
import { PlatformTenantsModule } from './tenants/platform-tenants.module';
import { PlatformExchangeRatesModule } from './exchange-rates/platform-exchange-rates.module';
import { PlatformLanguagePacksModule } from './language-packs/platform-language-packs.module';
import { PlatformMaintenanceModule } from './maintenance/platform-maintenance.module';
import { PlatformSettingsModule } from './settings/platform-settings.module';
import { PlatformAnnouncementsModule } from './announcements/platform-announcements.module';
import { PlatformHealthModule } from './health/platform-health.module';
import { UsageMeteringModule } from './usage/usage-metering.module';
import { PlatformQueuesModule } from './queues/platform-queues.module';
import { PlatformSupportTicketsModule } from './support-tickets/platform-support-tickets.module';
import { PlatformKbModule } from './knowledge-base/platform-kb.module';

@Module({
  imports: [
    CountriesModule,
    PlatformAuthModule,
    PlatformAuditModule,
    PlatformBrandingModule,
    PlatformDashboardModule,
    PlatformExchangeRatesModule,
    PlatformLanguagePacksModule,
    PlatformMaintenanceModule,
    PlatformSettingsModule,
    PlatformAnnouncementsModule,
    PlatformHealthModule,
    UsageMeteringModule,
    PlatformQueuesModule,
    PlatformInvoicesModule,
    PlatformPaymentsModule,
    PlatformPlansModule,
    PlatformRevenueModule,
    PlatformStaffModule,
    PlatformSubscriptionsModule,
    PlatformSupportAccessModule,
    PlatformSupportTicketsModule,
    PlatformKbModule,
    PlatformTenantsModule,
  ],
  exports: [
    CountriesModule,
    PlatformAuthModule,
    PlatformAuditModule,
    PlatformBrandingModule,
    PlatformDashboardModule,
    PlatformExchangeRatesModule,
    PlatformLanguagePacksModule,
    PlatformMaintenanceModule,
    PlatformSettingsModule,
    PlatformAnnouncementsModule,
    PlatformHealthModule,
    UsageMeteringModule,
    PlatformQueuesModule,
    PlatformInvoicesModule,
    PlatformPaymentsModule,
    PlatformPlansModule,
    PlatformRevenueModule,
    PlatformStaffModule,
    PlatformSubscriptionsModule,
    PlatformSupportAccessModule,
    PlatformSupportTicketsModule,
    PlatformKbModule,
    PlatformTenantsModule,
  ],
})
export class PlatformModule { }

