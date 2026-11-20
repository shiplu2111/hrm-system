import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { UnifiedAuthGuard } from '../auth/unified-auth.guard';
import { ApiAccessModule } from '../api-access/api-access.module';
import { EnterpriseFeatureGuard } from '../billing/enterprise-feature.guard';
import { BillingModule } from '../billing/billing.module';
import { PlatformAuditModule } from '../platform/audit/platform-audit.module';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { RejectClientTenantInterceptor } from './reject-client-tenant.interceptor';
import { SupportAccessAuditInterceptor } from './support-access-audit.interceptor';
import { SupportAccessGuard } from './support-access.guard';
import { TenantInterceptor } from './tenant.interceptor';
import { TenantLifecycleGuard } from './tenant-lifecycle.guard';
import { TenantSecurityController } from './tenant-security.controller';
import { TenantSecurityService } from './tenant-security.service';

@Global()
@Module({
  imports: [RbacModule, ApiAccessModule, BillingModule, PlatformAuditModule],
  controllers: [TenantSecurityController],
  providers: [
    UnifiedAuthGuard,
    TenantSecurityService,
    SupportAccessGuard,
    SupportAccessAuditInterceptor,
    {
      provide: APP_GUARD,
      useClass: UnifiedAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantLifecycleGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SupportAccessGuard,
    },
    {
      provide: APP_GUARD,
      useClass: EnterpriseFeatureGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SupportAccessAuditInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RejectClientTenantInterceptor,
    },
  ],
  exports: [TenantSecurityService],
})
export class TenantModule {}
