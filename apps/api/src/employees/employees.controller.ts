import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { PrismaService } from '../database/prisma.service';

@ApiTags('employees')
@ApiBearerAuth('access-token')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Get employee by ID (tenant-scoped)' })
  @ApiResponse({ status: 200, description: 'Employee in the authenticated tenant' })
  @ApiResponse({ status: 404, description: 'Not found or belongs to another tenant' })
  async findOne(
    @Param('id') id: string,
  ): Promise<
    ApiEnvelope<{
      id: string;
      tenantId: string;
      employeeNumber: string;
      firstName: string;
      lastName: string;
    }>
  > {
    const employee = await this.prisma.scoped.employee.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    return { data: employee };
  }
}
