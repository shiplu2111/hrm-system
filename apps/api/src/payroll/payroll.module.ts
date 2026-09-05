import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationModule } from '../organization/organization.module';
import { LoansModule } from '../loans/loans.module';
import { EmployeeTaxProfilesController } from './employee-tax-profiles.controller';
import { EmployeeTaxProfilesService } from './employee-tax-profiles.service';
import { PayComponentsController } from './pay-components.controller';
import { PayComponentsService } from './pay-components.service';
import { PayrollCalculationController } from './payroll-calculation.controller';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayrollContextService } from './payroll-context.service';
import { PayrollAdjustmentsController } from './payroll-adjustments.controller';
import { PayrollAdjustmentsService } from './payroll-adjustments.service';
import { PaymentBatchesController } from './payment-batches.controller';
import { PaymentBatchesService } from './payment-batches.service';
import { PayslipsController } from './payslips.controller';
import { PayslipService } from './payslip.service';
import { PayrollPeriodsController } from './payroll-periods.controller';
import { PayrollPeriodsService } from './payroll-periods.service';
import { PayrollRunsController } from './payroll-runs.controller';
import { PayrollRunsService } from './payroll-runs.service';
import { SalaryStructuresController } from './salary-structures.controller';
import { SalaryStructuresService } from './salary-structures.service';

@Module({
  imports: [OrganizationModule, RbacModule, NotificationsModule, LoansModule],
  controllers: [
    PayComponentsController,
    SalaryStructuresController,
    PayrollCalculationController,
    PayrollPeriodsController,
    PayrollRunsController,
    PayrollAdjustmentsController,
    PayslipsController,
    PaymentBatchesController,
    EmployeeTaxProfilesController,
  ],
  providers: [
    PayComponentsService,
    EmployeeTaxProfilesService,
    SalaryStructuresService,
    PayrollCalculationService,
    PayrollContextService,
    PayrollPeriodsService,
    PayrollRunsService,
    PayrollAdjustmentsService,
    PayslipService,
    PaymentBatchesService,
  ],
  exports: [
    PayComponentsService,
    SalaryStructuresService,
    PayrollCalculationService,
    PayrollPeriodsService,
    PayrollRunsService,
    PayrollAdjustmentsService,
    PayslipService,
    PaymentBatchesService,
    EmployeeTaxProfilesService,
  ],
})
export class PayrollModule {}
