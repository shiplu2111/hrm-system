import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import type {
  CreateEmployeeIncidentDto,
  CreateInjuryLogEntryDto,
  CreateSafetyInspectionDto,
  CreateWorkplaceIncidentDto,
  ListIncidentsQueryDto,
  ListInjuryLogQueryDto,
  UpdateSafetyComplianceDto,
  UpdateWorkplaceIncidentDto,
} from './dto/health-safety.dto';
import { HealthSafetyRulesService } from './health-safety-rules.service';
import { InjuryLogService } from './injury-log.service';
import { SafetyComplianceService } from './safety-compliance.service';
import { WorkplaceIncidentsService } from './workplace-incidents.service';

@ApiTags('health-safety')
@ApiBearerAuth('access-token')
@Controller()
export class HealthSafetyController {
  constructor(
    private readonly incidentsService: WorkplaceIncidentsService,
    private readonly injuryLogService: InjuryLogService,
    private readonly complianceService: SafetyComplianceService,
    private readonly rulesService: HealthSafetyRulesService,
  ) {}

  @Get('companies/:companyId/health-safety/summary')
  @RequirePermission('health_safety', 'view')
  @ApiOperation({ summary: 'Health & safety KPIs (MODULES.md §30)' })
  async getSummary(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.complianceService.getSummary(companyId) };
  }

  @Get('companies/:companyId/health-safety/requirements')
  @RequirePermission('health_safety', 'view')
  async getRequirements(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return {
      data: await this.rulesService.getRequirementsForCompany(companyId),
    };
  }

  // --- Incidents ---

  @Get('companies/:companyId/health-safety/incidents')
  @RequirePermission('health_safety', 'view')
  async listIncidents(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListIncidentsQueryDto,
  ) {
    return { data: await this.incidentsService.list(companyId, query) };
  }

  @Get('health-safety/incidents/:id')
  @RequirePermission('health_safety', 'view')
  async getIncident(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.incidentsService.getById(id) };
  }

  @Post('companies/:companyId/health-safety/incidents')
  @RequirePermission('health_safety', 'create')
  async createIncident(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateWorkplaceIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.incidentsService.create(companyId, dto, user),
    };
  }

  @Patch('health-safety/incidents/:id')
  @RequirePermission('health_safety', 'edit')
  async updateIncident(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkplaceIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.incidentsService.update(id, dto, user) };
  }

  @Post('employees/:employeeId/health-safety/incidents')
  @RequirePermission('health_safety', 'create')
  @ApiOperation({ summary: 'Employee / mobile incident report' })
  async createIncidentAsEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateEmployeeIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.incidentsService.createForEmployee(employeeId, dto, user),
    };
  }

  // --- Injury log ---

  @Get('companies/:companyId/health-safety/injuries')
  @RequirePermission('health_safety', 'view')
  async listInjuries(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListInjuryLogQueryDto,
  ) {
    return { data: await this.injuryLogService.list(companyId, query) };
  }

  @Post('companies/:companyId/health-safety/injuries')
  @RequirePermission('health_safety', 'create')
  async createInjury(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateInjuryLogEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.injuryLogService.create(companyId, dto, user) };
  }

  // --- Compliance & inspections ---

  @Get('companies/:companyId/health-safety/compliance')
  @RequirePermission('health_safety', 'view')
  async listCompliance(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.complianceService.listCompliance(companyId) };
  }

  @Patch('health-safety/compliance/:id')
  @RequirePermission('health_safety', 'edit')
  async updateCompliance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSafetyComplianceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.complianceService.updateCompliance(id, dto, user) };
  }

  @Get('companies/:companyId/health-safety/inspections')
  @RequirePermission('health_safety', 'view')
  async listInspections(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.complianceService.listInspections(companyId) };
  }

  @Post('companies/:companyId/health-safety/inspections')
  @RequirePermission('health_safety', 'create')
  async createInspection(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateSafetyInspectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.complianceService.createInspection(companyId, dto, user),
    };
  }
}
