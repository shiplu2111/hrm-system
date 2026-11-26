import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformLanguagePacksController } from './platform-language-packs.controller';
import { PublicLanguagesController } from './public-languages.controller';
import { PlatformLanguagePacksService } from './platform-language-packs.service';

@Module({
  imports: [
    PrismaModule,
    PlatformAuthModule,
    PlatformAuditModule,
  ],
  controllers: [PlatformLanguagePacksController, PublicLanguagesController],
  providers: [PlatformLanguagePacksService],
  exports: [PlatformLanguagePacksService],
})
export class PlatformLanguagePacksModule {}
