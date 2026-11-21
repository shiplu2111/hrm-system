import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { CountriesController } from './countries.controller';
import { CountriesService } from './countries.service';
import { RuleVersionsService } from './rule-versions.service';

@Module({
  imports: [PrismaModule, PlatformAuthModule, PlatformAuditModule],
  controllers: [CountriesController],
  providers: [CountriesService, RuleVersionsService],
  exports: [CountriesService, RuleVersionsService],
})
export class CountriesModule {}

