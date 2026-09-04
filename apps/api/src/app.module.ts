import { Module } from '@nestjs/common';
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

@Module({
  imports: [
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
