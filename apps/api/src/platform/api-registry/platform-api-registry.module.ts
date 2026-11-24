// apps/api/src/platform/api-registry/platform-api-registry.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformApiRegistryController } from './platform-api-registry.controller';
import { PlatformApiRegistryService } from './platform-api-registry.service';

@Module({
  imports: [PrismaModule, PlatformAuthModule, PlatformAuditModule],
  controllers: [PlatformApiRegistryController],
  providers: [PlatformApiRegistryService],
  exports: [PlatformApiRegistryService],
})
export class PlatformApiRegistryModule {}
