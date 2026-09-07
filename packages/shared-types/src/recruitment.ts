export type JobRequisitionStatus =
  | 'draft'
  | 'pending_approval'
  | 'open'
  | 'closed'
  | 'cancelled';

export type JobPostingStatus = 'draft' | 'published' | 'closed';

export type CandidateSource =
  | 'referral'
  | 'linkedin'
  | 'job_board'
  | 'agency'
  | 'website'
  | 'other';

export type ApplicationStage =
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'withdrawn';

export interface JobRequisitionRecord {
  id: string;
  tenantId: string;
  companyId: string;
  referenceNumber: string;
  title: string;
  departmentId: string | null;
  departmentName?: string;
  designationId: string | null;
  designationName?: string;
  jobLevelId: string | null;
  jobLevelName?: string;
  employmentTypeId: string | null;
  employmentTypeName?: string;
  locationId: string | null;
  locationName?: string;
  description: string;
  headcount: number;
  status: JobRequisitionStatus;
  displayStatus: string;
  requestedByEmployeeId: string | null;
  requestedByName?: string;
  openedAt: string | null;
  closedAt: string | null;
  posting: JobPostingRecord | null;
  applicationCount?: number;
  workflow: import('./workflow').WorkflowInstanceRecord | null;
  createdAt: string;
  updatedAt: string;
}

export type OfferLetterStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'cancelled';

export type OfferLetterTemplate =
  | 'standard'
  | 'senior'
  | 'contract'
  | 'remote';

export interface OfferLetterRecord {
  id: string;
  tenantId: string;
  companyId: string;
  applicationId: string;
  candidateName?: string;
  status: OfferLetterStatus;
  displayStatus: string;
  template: OfferLetterTemplate;
  templateLabel: string;
  jobTitle: string;
  departmentId: string | null;
  departmentName?: string;
  designationId: string | null;
  designationName?: string;
  employmentTypeId: string | null;
  employmentTypeName?: string;
  workLocationId: string | null;
  workLocationName?: string;
  annualSalary: number | null;
  currency: string;
  startDate: string;
  reportingTo: string | null;
  signingBonus: number | null;
  equityNotes: string | null;
  probationMonths: number | null;
  expiryDate: string | null;
  additionalTerms: string | null;
  fileKey: string | null;
  generatedAt: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  downloadUrl?: string;
  workflow: import('./workflow').WorkflowInstanceRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobPostingRecord {
  id: string;
  tenantId: string;
  companyId: string;
  requisitionId: string;
  title: string;
  summary: string | null;
  description: string;
  status: JobPostingStatus;
  displayStatus: string;
  publishedAt: string | null;
  closedAt: string | null;
  expiresAt: string | null;
  requisitionTitle?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateRecord {
  id: string;
  tenantId: string;
  companyId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  source: CandidateSource;
  yearsExperience: number | null;
  notes: string | null;
  applicationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobApplicationResumeRecord {
  id: string;
  applicationId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface JobApplicationRecord {
  id: string;
  tenantId: string;
  companyId: string;
  candidateId: string;
  candidateName?: string;
  candidateEmail?: string;
  requisitionId: string;
  requisitionTitle?: string;
  requisitionReference?: string;
  postingId: string | null;
  stage: ApplicationStage;
  displayStage: string;
  rating: number | null;
  coverLetter: string | null;
  appliedAt: string;
  stageUpdatedAt: string;
  hiredEmployeeId: string | null;
  resume: JobApplicationResumeRecord | null;
  yearsExperience?: number | null;
  interviewRounds?: InterviewRoundRecord[];
  offerLetter?: OfferLetterRecord | null;
  createdAt: string;
  updatedAt: string;
}

export type InterviewRoundType =
  | 'technical'
  | 'hr'
  | 'management'
  | 'final_decision';

export type InterviewRoundStatus =
  | 'pending'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'skipped';

export type InterviewRecommendation =
  | 'strong_yes'
  | 'yes'
  | 'neutral'
  | 'no'
  | 'strong_no';

export interface InterviewRoundRecord {
  id: string;
  tenantId: string;
  companyId: string;
  applicationId: string;
  roundType: InterviewRoundType;
  roundOrder: number;
  displayRound: string;
  status: InterviewRoundStatus;
  displayStatus: string;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  location: string | null;
  meetingUrl: string | null;
  interviewerEmployeeId: string | null;
  interviewerName?: string;
  score: number | null;
  recommendation: InterviewRecommendation | null;
  displayRecommendation: string | null;
  feedback: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
