import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { EmploymentStatus } from '@prisma/client';
import type { ApiResponse as ApiEnvelope, EmployeeDirectoryEntry } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from '../organization/dto/organization.dto';
import { BulkUpdateEmployeeStatusDto } from './dto/bulk-update-employee-status.dto';
import { DataScopeService } from '../rbac/data-scope.service';
import { RequirePermission, SelfService } from '../rbac/require-permission.decorator';
import { EmployeesService } from './employees.service';

@ApiTags('employees')
@ApiBearerAuth('access-token')
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly dataScope: DataScopeService,
  ) {}

  @SelfService()
  @Get()
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'List employees (tenant-scoped; team-scoped roles see their reporting tree)' })
  @ApiQuery({ name: 'companyId', required: false })
  async listEmployees(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ): Promise<ApiEnvelope<Awaited<ReturnType<EmployeesService['listEmployees']>>>> {
    return {
      data: await this.employeesService.listEmployees(
        companyId,
        await this.dataScope.employeeIdFilter(user),
      ),
    };
  }

  @SelfService()
  @Get(':id')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Get employee by ID (tenant-scoped)' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<EmployeesService['getEmployee']>>>> {
    await this.dataScope.assertEmployeeInScope(user, id);
    return { data: await this.employeesService.getEmployee(id) };
  }

  @Post()
  @RequirePermission('employee', 'create')
  @ApiOperation({ summary: 'Create employee' })
  async create(
    @Body() dto: CreateEmployeeDto,
  ): Promise<ApiEnvelope<Awaited<ReturnType<EmployeesService['createEmployee']>>>> {
    return { data: await this.employeesService.createEmployee(dto) };
  }

  @Patch('bulk/employment-status')
  @RequirePermission('employee', 'edit')
  @ApiOperation({ summary: 'Bulk update employment status for selected employees' })
  async bulkUpdateEmploymentStatus(
    @Body() dto: BulkUpdateEmployeeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<
    ApiEnvelope<Awaited<ReturnType<EmployeesService['bulkUpdateEmploymentStatus']>>>
  > {
    for (const employeeId of dto.employeeIds) {
      await this.dataScope.assertEmployeeInScope(user, employeeId, { includeSelf: false });
    }
    return {
      data: await this.employeesService.bulkUpdateEmploymentStatus(
        dto.employeeIds,
        dto.employmentStatus as EmploymentStatus,
      ),
    };
  }

  @Patch(':id')
  @RequirePermission('employee', 'edit')
  @ApiOperation({ summary: 'Update employee profile' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<EmployeesService['updateEmployee']>>>> {
    await this.dataScope.assertEmployeeInScope(user, id);
    return { data: await this.employeesService.updateEmployee(id, dto) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('employee', 'delete')
  @ApiOperation({ summary: 'Soft-delete employee' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.dataScope.assertEmployeeInScope(user, id, { includeSelf: false });
    await this.employeesService.deleteEmployee(id);
  }
}

@ApiTags('employees')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/employee-directory')
export class EmployeeDirectoryController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly dataScope: DataScopeService,
  ) {}

  @SelfService()
  @Get()
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Active colleagues (names and job titles only) for pickers such as kudos' })
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<EmployeeDirectoryEntry[]>> {
    if (await this.dataScope.isOwnOnly(user)) {
      const self = user.employeeId ? await this.employeesService.getEmployee(user.employeeId) : null;
      if (self?.companyId !== companyId) {
        throw new ForbiddenException({
          code: 'OUT_OF_SCOPE',
          message: 'You can only see colleagues in your own company',
        });
      }
    }
    return { data: await this.employeesService.listDirectory(companyId) };
  }
}
