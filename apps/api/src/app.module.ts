import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './database/prisma.module';
import { EmployeesModule } from './employees/employees.module';
import { RbacModule } from './rbac/rbac.module';
import { RolesModule } from './roles/roles.module';
import { PlatformModule } from './platform/platform.module';
import { RuleResolverModule } from './rule-resolver/rule-resolver.module';
import { TenantModule } from './tenant/tenant.module';

@Module({
  imports: [
    CommonModule,
    PrismaModule,
    TenantModule,
    RbacModule,
    AuthModule,
    EmployeesModule,
    RolesModule,
    RuleResolverModule,
    PlatformModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
