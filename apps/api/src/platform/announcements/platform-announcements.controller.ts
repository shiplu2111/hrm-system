import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  PlatformAnnouncementAudienceType,
  PlatformAnnouncementSeverity,
  PlatformAnnouncementStatus,
} from '@prisma/client';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAnnouncementsService } from './platform-announcements.service';
import {
  AudiencePreviewDto,
  CreatePlatformAnnouncementDto,
  UpdatePlatformAnnouncementDto,
} from './dto/announcement.dto';

@Controller('platform/announcements')
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
export class PlatformAnnouncementsController {
  constructor(
    private readonly announcementsService: PlatformAnnouncementsService,
  ) {}

  @Get()
  @RequirePlatformPermission('platform', 'view')
  async listAnnouncements(
    @Query('status') status?: PlatformAnnouncementStatus,
    @Query('severity') severity?: PlatformAnnouncementSeverity,
    @Query('audienceType') audienceType?: PlatformAnnouncementAudienceType,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = await this.announcementsService.listAnnouncements({
      status,
      severity,
      audienceType,
      search,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return { data };
  }

  @Get(':id')
  @RequirePlatformPermission('platform', 'view')
  async getAnnouncement(@Param('id') id: string) {
    const data = await this.announcementsService.getAnnouncementById(id);
    return { data };
  }

  @Post('audience-preview')
  @RequirePlatformPermission('platform', 'view')
  async previewAudience(@Body() dto: AudiencePreviewDto) {
    const data = await this.announcementsService.previewAudience(dto);
    return { data };
  }

  @Post()
  @RequirePlatformPermission('platform', 'manage')
  async createAnnouncement(
    @Body() dto: CreatePlatformAnnouncementDto,
    @Request() req: any,
  ) {
    const actorUserId = req.platformUser?.id || req.user?.id;
    const actorName = req.platformUser?.name || req.user?.name || req.platformUser?.email;
    const data = await this.announcementsService.createAnnouncement(
      dto,
      actorUserId,
      actorName,
    );
    return { data };
  }

  @Patch(':id')
  @RequirePlatformPermission('platform', 'manage')
  async updateAnnouncement(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformAnnouncementDto,
    @Request() req: any,
  ) {
    const actorUserId = req.platformUser?.id || req.user?.id;
    const actorName = req.platformUser?.name || req.user?.name || req.platformUser?.email;
    const data = await this.announcementsService.updateAnnouncement(
      id,
      dto,
      actorUserId,
      actorName,
    );
    return { data };
  }

  @Post(':id/publish')
  @RequirePlatformPermission('platform', 'manage')
  async publishAnnouncement(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const actorUserId = req.platformUser?.id || req.user?.id;
    const actorName = req.platformUser?.name || req.user?.name || req.platformUser?.email;
    const data = await this.announcementsService.publishAnnouncement(
      id,
      actorUserId,
      actorName,
    );
    return { data };
  }

  @Post(':id/archive')
  @RequirePlatformPermission('platform', 'manage')
  async archiveAnnouncement(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const actorUserId = req.platformUser?.id || req.user?.id;
    const actorName = req.platformUser?.name || req.user?.name || req.platformUser?.email;
    const data = await this.announcementsService.archiveAnnouncement(
      id,
      actorUserId,
      actorName,
    );
    return { data };
  }

  @Delete(':id')
  @RequirePlatformPermission('platform', 'manage')
  async deleteAnnouncement(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const actorUserId = req.platformUser?.id || req.user?.id;
    const data = await this.announcementsService.deleteAnnouncement(
      id,
      actorUserId,
    );
    return { data };
  }
}
