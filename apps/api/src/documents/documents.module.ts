import { Module } from '@nestjs/common';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';
import { OrganizationModule } from '../organization/organization.module';
import { DocumentTypesController } from './document-types.controller';
import { DocumentTypesService } from './document-types.service';
import { EmployeeDocumentsController } from './employee-documents.controller';
import { EmployeeDocumentsService } from './employee-documents.service';

@Module({
  imports: [OrganizationModule, CustomFieldsModule],
  controllers: [DocumentTypesController, EmployeeDocumentsController],
  providers: [DocumentTypesService, EmployeeDocumentsService],
})
export class DocumentsModule {}
