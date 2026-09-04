import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AdminDashboardService } from './admin-dashboard.service';
import { EmployeeDashboardService } from './employee-dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@Controller()
export class DashboardController {
  constructor(
    private readonly adminDashboardService: AdminDashboardService,
    private readonly employeeDashboardService: EmployeeDashboardService,
  ) {}

  @Get('companies/:companyId/dashboard/admin')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Admin dashboard KPIs (MODULES.md §39)' })
  async getAdminDashboard(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return {
      data: await this.adminDashboardService.getAdminDashboard(companyId),
    };
  }

  @Get('employees/:employeeId/dashboard')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Employee dashboard (MODULES.md §39)' })
  async getEmployeeDashboard(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.employeeDashboardService.getEmployeeDashboard(
        employeeId,
        user,
      ),
    };
  }
}
