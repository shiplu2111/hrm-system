import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { CustomFieldsController } from './custom-fields.controller';
import { CustomFieldsService } from './custom-fields.service';

@Module({
  imports: [PrismaModule, OrganizationModule],
  controllers: [CustomFieldsController],
  providers: [CustomFieldsService],
  exports: [CustomFieldsService],
})
export class CustomFieldsModule {}
