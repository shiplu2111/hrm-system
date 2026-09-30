import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  CreateSalaryStructureDto,
  ListSalaryStructuresQueryDto,
  ReviseSalaryStructureDto,
  UpdateSalaryStructureDto,
} from './dto/salary-structures.dto';
import { SalaryStructuresService } from './salary-structures.service';

@ApiTags('salary-structures')
@ApiBearerAuth('access-token')
@Controller('employees/:employeeId/salary-structures')
export class SalaryStructuresController {
  constructor(
    private readonly salaryStructuresService: SalaryStructuresService,
  ) {}

  @Get()
  @RequirePermission('payroll', 'view')
  @ApiOperation({
    summary: 'List salary structure assignments for an employee',
  })
  async list(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: ListSalaryStructuresQueryDto,
  ) {
    return {
      data: await this.salaryStructuresService.list(employeeId, query.asOf),
    };
  }

  @Get('payroll-lock')
  @RequirePermission('payroll', 'view')
  @ApiOperation({
    summary: 'Payroll periods finalized for this employee (structure history is read-only there)',
  })
  async payrollLock(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return {
      data: await this.salaryStructuresService.payrollLock(employeeId),
    };
  }

  @Post(':structureId/revise')
  @RequirePermission('payroll', 'edit')
  @ApiOperation({
    summary: 'Effective-dated change — closes the current row and opens a new one',
  })
  async revise(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('structureId', ParseUUIDPipe) structureId: string,
    @Body() dto: ReviseSalaryStructureDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.salaryStructuresService.revise(
        employeeId,
        structureId,
        dto,
        user,
      ),
    };
  }

  @Post()
  @RequirePermission('payroll', 'create')
  async create(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateSalaryStructureDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.salaryStructuresService.create(employeeId, dto, user),
    };
  }

  @Patch(':structureId')
  @RequirePermission('payroll', 'edit')
  async update(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('structureId', ParseUUIDPipe) structureId: string,
    @Body() dto: UpdateSalaryStructureDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.salaryStructuresService.update(
        employeeId,
        structureId,
        dto,
        user,
      ),
    };
  }

  @Delete(':structureId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('payroll', 'delete')
  async remove(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('structureId', ParseUUIDPipe) structureId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.salaryStructuresService.remove(employeeId, structureId, user);
  }
}
