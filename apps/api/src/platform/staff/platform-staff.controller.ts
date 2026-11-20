import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { CreatePlatformUserDto, UpdatePlatformUserDto } from './dto/create-platform-user.dto';
import { PlatformStaffService } from './platform-staff.service';

@ApiTags('platform-staff')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/staff')
export class PlatformStaffController {
  constructor(private readonly platformStaffService: PlatformStaffService) {}

  @Get('roles')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'List all platform roles and permissions' })
  async listRoles(): Promise<ApiEnvelope<any>> {
    return { data: await this.platformStaffService.listRoles() };
  }

  @Get('users')
  @RequirePlatformPermission('user', 'view')
  @ApiOperation({ summary: 'List platform staff users' })
  async listUsers(): Promise<ApiEnvelope<any>> {
    return { data: await this.platformStaffService.listUsers() };
  }

  @Post('users')
  @RequirePlatformPermission('user', 'create')
  @ApiOperation({ summary: 'Create a new platform staff user' })
  async createUser(
    @Body() dto: CreatePlatformUserDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<any>> {
    const actorId = req.platformUser?.id ?? req.user?.id;
    return { data: await this.platformStaffService.createUser(dto, actorId) };
  }

  @Patch('users/:id')
  @RequirePlatformPermission('user', 'edit')
  @ApiOperation({ summary: 'Update a platform staff user' })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformUserDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<any>> {
    const actorId = req.platformUser?.id ?? req.user?.id;
    return { data: await this.platformStaffService.updateUser(id, dto, actorId) };
  }
}
