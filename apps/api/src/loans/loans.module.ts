import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { EmployeeLoansController } from './employee-loans.controller';
import { EmployeeLoansService } from './employee-loans.service';
import { LoanPayrollService } from './loan-payroll.service';

@Module({
  imports: [PrismaModule, OrganizationModule, AuditModule],
  controllers: [EmployeeLoansController],
  providers: [EmployeeLoansService, LoanPayrollService],
  exports: [LoanPayrollService],
})
export class LoansModule {}
