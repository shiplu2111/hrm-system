import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CryptoModule } from '../crypto/crypto.module';
import { PrismaModule } from '../database/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { EmployeeRelationsController } from './employee-relations.controller';
import { HrCasesService } from './hr-cases.service';

@Module({
  imports: [PrismaModule, OrganizationModule, AuditModule, CryptoModule],
  controllers: [EmployeeRelationsController],
  providers: [HrCasesService],
  exports: [HrCasesService],
})
export class EmployeeRelationsModule {}
