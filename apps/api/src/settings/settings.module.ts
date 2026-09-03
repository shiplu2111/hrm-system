import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { MailService } from './mail.service';
import { SmtpSettingsController } from './smtp-settings.controller';
import { SmtpSettingsService } from './smtp-settings.service';

@Module({
  imports: [PrismaModule, OrganizationModule, AuditModule],
  controllers: [SmtpSettingsController],
  providers: [SmtpSettingsService, MailService],
  exports: [SmtpSettingsService, MailService],
})
export class SettingsModule {}
