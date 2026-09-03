import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './database/prisma.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { DocumentsModule } from './documents/documents.module';
import { EmployeesModule } from './employees/employees.module';
import { OrganizationModule } from './organization/organization.module';
import { RbacModule } from './rbac/rbac.module';
import { RolesModule } from './roles/roles.module';
import { PlatformModule } from './platform/platform.module';
import { RuleResolverModule } from './rule-resolver/rule-resolver.module';
import { StorageModule } from './storage/storage.module';
import { SyncModule } from './sync/sync.module';
import { TenantModule } from './tenant/tenant.module';

@Module({
  imports: [
    CommonModule,
    PrismaModule,
    TenantModule,
    RbacModule,
    AuthModule,
    AuditModule,
    StorageModule,
    AttendanceModule,
    SyncModule,
    OrganizationModule,
    EmployeesModule,
    LifecycleModule,
    CustomFieldsModule,
    DocumentsModule,
    RolesModule,
    RuleResolverModule,
    PlatformModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
