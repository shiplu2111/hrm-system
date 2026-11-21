import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { BillingModule } from '../billing/billing.module';
import { CustomDomainsModule } from '../custom-domains/custom-domains.module';
import { MailService } from './mail.service';
import { SmtpSettingsController } from './smtp-settings.controller';
import { SmtpSettingsService } from './smtp-settings.service';
import { BrandingService } from './branding.service';
import { BrandingController } from './branding.controller';

@Module({
  imports: [
    PrismaModule,
    OrganizationModule,
    AuditModule,
    CustomDomainsModule,
  ],
  controllers: [SmtpSettingsController, BrandingController],
  providers: [SmtpSettingsService, MailService, BrandingService],
  exports: [SmtpSettingsService, MailService, BrandingService],
})
export class SettingsModule {}
