import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type {
  ApiResponse as ApiEnvelope,
  GlobalKillSwitch,
  MaintenanceConfig,
  PlatformMaintenanceOverview,
  PublicMaintenanceStatus,
} from '@hrm/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { MaintenanceService } from './maintenance.service';
import {
  ToggleKillSwitchDto,
  UpdateMaintenanceDto,
} from './dto/maintenance.dto';

interface PlatformStaffRequestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  roleName: string;
  permissions: Array<{ module: string; action: string }>;
}

@ApiTags('platform-maintenance')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/maintenance')
export class PlatformMaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  private assertPlatformAdminOrOwner(req: Request): PlatformStaffRequestUser {
    const user = ((req as any).platformUser || (req as any).user) as PlatformStaffRequestUser;
    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Platform authentication required',
      });
    }

    if (user.roleName !== 'Platform Owner' && user.roleName !== 'Platform Admin') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Maintenance and global toggle controls are restricted to Platform Owner and Platform Admin',
      });
    }

    return user;
  }

  private extractMeta(req: Request) {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  @Get()
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Get platform maintenance configuration and global kill switches' })
  async getOverview(@Req() req: Request): Promise<ApiEnvelope<PlatformMaintenanceOverview>> {
    this.assertPlatformAdminOrOwner(req);
    const data = await this.maintenanceService.getOverview();
    return { data };
  }

  @Patch()
  @RequirePlatformPermission('platform', 'manage')
  @ApiOperation({ summary: 'Update scheduled maintenance window and emergency switch (Requires typed reason)' })
  async updateMaintenance(
    @Req() req: Request,
    @Body() dto: UpdateMaintenanceDto,
  ): Promise<ApiEnvelope<MaintenanceConfig>> {
    const user = this.assertPlatformAdminOrOwner(req);
    const data = await this.maintenanceService.updateMaintenance(
      dto,
      user,
      this.extractMeta(req),
    );
    return { data };
  }

  @Get('kill-switches')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'List all platform-wide emergency kill switches and who changed them last' })
  async getKillSwitches(@Req() req: Request): Promise<ApiEnvelope<GlobalKillSwitch[]>> {
    this.assertPlatformAdminOrOwner(req);
    const data = await this.maintenanceService.getKillSwitches();
    return { data };
  }

  @Patch('kill-switches/:key')
  @RequirePlatformPermission('platform', 'manage')
  @ApiOperation({ summary: 'Toggle emergency kill switch state for a risky feature (Requires typed reason)' })
  async toggleKillSwitch(
    @Req() req: Request,
    @Param('key') key: string,
    @Body() dto: ToggleKillSwitchDto,
  ): Promise<ApiEnvelope<GlobalKillSwitch>> {
    const user = this.assertPlatformAdminOrOwner(req);
    const data = await this.maintenanceService.toggleKillSwitch(
      key,
      dto,
      user,
      this.extractMeta(req),
    );
    return { data };
  }
}

@ApiTags('system-status')
@SkipTenantScope()
@Controller('system')
export class SystemStatusController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'Public system status: checks if maintenance is active or scheduled' })
  async getSystemStatus(): Promise<ApiEnvelope<PublicMaintenanceStatus>> {
    const data = await this.maintenanceService.getPublicStatus();
    return { data };
  }
}
