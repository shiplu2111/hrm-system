import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { LeaveModule } from './leave/leave.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { CommonModule } from './common/common.module';
import { CryptoModule } from './crypto/crypto.module';
import { PrismaModule } from './database/prisma.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { DocumentsModule } from './documents/documents.module';
import { EmployeesModule } from './employees/employees.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { OrganizationModule } from './organization/organization.module';
import { RbacModule } from './rbac/rbac.module';
import { RolesModule } from './roles/roles.module';
import { PayrollModule } from './payroll/payroll.module';
import { PlatformModule } from './platform/platform.module';
import { RosterModule } from './roster/roster.module';
import { RuleResolverModule } from './rule-resolver/rule-resolver.module';
import { SettingsModule } from './settings/settings.module';
import { StorageModule } from './storage/storage.module';
import { SyncModule } from './sync/sync.module';
import { TenantModule } from './tenant/tenant.module';
import { WorkflowModule } from './workflow/workflow.module';
import { ContractsModule } from './contracts/contracts.module';
import { LoansModule } from './loans/loans.module';
import { ExpensesModule } from './expenses/expenses.module';
import { TimesheetsModule } from './timesheets/timesheets.module';
import { RecruitmentModule } from './recruitment/recruitment.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { OffboardingModule } from './offboarding/offboarding.module';
import { AssetsModule } from './assets/assets.module';
import { BenefitsModule } from './benefits/benefits.module';
import { AccountingModule } from './accounting/accounting.module';
import { ApiAccessModule } from './api-access/api-access.module';
import { BillingModule } from './billing/billing.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SupportModule } from './support/support.module';
import { CurrencyModule } from './currency/currency.module';
import { PerformanceModule } from './performance/performance.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    CommonModule,
    CryptoModule,
    PrismaModule,
    TenantModule,
    RbacModule,
    AuthModule,
    AuditModule,
    StorageModule,
    AttendanceModule,
    SyncModule,
    OrganizationModule,
    RosterModule,
    EmployeesModule,
    LeaveModule,
    PayrollModule,
    LifecycleModule,
    CustomFieldsModule,
    DocumentsModule,
    RolesModule,
    RuleResolverModule,
    PlatformModule,
    SettingsModule,
    NotificationsModule,
    DashboardModule,
    ReportsModule,
    WorkflowModule,
    ContractsModule,
    LoansModule,
    ExpensesModule,
    TimesheetsModule,
    RecruitmentModule,
    OnboardingModule,
    OffboardingModule,
    AssetsModule,
    BenefitsModule,
    AccountingModule,
    ApiAccessModule,
    BillingModule,
    WebhooksModule,
    SupportModule,
    CurrencyModule,
    PerformanceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
