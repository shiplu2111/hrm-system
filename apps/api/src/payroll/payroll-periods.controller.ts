import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CreatePayrollPeriodDto,
  ListPayrollPeriodsQueryDto,
  UpdatePayrollPeriodDto,
} from './dto/payroll-periods.dto';
import { PayrollPeriodsService } from './payroll-periods.service';

@ApiTags('payroll-periods')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/payroll-periods')
export class PayrollPeriodsController {
  constructor(private readonly payrollPeriodsService: PayrollPeriodsService) {}

  @Get()
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'List payroll periods for a company' })
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListPayrollPeriodsQueryDto,
  ) {
    return {
      data: await this.payrollPeriodsService.list(companyId, query),
    };
  }

  @Get(':periodId')
  @RequirePermission('payroll', 'view')
  async get(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('periodId', ParseUUIDPipe) periodId: string,
  ) {
    return {
      data: await this.payrollPeriodsService.get(companyId, periodId),
    };
  }

  @Post()
  @RequirePermission('payroll', 'create')
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreatePayrollPeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.payrollPeriodsService.create(companyId, dto, user),
    };
  }

  @Patch(':periodId')
  @RequirePermission('payroll', 'edit')
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Body() dto: UpdatePayrollPeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.payrollPeriodsService.update(companyId, periodId, dto, user),
    };
  }
}
