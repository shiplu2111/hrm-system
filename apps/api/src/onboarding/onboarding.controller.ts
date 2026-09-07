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
  AssignOnboardingAssetsDto,
  CompleteOnboardingTaskDto,
  CreateOnboardingTemplateDto,
  CreateOnboardingTemplateItemDto,
  ListEmployeeOnboardingsQueryDto,
  ListOnboardingTemplatesQueryDto,
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
  ) {
    return { data: await this.templatesService.create(companyId, dto) };
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
  ) {
    return { data: await this.templatesService.update(templateId, dto) };
  }

  @Post('onboarding-templates/:templateId/items')
  @RequirePermission('employee', 'edit')
  async addTemplateItem(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: CreateOnboardingTemplateItemDto,
  ) {
    return { data: await this.templatesService.addItem(templateId, dto) };
  }

  @Patch('onboarding-template-items/:itemId')
  @RequirePermission('employee', 'edit')
  async updateTemplateItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateOnboardingTemplateItemDto,
  ) {
    return { data: await this.templatesService.updateItem(itemId, dto) };
  }

  @Delete('onboarding-template-items/:itemId')
  @RequirePermission('employee', 'edit')
  async deleteTemplateItem(@Param('itemId', ParseUUIDPipe) itemId: string) {
    await this.templatesService.deleteItem(itemId);
    return { data: { success: true } };
  }

  @Get('companies/:companyId/employee-onboardings')
  @RequirePermission('employee', 'view')
  async listOnboardings(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListEmployeeOnboardingsQueryDto,
  ) {
    return { data: await this.onboardingService.list(companyId, query) };
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
  ) {
    return { data: await this.onboardingService.get(onboardingId) };
  }

  @Get('employees/:employeeId/onboarding')
  @RequirePermission('employee', 'view')
  async getEmployeeOnboarding(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return { data: await this.onboardingService.getForEmployee(employeeId) };
  }

  @Post('employee-onboardings/:onboardingId/tasks/:taskId/complete')
  @RequirePermission('employee', 'edit')
  async completeTask(
    @Param('onboardingId', ParseUUIDPipe) onboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() _dto: CompleteOnboardingTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.onboardingService.completeTask(onboardingId, taskId, user),
    };
  }

  @Post('employee-onboardings/:onboardingId/tasks/:taskId/skip')
  @RequirePermission('employee', 'approve')
  async skipTask(
    @Param('onboardingId', ParseUUIDPipe) onboardingId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() _dto: SkipOnboardingTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.onboardingService.skipTask(onboardingId, taskId, user),
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
  ) {
    return { data: await this.onboardingService.resendWelcome(onboardingId) };
  }
}
