import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UnifiedAuthGuard } from '../../auth/unified-auth.guard';
import { RequirePermission, SelfService } from '../../rbac/require-permission.decorator';
import { PlatformAnnouncementsService } from './platform-announcements.service';

@Controller('announcements')
@UseGuards(UnifiedAuthGuard)
@SelfService()
export class TenantAnnouncementsController {
  constructor(
    private readonly announcementsService: PlatformAnnouncementsService,
  ) {}

  /**
   * Returns all active platform announcements matching the tenant's plan,
   * country, tenant ID, and user role. Dismissed announcements are omitted.
   */
  @Get('active')
  @RequirePermission('employee', 'view')
  async getActiveAnnouncements(@Request() req: any) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const roleName = req.user?.roleName;

    if (!tenantId || !userId) {
      return { data: [] };
    }

    const data = await this.announcementsService.getActiveAnnouncementsForTenant(
      tenantId,
      userId,
      roleName,
    );

    return { data };
  }

  /**
   * User dismisses an announcement (if dismissible).
   */
  @Post(':id/dismiss')
  @RequirePermission('employee', 'view')
  async dismissAnnouncement(
    @Param('id') announcementId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      throw new BadRequestException('Authenticated tenant user required');
    }

    const data = await this.announcementsService.dismissAnnouncement(
      announcementId,
      tenantId,
      userId,
    );

    return { data };
  }
}
