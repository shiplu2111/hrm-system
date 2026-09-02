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
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
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
  @ApiOperation({ summary: 'List valid permission modules and actions' })
  getPermissionCatalog(): ApiEnvelope<PermissionCatalogDto> {
    return { data: this.rolesService.getPermissionCatalog() };
  }

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'List roles for the authenticated tenant' })
  @ApiResponse({ status: 200, type: RoleResponseDto, isArray: true })
  async listRoles(): Promise<ApiEnvelope<ReturnType<typeof RolesService.toResponse>[]>> {
    const roles = await this.rolesService.listRoles();
    return { data: roles.map(RolesService.toResponse) };
  }

  @Get(':id')
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'Get role by ID' })
  async getRole(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiEnvelope<ReturnType<typeof RolesService.toResponse>>> {
    const role = await this.rolesService.getRole(id);
    return { data: RolesService.toResponse(role) };
  }

  @Post()
  @RequirePermission('settings', 'create')
  @ApiOperation({ summary: 'Create a custom tenant role (ROLES_PERMISSIONS.md §2)' })
  async createRole(
    @Body() dto: CreateRoleDto,
  ): Promise<ApiEnvelope<ReturnType<typeof RolesService.toResponse>>> {
    const role = await this.rolesService.createCustomRole(dto);
    return { data: RolesService.toResponse(role) };
  }

  @Patch(':id')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Update a custom role name and/or permissions' })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<ApiEnvelope<ReturnType<typeof RolesService.toResponse>>> {
    const role = await this.rolesService.updateCustomRole(id, dto);
    return { data: RolesService.toResponse(role) };
  }

  @Delete(':id')
  @RequirePermission('settings', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a custom role (must have no assigned users)' })
  async deleteRole(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.rolesService.deleteCustomRole(id);
  }
}
