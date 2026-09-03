import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CompanyScopeService } from './company-scope.service';
import {
  CreateCostCentreDto,
  CreateDepartmentDto,
  CreateDesignationDto,
  CreateJobLevelDto,
  CreateNamedEntityDto,
  UpdateCostCentreDto,
  UpdateDepartmentDto,
  UpdateDesignationDto,
  UpdateJobLevelDto,
  UpdateNamedEntityDto,
} from './dto/organization.dto';
import { OrganizationService } from './organization.service';

@ApiTags('organization')
@ApiBearerAuth('access-token')
@Controller('organization')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  @Get('companies')
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'List companies for the authenticated tenant' })
  async listCompanies() {
    return { data: await this.companyScope.listCompanies() };
  }

  // Departments
  @Get('companies/:companyId/departments')
  @RequirePermission('settings', 'view')
  async listDepartments(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return { data: await this.organizationService.listDepartments(companyId) };
  }

  @Get('companies/:companyId/departments/tree')
  @RequirePermission('settings', 'view')
  async getDepartmentTree(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return {
      data: await this.organizationService.getDepartmentTree(companyId),
    };
  }

  @Post('companies/:companyId/departments')
  @RequirePermission('settings', 'create')
  async createDepartment(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    return {
      data: await this.organizationService.createDepartment(companyId, dto),
    };
  }

  @Patch('companies/:companyId/departments/:id')
  @RequirePermission('settings', 'edit')
  async updateDepartment(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return {
      data: await this.organizationService.updateDepartment(companyId, id, dto),
    };
  }

  @Delete('companies/:companyId/departments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('settings', 'delete')
  async deleteDepartment(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.organizationService.deleteDepartment(companyId, id);
  }

  // Job levels
  @Get('companies/:companyId/job-levels')
  @RequirePermission('settings', 'view')
  async listJobLevels(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.organizationService.listJobLevels(companyId) };
  }

  @Post('companies/:companyId/job-levels')
  @RequirePermission('settings', 'create')
  async createJobLevel(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateJobLevelDto,
  ) {
    return { data: await this.organizationService.createJobLevel(companyId, dto) };
  }

  @Patch('companies/:companyId/job-levels/:id')
  @RequirePermission('settings', 'edit')
  async updateJobLevel(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobLevelDto,
  ) {
    return {
      data: await this.organizationService.updateJobLevel(companyId, id, dto),
    };
  }

  @Delete('companies/:companyId/job-levels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('settings', 'delete')
  async deleteJobLevel(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.organizationService.deleteJobLevel(companyId, id);
  }

  // Designations
  @Get('companies/:companyId/designations')
  @RequirePermission('settings', 'view')
  async listDesignations(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return { data: await this.organizationService.listDesignations(companyId) };
  }

  @Post('companies/:companyId/designations')
  @RequirePermission('settings', 'create')
  async createDesignation(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateDesignationDto,
  ) {
    return {
      data: await this.organizationService.createDesignation(companyId, dto),
    };
  }

  @Patch('companies/:companyId/designations/:id')
  @RequirePermission('settings', 'edit')
  async updateDesignation(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDesignationDto,
  ) {
    return {
      data: await this.organizationService.updateDesignation(companyId, id, dto),
    };
  }

  @Delete('companies/:companyId/designations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('settings', 'delete')
  async deleteDesignation(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.organizationService.deleteDesignation(companyId, id);
  }

  // Employment types
  @Get('companies/:companyId/employment-types')
  @RequirePermission('settings', 'view')
  async listEmploymentTypes(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return {
      data: await this.organizationService.listEmploymentTypes(companyId),
    };
  }

  @Post('companies/:companyId/employment-types')
  @RequirePermission('settings', 'create')
  async createEmploymentType(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateNamedEntityDto,
  ) {
    return {
      data: await this.organizationService.createEmploymentType(companyId, dto),
    };
  }

  @Patch('companies/:companyId/employment-types/:id')
  @RequirePermission('settings', 'edit')
  async updateEmploymentType(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNamedEntityDto,
  ) {
    return {
      data: await this.organizationService.updateEmploymentType(
        companyId,
        id,
        dto,
      ),
    };
  }

  @Delete('companies/:companyId/employment-types/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('settings', 'delete')
  async deleteEmploymentType(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.organizationService.deleteEmploymentType(companyId, id);
  }

  // Teams
  @Get('companies/:companyId/teams')
  @RequirePermission('settings', 'view')
  async listTeams(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.organizationService.listTeams(companyId) };
  }

  @Post('companies/:companyId/teams')
  @RequirePermission('settings', 'create')
  async createTeam(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateNamedEntityDto,
  ) {
    return { data: await this.organizationService.createTeam(companyId, dto) };
  }

  @Patch('companies/:companyId/teams/:id')
  @RequirePermission('settings', 'edit')
  async updateTeam(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNamedEntityDto,
  ) {
    return { data: await this.organizationService.updateTeam(companyId, id, dto) };
  }

  @Delete('companies/:companyId/teams/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('settings', 'delete')
  async deleteTeam(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.organizationService.deleteTeam(companyId, id);
  }

  // Cost centres
  @Get('companies/:companyId/cost-centres')
  @RequirePermission('settings', 'view')
  async listCostCentres(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return { data: await this.organizationService.listCostCentres(companyId) };
  }

  @Post('companies/:companyId/cost-centres')
  @RequirePermission('settings', 'create')
  async createCostCentre(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCostCentreDto,
  ) {
    return {
      data: await this.organizationService.createCostCentre(companyId, dto),
    };
  }

  @Patch('companies/:companyId/cost-centres/:id')
  @RequirePermission('settings', 'edit')
  async updateCostCentre(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCostCentreDto,
  ) {
    return {
      data: await this.organizationService.updateCostCentre(companyId, id, dto),
    };
  }

  @Delete('companies/:companyId/cost-centres/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('settings', 'delete')
  async deleteCostCentre(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.organizationService.deleteCostCentre(companyId, id);
  }
}
