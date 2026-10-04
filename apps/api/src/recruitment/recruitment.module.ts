import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { EmployeesModule } from '../employees/employees.module';
import { OrganizationModule } from '../organization/organization.module';
import { RbacModule } from '../rbac/rbac.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApplicationInterviewRoundsService } from './application-interview-rounds.service';
import { CandidateDocumentsService } from './candidate-documents.service';
import { CandidateNotesService } from './candidate-notes.service';
import { CandidatesService } from './candidates.service';
import { JobApplicationsService } from './job-applications.service';
import { JobPostingsService } from './job-postings.service';
import { JobRequisitionWorkflowService } from './job-requisition-workflow.service';
import { JobRequisitionsService } from './job-requisitions.service';
import { OfferLetterWorkflowService } from './offer-letter-workflow.service';
import { OfferLettersService } from './offer-letters.service';
import { RecruitmentController } from './recruitment.controller';

@Module({
  imports: [
    PrismaModule,
    OrganizationModule,
    StorageModule,
    AuditModule,
    WorkflowModule,
    EmployeesModule,
    OnboardingModule,
    SettingsModule,
    RbacModule,
    NotificationsModule,
  ],
  controllers: [RecruitmentController],
  providers: [
    JobRequisitionsService,
    JobRequisitionWorkflowService,
    JobPostingsService,
    CandidatesService,
    CandidateNotesService,
    CandidateDocumentsService,
    ApplicationInterviewRoundsService,
    OfferLetterWorkflowService,
    OfferLettersService,
    JobApplicationsService,
  ],
  exports: [
    JobRequisitionsService,
    JobPostingsService,
    CandidatesService,
    JobApplicationsService,
  ],
})
export class RecruitmentModule {}
