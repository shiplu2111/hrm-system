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
  CreateTrainingCourseDto,
  CreateTrainingSessionCostDto,
  CreateTrainingSessionDto,
  ListTrainingAttendanceQueryDto,
  ListTrainingCoursesQueryDto,
  ListTrainingSessionsQueryDto,
  RegisterTrainingAttendanceDto,
  UpdateTrainingAttendanceDto,
  UpdateTrainingCourseDto,
  UpdateTrainingSessionCostDto,
  UpdateTrainingSessionDto,
  CreateSkillDto,
  UpdateSkillDto,
  ListSkillsQueryDto,
  ListEmployeeSkillsQueryDto,
  UpsertEmployeeSkillDto,
  UpdateEmployeeSkillDto,
  ListCertificationsQueryDto,
  CreateEmployeeCertificationDto,
  UpdateEmployeeCertificationDto,
} from './dto/training.dto';
import { TrainingSessionsService } from './training-sessions.service';
import { TrainingService } from './training.service';
import { TrainingCertificationsService } from './training-certifications.service';
import { TrainingSkillsService } from './training-skills.service';
import { CertificationExpiryAlertsService } from './certification-expiry-alerts.service';

@ApiTags('training')
@ApiBearerAuth('access-token')
@Controller()
export class TrainingController {
  constructor(
    private readonly trainingService: TrainingService,
    private readonly trainingSessionsService: TrainingSessionsService,
    private readonly trainingCertificationsService: TrainingCertificationsService,
    private readonly trainingSkillsService: TrainingSkillsService,
  ) {}

  @Get('companies/:companyId/training/summary')
  @RequirePermission('training', 'view')
  @ApiOperation({ summary: 'Training dashboard summary' })
  async summary(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.trainingService.getSummary(companyId) };
  }

  @Get('companies/:companyId/training/courses')
  @RequirePermission('training', 'view')
  async listCourses(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListTrainingCoursesQueryDto,
  ) {
    return { data: await this.trainingService.listCourses(companyId, query) };
  }

  @Post('companies/:companyId/training/courses')
  @RequirePermission('training', 'create')
  async createCourse(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateTrainingCourseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.trainingService.createCourse(companyId, dto, user),
    };
  }

  @Patch('training/courses/:courseId')
  @RequirePermission('training', 'edit')
  async updateCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: UpdateTrainingCourseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.trainingService.updateCourse(courseId, dto, user),
    };
  }

  @Get('companies/:companyId/training/sessions')
  @RequirePermission('training', 'view')
  async listSessions(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListTrainingSessionsQueryDto,
  ) {
    return {
      data: await this.trainingSessionsService.listSessions(companyId, query),
    };
  }

  @Post('companies/:companyId/training/sessions')
  @RequirePermission('training', 'create')
  async createSession(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateTrainingSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.trainingSessionsService.createSession(companyId, dto, user),
    };
  }

  @Patch('training/sessions/:sessionId')
  @RequirePermission('training', 'edit')
  async updateSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: UpdateTrainingSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.trainingSessionsService.updateSession(sessionId, dto, user),
    };
  }

  @Post('training/sessions/:sessionId/costs')
  @RequirePermission('training', 'edit')
  async addSessionCost(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CreateTrainingSessionCostDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.trainingSessionsService.addSessionCost(sessionId, dto, user),
    };
  }

  @Patch('training/session-costs/:costId')
  @RequirePermission('training', 'edit')
  async updateSessionCost(
    @Param('costId', ParseUUIDPipe) costId: string,
    @Body() dto: UpdateTrainingSessionCostDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.trainingSessionsService.updateSessionCost(costId, dto, user),
    };
  }

  @Delete('training/session-costs/:costId')
  @RequirePermission('training', 'edit')
  async deleteSessionCost(
    @Param('costId', ParseUUIDPipe) costId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.trainingSessionsService.deleteSessionCost(costId, user);
    return { data: { deleted: true } };
  }

  @Get('companies/:companyId/training/attendance')
  @RequirePermission('training', 'view')
  async listAttendance(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListTrainingAttendanceQueryDto,
  ) {
    return {
      data: await this.trainingSessionsService.listAttendance(companyId, query),
    };
  }

  @Post('training/sessions/:sessionId/attendance')
  @RequirePermission('training', 'edit')
  async registerAttendance(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: RegisterTrainingAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.trainingSessionsService.registerAttendance(sessionId, dto, user),
    };
  }

  @Patch('training/attendance/:attendanceId')
  @RequirePermission('training', 'edit')
  async updateAttendance(
    @Param('attendanceId', ParseUUIDPipe) attendanceId: string,
    @Body() dto: UpdateTrainingAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.trainingSessionsService.updateAttendance(attendanceId, dto, user),
    };
  }

  @Get('companies/:companyId/training/skills')
  @RequirePermission('training', 'view')
  async listSkills(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListSkillsQueryDto,
  ) {
    return { data: await this.trainingSkillsService.listSkills(companyId, query) };
  }

  @Post('companies/:companyId/training/skills')
  @RequirePermission('training', 'create')
  async createSkill(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateSkillDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.trainingSkillsService.createSkill(companyId, dto, user),
    };
  }

  @Patch('training/skills/:skillId')
  @RequirePermission('training', 'edit')
  async updateSkill(
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @Body() dto: UpdateSkillDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.trainingSkillsService.updateSkill(skillId, dto, user) };
  }

  @Get('companies/:companyId/training/employee-skills')
  @RequirePermission('training', 'view')
  async listEmployeeSkills(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListEmployeeSkillsQueryDto,
  ) {
    return {
      data: await this.trainingSkillsService.listEmployeeSkills(companyId, query),
    };
  }

  @Post('companies/:companyId/training/employee-skills')
  @RequirePermission('training', 'edit')
  async upsertEmployeeSkill(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpsertEmployeeSkillDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.trainingSkillsService.upsertEmployeeSkill(companyId, dto, user),
    };
  }

  @Patch('training/employee-skills/:assignmentId')
  @RequirePermission('training', 'edit')
  async updateEmployeeSkill(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: UpdateEmployeeSkillDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.trainingSkillsService.updateEmployeeSkill(assignmentId, dto, user),
    };
  }

  @Delete('training/employee-skills/:assignmentId')
  @RequirePermission('training', 'edit')
  async deleteEmployeeSkill(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.trainingSkillsService.deleteEmployeeSkill(assignmentId, user);
    return { data: { deleted: true } };
  }

  @Get('companies/:companyId/training/certifications')
  @RequirePermission('training', 'view')
  async listCertifications(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListCertificationsQueryDto,
  ) {
    return {
      data: await this.trainingCertificationsService.listCertifications(companyId, query),
    };
  }

  @Post('companies/:companyId/training/certifications')
  @RequirePermission('training', 'create')
  async createCertification(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateEmployeeCertificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.trainingCertificationsService.createCertification(companyId, dto, user),
    };
  }

  @Patch('training/certifications/:certificationId')
  @RequirePermission('training', 'edit')
  async updateCertification(
    @Param('certificationId', ParseUUIDPipe) certificationId: string,
    @Body() dto: UpdateEmployeeCertificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.trainingCertificationsService.updateCertification(
        certificationId,
        dto,
        user,
      ),
    };
  }

  @Delete('training/certifications/:certificationId')
  @RequirePermission('training', 'edit')
  async deleteCertification(
    @Param('certificationId', ParseUUIDPipe) certificationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.trainingCertificationsService.deleteCertification(certificationId, user);
    return { data: { deleted: true } };
  }
}
