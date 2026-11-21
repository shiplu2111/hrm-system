import { Module } from '@nestjs/common';
import { SettingsModule } from '../../settings/settings.module';
import { StorageModule } from '../../storage/storage.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformInvoicesController } from './platform-invoices.controller';
import { PlatformInvoicesService } from './platform-invoices.service';

@Module({
  imports: [
    StorageModule,
    SettingsModule,
    PlatformAuthModule,
    PlatformAuditModule,
  ],
  controllers: [PlatformInvoicesController],
  providers: [PlatformInvoicesService],
  exports: [PlatformInvoicesService],
})
export class PlatformInvoicesModule {}
