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
import {
  CreatePlatformUserDto,
  InvitePlatformUserDto,
  Request2faResetDto,
  Review2faResetDto,
  UpdatePlatformUserDto,
} from './dto/create-platform-user.dto';
import { PlatformStaffService } from './platform-staff.service';

function extractActor(req: any) {
  const user = req.platformUser ?? req.user;
  return {
    id: user?.id,
    email: user?.email,
    roleName: user?.roleName ?? user?.role?.name ?? '',
  };
}

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
  @ApiOperation({ summary: 'List platform staff users with status and 2FA info' })
  async listUsers(): Promise<ApiEnvelope<any>> {
    return { data: await this.platformStaffService.listUsers() };
  }

  @Post('users/invite')
  @RequirePlatformPermission('user', 'create')
  @ApiOperation({ summary: 'Invite a new platform staff user by email (first login requires 2FA)' })
  async inviteUser(
    @Body() dto: InvitePlatformUserDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<any>> {
    const actor = extractActor(req);
    return { data: await this.platformStaffService.inviteUser(dto, actor) };
  }

  @Post('users')
  @RequirePlatformPermission('user', 'create')
  @ApiOperation({ summary: 'Create a new platform staff user' })
  async createUser(
    @Body() dto: CreatePlatformUserDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<any>> {
    const actor = extractActor(req);
    return { data: await this.platformStaffService.createUser(dto, actor) };
  }

  @Patch('users/:id')
  @RequirePlatformPermission('user', 'edit')
  @ApiOperation({ summary: 'Update a platform staff user' })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformUserDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<any>> {
    const actor = extractActor(req);
    return { data: await this.platformStaffService.updateUser(id, dto, actor) };
  }

  @Post('users/:id/deactivate')
  @RequirePlatformPermission('user', 'edit')
  @ApiOperation({ summary: 'Deactivate a platform staff user and immediately revoke all active sessions' })
  async deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<ApiEnvelope<any>> {
    const actor = extractActor(req);
    return { data: await this.platformStaffService.deactivateUser(id, actor) };
  }

  @Post('users/:id/reactivate')
  @RequirePlatformPermission('user', 'edit')
  @ApiOperation({ summary: 'Reactivate a previously deactivated platform staff user' })
  async reactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<ApiEnvelope<any>> {
    const actor = extractActor(req);
    return { data: await this.platformStaffService.reactivateUser(id, actor) };
  }

  @Post('users/:id/2fa-reset/request')
  @RequirePlatformPermission('user', 'edit')
  @ApiOperation({ summary: 'Request 2FA reset for a staff user (requires another admin to approve)' })
  async request2faReset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Request2faResetDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<any>> {
    const actor = extractActor(req);
    return { data: await this.platformStaffService.request2faReset(id, dto, actor) };
  }

  @Get('2fa-reset-requests')
  @RequirePlatformPermission('user', 'view')
  @ApiOperation({ summary: 'List all 2FA reset requests' })
  async list2faResetRequests(): Promise<ApiEnvelope<any>> {
    return { data: await this.platformStaffService.list2faResetRequests() };
  }

  @Post('2fa-reset-requests/:id/review')
  @RequirePlatformPermission('user', 'edit')
  @ApiOperation({ summary: 'Review (approve or reject) a 2FA reset request with dual-control enforcement' })
  async review2faReset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Review2faResetDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<any>> {
    const actor = extractActor(req);
    return { data: await this.platformStaffService.review2faReset(id, dto, actor) };
  }
}
