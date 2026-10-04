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
  AssignOnboardingAssetsDto,
  CompleteOnboardingTaskDto,
  CreateOnboardingTemplateDto,
  CreateOnboardingTemplateItemDto,
  ListEmployeeOnboardingsQueryDto,
  ListOnboardingTemplatesQueryDto,
  ReopenOnboardingTaskDto,
  ReorderOnboardingTemplateItemsDto,
  SkipOnboardingTaskDto,
  StartEmployeeOnboardingDto,
  UpdateOnboardingTemplateDto,
  UpdateOnboardingTemplateItemDto,
} from './dto/onboarding.dto';
import { EmployeeOnboardingService } from './employee-onboarding.service';
import { OnboardingChecklistTemplatesService } from './onboarding-checklist-templates.service';

@ApiTags('onboarding')
@ApiBearerAuth('access-token')
@Controller()
export class OnboardingController {
  constructor(
    private readonly templatesService: OnboardingChecklistTemplatesService,
    private readonly onboardingService: EmployeeOnboardingService,
  ) {}

  @Get('companies/:companyId/onboarding-templates')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'List onboarding checklist templates' })
  async listTemplates(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListOnboardingTemplatesQueryDto,
  ) {
    return { data: await this.templatesService.list(companyId, query) };
  }

  @Post('companies/:companyId/onboarding-templates')
  @RequirePermission('employee', 'edit')
  async createTemplate(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateOnboardingTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.templatesService.create(companyId, dto, user) };
  }

  @Get('onboarding-templates/:templateId')
  @RequirePermission('employee', 'view')
  async getTemplate(@Param('templateId', ParseUUIDPipe) templateId: string) {
    return { data: await this.templatesService.get(templateId) };
  }

  @Patch('onboarding-templates/:templateId')
  @RequirePermission('employee', 'edit')
  async updateTemplate(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: UpdateOnboardingTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.templatesService.update(templateId, dto, user) };
  }

  @Delete('onboarding-templates/:templateId')
  @RequirePermission('employee', 'edit')
  @ApiOperation({ summary: 'Delete an unused onboarding checklist template' })
  async deleteTemplate(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.templatesService.remove(templateId, user);
    return { data: { success: true } };
  }

  @Post('onboarding-templates/:templateId/duplicate')
  @RequirePermission('employee', 'edit')
  @ApiOperation({ summary: 'Copy a checklist template and its items' })
  async duplicateTemplate(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.templatesService.duplicate(templateId, user) };
  }

  @Post('onboarding-templates/:templateId/items')
  @RequirePermission('employee', 'edit')
  async addTemplateItem(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: CreateOnboardingTemplateItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.templatesService.addItem(templateId, dto, user) };
  }

  @Put('onboarding-templates/:templateId/items/order')
  @RequirePermission('employee', 'edit')
  @ApiOperation({ summary: 'Set the order of checklist items' })
  async reorderTemplateItems(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: ReorderOnboardingTemplateItemsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.templatesService.reorderItems(templateId, dto, user) };
  }

  @Patch('onboarding-template-items/:itemId')
  @RequirePermission('employee', 'edit')
  async updateTemplateItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateOnboardingTemplateItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.templatesService.updateItem(itemId, dto, user) };
  }

  @Delete('onboarding-template-items/:itemId')
  @RequirePermission('employee', 'edit')
  async deleteTemplateItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.templatesService.deleteItem(itemId, user);
    return { data: { success: true } };
  }

  @Get('companies/:companyId/employee-onboardings')
  @RequirePermission('employee', 'view')
  async listOnboardings(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListEmployeeOnboardingsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.onboardingService.list(companyId, query, user) };
  }

  @Post('companies/:companyId/employee-onboardings')
  @RequirePermission('employee', 'create')
  async startOnboarding(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: StartEmployeeOnboardingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.onboardingService.start(companyId, dto, user) };
  }

  @Get('employee-onboardings/:onboardingId')
  @RequirePermission('employee', 'view')
  async getOnboarding(
    @Param('onboardingId', ParseUUIDPipe) onboardingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.onboardingService.get(onboardingId, user) };
  }

  @Get('employees/:employeeId/onboarding')
  @RequirePermission('employee', 'view')
  async getEmployeeOnboarding(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.onboardingService.getForEmployee(employeeId, user) };
  }

  @Post('employee-onboardings/:onboardingId/tasks/:taskId/complete')
  @RequirePermission('employee', 'edit')
  async completeTask(
    @Param('onboardingId', ParseUUIDPipe) onboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CompleteOnboardingTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.onboardingService.completeTask(onboardingId, taskId, dto, user),
    };
  }

  @Post('employee-onboardings/:onboardingId/tasks/:taskId/skip')
  @RequirePermission('employee', 'approve')
  async skipTask(
    @Param('onboardingId', ParseUUIDPipe) onboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: SkipOnboardingTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.onboardingService.skipTask(onboardingId, taskId, dto, user),
    };
  }

  @Post('employee-onboardings/:onboardingId/tasks/:taskId/reopen')
  @RequirePermission('employee', 'edit')
  @ApiOperation({ summary: 'Put a skipped or manually completed task back to pending' })
  async reopenTask(
    @Param('onboardingId', ParseUUIDPipe) onboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: ReopenOnboardingTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.onboardingService.reopenTask(onboardingId, taskId, dto, user),
    };
  }

  @Post('employee-onboardings/:onboardingId/tasks/:taskId/accept-policy')
  @RequirePermission('employee', 'edit')
  async acceptPolicy(
    @Param('onboardingId', ParseUUIDPipe) onboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.onboardingService.acceptPolicy(onboardingId, taskId, user),
    };
  }

  @Post('employee-onboardings/:onboardingId/tasks/:taskId/assign-assets')
  @RequirePermission('employee', 'edit')
  async assignAssets(
    @Param('onboardingId', ParseUUIDPipe) onboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: AssignOnboardingAssetsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.onboardingService.assignAssetsForTask(
        onboardingId,
        taskId,
        dto,
        user,
      ),
    };
  }

  @Post('employee-onboardings/:onboardingId/resend-welcome')
  @RequirePermission('employee', 'edit')
  async resendWelcome(
    @Param('onboardingId', ParseUUIDPipe) onboardingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.onboardingService.resendWelcome(onboardingId, user) };
  }
}
