import { Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module';
import { PlatformSettingsModule } from '../settings/platform-settings.module';
import { PublicComplianceController } from './public-compliance.controller';
import { PublicComplianceService } from './public-compliance.service';

@Module({
  imports: [PlatformSettingsModule, StorageModule],
  controllers: [PublicComplianceController],
  providers: [PublicComplianceService],
  exports: [PublicComplianceService],
})
export class PublicComplianceModule {}
