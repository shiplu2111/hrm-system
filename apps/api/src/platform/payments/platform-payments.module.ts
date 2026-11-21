import { Module } from '@nestjs/common';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformPaymentsController } from './platform-payments.controller';
import { PlatformPaymentsService } from './platform-payments.service';

@Module({
  imports: [PlatformAuthModule, PlatformAuditModule],
  controllers: [PlatformPaymentsController],
  providers: [PlatformPaymentsService],
  exports: [PlatformPaymentsService],
})
export class PlatformPaymentsModule {}
