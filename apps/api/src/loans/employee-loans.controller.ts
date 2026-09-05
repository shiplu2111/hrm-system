import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CreateEmployeeLoanDto,
  ListEmployeeLoansQueryDto,
  RejectEmployeeLoanDto,
} from './dto/loan.dto';
import { EmployeeLoansService } from './employee-loans.service';

@ApiTags('employee-loans')
@ApiBearerAuth('access-token')
@Controller()
export class EmployeeLoansController {
  constructor(private readonly loansService: EmployeeLoansService) {}

  @Get('companies/:companyId/employee-loans')
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'List employee loans and salary advances' })
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListEmployeeLoansQueryDto,
  ) {
    return { data: await this.loansService.list(companyId, query) };
  }

  @Get('employee-loans/:loanId')
  @RequirePermission('payroll', 'view')
  async get(@Param('loanId', ParseUUIDPipe) loanId: string) {
    return { data: await this.loansService.get(loanId) };
  }

  @Post('companies/:companyId/employee-loans')
  @RequirePermission('payroll', 'create')
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateEmployeeLoanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.loansService.create(companyId, dto, user) };
  }

  @Post('employee-loans/:loanId/approve')
  @RequirePermission('payroll', 'edit')
  async approve(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.loansService.approve(loanId, user) };
  }

  @Post('employee-loans/:loanId/reject')
  @RequirePermission('payroll', 'edit')
  async reject(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: RejectEmployeeLoanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.loansService.reject(loanId, user, dto) };
  }
}
