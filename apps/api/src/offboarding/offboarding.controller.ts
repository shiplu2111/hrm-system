import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CancelFinalSettlementDto,
  CompleteOffboardingTaskDto,
  CreateOffboardingTemplateDto,
  CreateOffboardingTemplateItemDto,
  ListEmployeeOffboardingsQueryDto,
  ListOffboardingTemplatesQueryDto,
  ReopenOffboardingTaskDto,
  ReturnOffboardingAssetDto,
  ReturnOffboardingAssetsDto,
  SaveExitInterviewDto,
  SkipOffboardingTaskDto,
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.offboardingService.list(companyId, query, user) };
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.offboardingService.get(offboardingId, user) };
  }

  @Get('employees/:employeeId/offboarding')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: "Get an employee's offboarding tracker (null when none)" })
  async getEmployeeOffboarding(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.offboardingService.getForEmployee(employeeId, user) };
  }

  @Post('employee-offboardings/:offboardingId/tasks/:taskId/complete')
  @RequirePermission('employee', 'edit')
  async completeTask(
    @Param('offboardingId', ParseUUIDPipe) offboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CompleteOffboardingTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offboardingService.completeTask(
        offboardingId,
        taskId,
        dto,
        user,
      ),
    };
  }

  @Post('employee-offboardings/:offboardingId/tasks/:taskId/skip')
  @RequirePermission('employee', 'approve')
  async skipTask(
    @Param('offboardingId', ParseUUIDPipe) offboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: SkipOffboardingTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offboardingService.skipTask(offboardingId, taskId, dto, user),
    };
  }

  @Post('employee-offboardings/:offboardingId/tasks/:taskId/reopen')
  @RequirePermission('employee', 'edit')
  async reopenTask(
    @Param('offboardingId', ParseUUIDPipe) offboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: ReopenOffboardingTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offboardingService.reopenTask(offboardingId, taskId, dto, user),
    };
  }

  @Post('employee-offboardings/:offboardingId/assets/:assetId/return')
  @RequirePermission('employee', 'edit')
  @ApiOperation({ summary: 'Return one assigned asset during offboarding' })
  async returnAsset(
    @Param('offboardingId', ParseUUIDPipe) offboardingId: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() dto: ReturnOffboardingAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offboardingService.returnAsset(offboardingId, assetId, dto, user),
    };
  }

  @Put('employee-offboardings/:offboardingId/exit-interview')
  @RequirePermission('employee', 'edit')
  @ApiOperation({ summary: 'Save the exit interview; `complete` marks it conducted' })
  async saveExitInterview(
    @Param('offboardingId', ParseUUIDPipe) offboardingId: string,
    @Body() dto: SaveExitInterviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offboardingService.saveExitInterview(offboardingId, dto, user),
    };
  }

  @Get('employee-offboardings/:offboardingId/settlement-options')
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'Finalized runs, open periods and pay components for a settlement' })
  async settlementOptions(
    @Param('offboardingId', ParseUUIDPipe) offboardingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offboardingService.settlementOptions(offboardingId, user),
    };
  }

  @Post('employee-offboardings/:offboardingId/settlement/cancel')
  @RequirePermission('payroll', 'edit')
  @ApiOperation({ summary: 'Cancel the settlement entry and reopen the settlement step' })
  async cancelSettlement(
    @Param('offboardingId', ParseUUIDPipe) offboardingId: string,
    @Body() dto: CancelFinalSettlementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offboardingService.cancelFinalSettlement(offboardingId, dto, user),
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
    @Body() dto: SaveExitInterviewDto,
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
