import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { OrganizationModule } from '../organization/organization.module';
import { AssetsController } from './assets.controller';
import { CompanyAssetsService } from './company-assets.service';

@Module({
  imports: [
    PrismaModule,
    OrganizationModule,
    AuditModule,
    forwardRef(() => OnboardingModule),
  ],
  controllers: [AssetsController],
  providers: [CompanyAssetsService],
  exports: [CompanyAssetsService],
})
export class AssetsModule {}
