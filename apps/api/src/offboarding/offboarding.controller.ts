import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CreateOffboardingTemplateDto,
  CreateOffboardingTemplateItemDto,
  ListEmployeeOffboardingsQueryDto,
  ListOffboardingTemplatesQueryDto,
  RecordExitInterviewDto,
  ReturnOffboardingAssetsDto,
  StartEmployeeOffboardingDto,
  TriggerFinalSettlementDto,
  UpdateOffboardingTemplateDto,
  UpdateOffboardingTemplateItemDto,
} from './dto/offboarding.dto';
import { EmployeeOffboardingService } from './employee-offboarding.service';
import { OffboardingChecklistTemplatesService } from './offboarding-checklist-templates.service';

@ApiTags('offboarding')
@ApiBearerAuth('access-token')
@Controller()
export class OffboardingController {
  constructor(
    private readonly templatesService: OffboardingChecklistTemplatesService,
    private readonly offboardingService: EmployeeOffboardingService,
  ) {}

  @Get('companies/:companyId/offboarding-templates')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'List offboarding checklist templates' })
  async listTemplates(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListOffboardingTemplatesQueryDto,
  ) {
    return { data: await this.templatesService.list(companyId, query) };
  }

  @Post('companies/:companyId/offboarding-templates')
  @RequirePermission('employee', 'edit')
  async createTemplate(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateOffboardingTemplateDto,
  ) {
    return { data: await this.templatesService.create(companyId, dto) };
  }

  @Get('offboarding-templates/:templateId')
  @RequirePermission('employee', 'view')
  async getTemplate(@Param('templateId', ParseUUIDPipe) templateId: string) {
    return { data: await this.templatesService.get(templateId) };
  }

  @Patch('offboarding-templates/:templateId')
  @RequirePermission('employee', 'edit')
  async updateTemplate(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: UpdateOffboardingTemplateDto,
  ) {
    return { data: await this.templatesService.update(templateId, dto) };
  }

  @Post('offboarding-templates/:templateId/items')
  @RequirePermission('employee', 'edit')
  async addTemplateItem(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: CreateOffboardingTemplateItemDto,
  ) {
    return { data: await this.templatesService.addItem(templateId, dto) };
  }

  @Patch('offboarding-template-items/:itemId')
  @RequirePermission('employee', 'edit')
  async updateTemplateItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateOffboardingTemplateItemDto,
  ) {
    return { data: await this.templatesService.updateItem(itemId, dto) };
  }

  @Delete('offboarding-template-items/:itemId')
  @RequirePermission('employee', 'edit')
  async deleteTemplateItem(@Param('itemId', ParseUUIDPipe) itemId: string) {
    await this.templatesService.deleteItem(itemId);
    return { data: { success: true } };
  }

  @Get('companies/:companyId/employee-offboardings')
  @RequirePermission('employee', 'view')
  async listOffboardings(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListEmployeeOffboardingsQueryDto,
  ) {
    return { data: await this.offboardingService.list(companyId, query) };
  }

  @Post('companies/:companyId/employee-offboardings')
  @RequirePermission('employee', 'create')
  async startOffboarding(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: StartEmployeeOffboardingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.offboardingService.start(companyId, dto, user) };
  }

  @Get('employee-offboardings/:offboardingId')
  @RequirePermission('employee', 'view')
  async getOffboarding(
    @Param('offboardingId', ParseUUIDPipe) offboardingId: string,
  ) {
    return { data: await this.offboardingService.get(offboardingId) };
  }

  @Post('employee-offboardings/:offboardingId/tasks/:taskId/complete')
  @RequirePermission('employee', 'edit')
  async completeTask(
    @Param('offboardingId', ParseUUIDPipe) offboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offboardingService.completeTask(
        offboardingId,
        taskId,
        user,
      ),
    };
  }

  @Post('employee-offboardings/:offboardingId/tasks/:taskId/return-assets')
  @RequirePermission('employee', 'edit')
  async returnAssets(
    @Param('offboardingId', ParseUUIDPipe) offboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: ReturnOffboardingAssetsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offboardingService.returnAssetsForTask(
        offboardingId,
        taskId,
        dto,
        user,
      ),
    };
  }

  @Post('employee-offboardings/:offboardingId/tasks/:taskId/revoke-access')
  @RequirePermission('employee', 'approve')
  async revokeAccess(
    @Param('offboardingId', ParseUUIDPipe) offboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offboardingService.revokeAccess(
        offboardingId,
        taskId,
        user,
      ),
    };
  }

  @Post('employee-offboardings/:offboardingId/tasks/:taskId/exit-interview')
  @RequirePermission('employee', 'edit')
  async recordExitInterview(
    @Param('offboardingId', ParseUUIDPipe) offboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: RecordExitInterviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offboardingService.recordExitInterview(
        offboardingId,
        taskId,
        dto,
        user,
      ),
    };
  }

  @Post('employee-offboardings/:offboardingId/tasks/:taskId/trigger-settlement')
  @RequirePermission('payroll', 'create')
  async triggerSettlement(
    @Param('offboardingId', ParseUUIDPipe) offboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: TriggerFinalSettlementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offboardingService.triggerFinalSettlement(
        offboardingId,
        taskId,
        dto,
        user,
      ),
    };
  }
}
