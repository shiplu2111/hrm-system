import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { LocaleContextService } from './locale-context.service';
import { LocalizationSettingsController, MyLocalizationController } from './localization.controller';
import { LocalizationSettingsService } from './localization-settings.service';

@Module({
  imports: [PrismaModule],
  controllers: [LocalizationSettingsController, MyLocalizationController],
  providers: [LocaleContextService, LocalizationSettingsService],
  exports: [LocaleContextService, LocalizationSettingsService],
})
export class LocaleModule {}
