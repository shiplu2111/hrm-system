import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CreateTimesheetEntryDto,
  CreateTimesheetProjectDto,
  ListTimesheetEntriesQueryDto,
  TimesheetEntryActionDto,
} from './dto/timesheet.dto';
import { TimesheetEntriesService } from './timesheet-entries.service';
import { TimesheetProjectsService } from './timesheet-projects.service';

@ApiTags('timesheets')
@ApiBearerAuth('access-token')
@Controller()
export class TimesheetsController {
  constructor(
    private readonly projectsService: TimesheetProjectsService,
    private readonly entriesService: TimesheetEntriesService,
  ) {}

  @Get('companies/:companyId/timesheet-projects')
  @RequirePermission('attendance', 'view')
  async listProjects(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.projectsService.list(companyId) };
  }

  @Post('companies/:companyId/timesheet-projects')
  @RequirePermission('attendance', 'edit')
  async createProject(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateTimesheetProjectDto,
  ) {
    return { data: await this.projectsService.create(companyId, dto) };
  }

  @Get('companies/:companyId/timesheet-entries')
  @RequirePermission('attendance', 'view')
  async listEntries(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListTimesheetEntriesQueryDto,
  ) {
    return { data: await this.entriesService.list(companyId, query) };
  }

  @Post('companies/:companyId/timesheet-entries')
  @RequirePermission('attendance', 'create')
  async createEntry(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateTimesheetEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.entriesService.create(companyId, dto, user) };
  }

  @Post('timesheet-entries/:entryId/submit')
  @RequirePermission('attendance', 'create')
  async submitEntry(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.entriesService.submit(entryId, user) };
  }

  @Post('timesheet-entries/:entryId/approve')
  @RequirePermission('attendance', 'approve')
  async approveEntry(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: TimesheetEntryActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.entriesService.approve(entryId, user, dto) };
  }

  @Post('timesheet-entries/:entryId/reject')
  @RequirePermission('attendance', 'approve')
  async rejectEntry(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: TimesheetEntryActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.entriesService.reject(entryId, user, dto) };
  }
}
