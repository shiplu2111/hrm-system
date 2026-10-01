import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  ApiResponse as ApiEnvelope,
  EmployeePortalAccessState,
  EmployeePortalAccessView,
  EmployeePortalCredentialsResult,
  EmployeePortalRoleOption,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CreatePortalAccessDto, UpdatePortalAccessDto } from './dto/portal-access.dto';
import { PortalAccessService } from './portal-access.service';

@ApiTags('employees')
@ApiBearerAuth('access-token')
@Controller('employees')
export class PortalAccessController {
  constructor(private readonly portalAccess: PortalAccessService) {}

  @Get('portal-access/roles')
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'Roles the signed-in admin may assign to an employee login' })
  async listAssignableRoles(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<EmployeePortalRoleOption[]>> {
    return { data: await this.portalAccess.listAssignableRoles(user) };
  }

  @Get(':id/portal-access')
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'Login status for an employee' })
  async getAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiEnvelope<EmployeePortalAccessState>> {
    return { data: await this.portalAccess.getAccess(user, id) };
  }

  @Post(':id/portal-access')
  @RequirePermission('settings', 'edit')
  @ApiOperation({
    summary: 'Create a login for an employee',
    description:
      'Returns a one-time temporary password. The employee must change it on first sign-in.',
  })
  async createAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePortalAccessDto,
  ): Promise<ApiEnvelope<EmployeePortalCredentialsResult>> {
    return { data: await this.portalAccess.createAccess(user, id, dto) };
  }

  @Post(':id/portal-access/reset-password')
  @RequirePermission('settings', 'edit')
  @ApiOperation({
    summary: 'Issue a new temporary password',
    description: 'Signs the employee out everywhere and returns the new password once.',
  })
  async resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiEnvelope<EmployeePortalCredentialsResult>> {
    return { data: await this.portalAccess.resetPassword(user, id) };
  }

  @Patch(':id/portal-access')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Change login email, role, or enable/disable it' })
  async updateAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePortalAccessDto,
  ): Promise<ApiEnvelope<EmployeePortalAccessView>> {
    return { data: await this.portalAccess.updateAccess(user, id, dto) };
  }
}
