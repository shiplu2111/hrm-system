import {
  Body,
  Controller,
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
import type {
  CreateDisciplinaryActionDto,
  CreateHrCaseDto,
  CreateHrCaseNoteDto,
  CreateInvestigationRecordDto,
  ListHrCasesQueryDto,
  RevealHrCaseFieldDto,
  TransitionHrCaseStatusDto,
  UpdateHrCaseDto,
  UpsertHrCasePartiesDto,
} from './dto/employee-relations.dto';
import { HrCasesService } from './hr-cases.service';

@ApiTags('employee-relations')
@ApiBearerAuth('access-token')
@Controller()
export class EmployeeRelationsController {
  constructor(private readonly hrCasesService: HrCasesService) {}

  @Get('companies/:companyId/employee-relations/summary')
  @RequirePermission('employee_relations', 'view')
  @ApiOperation({ summary: 'Employee relations dashboard summary' })
  async summary(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.hrCasesService.getSummary(companyId) };
  }

  @Get('companies/:companyId/employee-relations/cases')
  @RequirePermission('employee_relations', 'view')
  async listCases(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListHrCasesQueryDto,
  ) {
    return { data: await this.hrCasesService.listCases(companyId, query) };
  }

  @Post('companies/:companyId/employee-relations/cases')
  @RequirePermission('employee_relations', 'create')
  async createCase(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateHrCaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.hrCasesService.createCase(companyId, dto, user) };
  }

  @Get('employee-relations/cases/:caseId')
  @RequirePermission('employee_relations', 'view')
  async getCase(@Param('caseId', ParseUUIDPipe) caseId: string) {
    return { data: await this.hrCasesService.getCaseDetail(caseId) };
  }

  @Patch('employee-relations/cases/:caseId')
  @RequirePermission('employee_relations', 'edit')
  async updateCase(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: UpdateHrCaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.hrCasesService.updateCase(caseId, dto, user) };
  }

  @Post('employee-relations/cases/:caseId/transition')
  @RequirePermission('employee_relations', 'edit')
  @ApiOperation({ summary: 'Transition HR case status (Open → Investigating → Resolved → Closed)' })
  async transitionStatus(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: TransitionHrCaseStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.hrCasesService.transitionStatus(caseId, dto, user) };
  }

  @Post('employee-relations/cases/:caseId/reveal')
  @RequirePermission('employee_relations', 'view')
  @ApiOperation({ summary: 'Reveal encrypted confidential field (audited)' })
  async revealField(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: RevealHrCaseFieldDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.hrCasesService.revealField(caseId, dto, user) };
  }

  @Post('employee-relations/cases/:caseId/notes')
  @RequirePermission('employee_relations', 'edit')
  async addNote(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateHrCaseNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.hrCasesService.addNote(caseId, dto, user) };
  }

  @Post('employee-relations/cases/:caseId/disciplinary-actions')
  @RequirePermission('employee_relations', 'edit')
  async addDisciplinaryAction(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateDisciplinaryActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.hrCasesService.addDisciplinaryAction(caseId, dto, user),
    };
  }

  @Post('employee-relations/cases/:caseId/investigation-records')
  @RequirePermission('employee_relations', 'edit')
  @ApiOperation({ summary: 'Add investigation record (interview, evidence, finding, etc.)' })
  async addInvestigationRecord(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CreateInvestigationRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.hrCasesService.addInvestigationRecord(caseId, dto, user),
    };
  }

  @Put('employee-relations/cases/:caseId/parties')
  @RequirePermission('employee_relations', 'edit')
  async replaceParties(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: UpsertHrCasePartiesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.hrCasesService.replaceParties(caseId, dto, user) };
  }
}
