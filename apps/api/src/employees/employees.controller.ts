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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from '../organization/dto/organization.dto';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { EmployeesService } from './employees.service';

@ApiTags('employees')
@ApiBearerAuth('access-token')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'List employees (tenant-scoped)' })
  @ApiQuery({ name: 'companyId', required: false })
  async listEmployees(
    @Query('companyId') companyId?: string,
  ): Promise<ApiEnvelope<Awaited<ReturnType<EmployeesService['listEmployees']>>>> {
    return { data: await this.employeesService.listEmployees(companyId) };
  }

  @Get(':id')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Get employee by ID (tenant-scoped)' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiEnvelope<Awaited<ReturnType<EmployeesService['getEmployee']>>>> {
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

  @Patch(':id')
  @RequirePermission('employee', 'edit')
  @ApiOperation({ summary: 'Update employee profile' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<ApiEnvelope<Awaited<ReturnType<EmployeesService['updateEmployee']>>>> {
    return { data: await this.employeesService.updateEmployee(id, dto) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('employee', 'delete')
  @ApiOperation({ summary: 'Soft-delete employee' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.employeesService.deleteEmployee(id);
  }
}
