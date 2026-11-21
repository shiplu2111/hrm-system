import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformPlansController } from './platform-plans.controller';
import { PlatformPlansService } from './platform-plans.service';

@Module({
  imports: [PrismaModule, PlatformAuditModule, PlatformAuthModule],
  controllers: [PlatformPlansController],
  providers: [PlatformPlansService],
  exports: [PlatformPlansService],
})
export class PlatformPlansModule {}
