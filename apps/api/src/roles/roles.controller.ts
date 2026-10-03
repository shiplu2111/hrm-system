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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type {
  ApiResponse as ApiEnvelope,
  PermissionCatalog,
  TenantRoleRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CreateRoleDto,
  PermissionCatalogDto,
  RoleResponseDto,
  UpdateRoleDto,
} from './dto/role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth('access-token')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permission-catalog')
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'List permission modules and the actions each one uses' })
  @ApiResponse({ status: 200, type: PermissionCatalogDto })
  getPermissionCatalog(): ApiEnvelope<PermissionCatalog> {
    return { data: this.rolesService.getPermissionCatalog() };
  }

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'List roles for the authenticated tenant' })
  @ApiResponse({ status: 200, type: RoleResponseDto, isArray: true })
  async listRoles(): Promise<ApiEnvelope<TenantRoleRecord[]>> {
    const roles = await this.rolesService.listRoles();
    return { data: roles.map(RolesService.toResponse) };
  }

  @Get(':id')
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiResponse({ status: 200, type: RoleResponseDto })
  async getRole(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiEnvelope<TenantRoleRecord>> {
    const role = await this.rolesService.getRole(id);
    return { data: RolesService.toResponse(role) };
  }

  @Post()
  @RequirePermission('settings', 'create')
  @ApiOperation({
    summary: 'Create a custom tenant role (ROLES_PERMISSIONS.md §2)',
    description: 'Callers can only grant permissions they hold themselves.',
  })
  @ApiResponse({ status: 201, type: RoleResponseDto })
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<TenantRoleRecord>> {
    const role = await this.rolesService.createCustomRole(dto, user);
    return { data: RolesService.toResponse(role) };
  }

  @Patch(':id')
  @RequirePermission('settings', 'edit')
  @ApiOperation({
    summary: 'Update a custom role name and/or permissions',
    description: 'Newly added permissions must be held by the caller.',
  })
  @ApiResponse({ status: 200, type: RoleResponseDto })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<TenantRoleRecord>> {
    const role = await this.rolesService.updateCustomRole(id, dto, user);
    return { data: RolesService.toResponse(role) };
  }

  @Delete(':id')
  @RequirePermission('settings', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a custom role (no assigned users or approval steps)' })
  async deleteRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.rolesService.deleteCustomRole(id, user);
  }
}
