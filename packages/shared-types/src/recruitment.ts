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

/** Active pipeline stages, in board order. `hired` is only reachable via the hire endpoint. */
export const APPLICATION_PIPELINE_STAGES: readonly ApplicationStage[] = [
  'applied',
  'screening',
  'interview',
  'offer',
  'hired',
];

export const APPLICATION_CLOSED_STAGES: readonly ApplicationStage[] = [
  'rejected',
  'withdrawn',
];

export interface CreateJobRequisitionInput {
  title: string;
  departmentId?: string;
  designationId?: string;
  jobLevelId?: string;
  employmentTypeId?: string;
  locationId?: string;
  description: string;
  headcount?: number;
  requestedByEmployeeId?: string;
}

export interface UpdateJobRequisitionInput {
  title?: string;
  departmentId?: string | null;
  designationId?: string | null;
  jobLevelId?: string | null;
  employmentTypeId?: string | null;
  locationId?: string | null;
  description?: string;
  headcount?: number;
  requestedByEmployeeId?: string | null;
}

export interface RecruitmentLookupOption {
  id: string;
  name: string;
}

export interface RecruitmentLookups {
  departments: RecruitmentLookupOption[];
  designations: (RecruitmentLookupOption & { departmentId: string | null })[];
  jobLevels: RecruitmentLookupOption[];
  employmentTypes: RecruitmentLookupOption[];
  locations: RecruitmentLookupOption[];
  employees: (RecruitmentLookupOption & { employeeNumber: string })[];
}

export interface UpdateCandidateInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  source?: CandidateSource;
  yearsExperience?: number | null;
  notes?: string | null;
}

export interface CandidateNoteRecord {
  id: string;
  candidateId: string;
  applicationId: string | null;
  applicationLabel: string | null;
  body: string;
  authorUserId: string | null;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCandidateNoteInput {
  body: string;
  applicationId?: string;
}

export interface CandidateDocumentRecord {
  id: string;
  candidateId: string;
  label: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  uploadedByName: string | null;
  uploadedAt: string;
}

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

export interface OfferLetterTemplateClause {
  title: string;
  body: string;
}

/**
 * Letter content per template. Text fields accept `{{placeholders}}` resolved by
 * `renderOfferTemplateText` — the API PDF generator and the admin preview share this.
 */
export interface OfferLetterTemplateDefinition {
  key: OfferLetterTemplate;
  label: string;
  description: string;
  intro: string;
  salaryLabel: string;
  showEquity: boolean;
  showProbation: boolean;
  clauses: OfferLetterTemplateClause[];
}

export const OFFER_LETTER_TEMPLATES: Record<OfferLetterTemplate, OfferLetterTemplateDefinition> = {
  standard: {
    key: 'standard',
    label: 'Standard Offer Letter',
    description: 'Permanent role with probation, standard notice and confidentiality terms.',
    intro:
      'We are pleased to offer you the position of {{jobTitle}} at {{companyName}}, commencing on {{startDate}}. We believe your skills and experience will be a strong match for our team.',
    salaryLabel: 'Annual Salary',
    showEquity: true,
    showProbation: true,
    clauses: [
      {
        title: 'Hours and leave',
        body: 'Your ordinary hours of work and leave entitlements follow company policy and applicable employment law.',
      },
      {
        title: 'Confidentiality',
        body: 'You agree to keep confidential all non-public information about {{companyName}}, its clients and its people, during and after your employment.',
      },
      {
        title: 'Notice',
        body: 'After any probation period, either party may end the employment by giving notice in line with company policy and applicable law.',
      },
    ],
  },
  senior: {
    key: 'senior',
    label: 'Senior Role Offer',
    description: 'Leadership role with equity, restraint and a three-month notice period.',
    intro:
      'On behalf of the leadership team, we are delighted to offer you the senior role of {{jobTitle}} at {{companyName}}, commencing on {{startDate}}. In this position you will help shape the direction of the business and lead others to deliver it.',
    salaryLabel: 'Base Salary',
    showEquity: true,
    showProbation: true,
    clauses: [
      {
        title: 'Leadership responsibilities',
        body: 'You will be accountable for the performance of your function and for developing the people who report to you.',
      },
      {
        title: 'Confidentiality and restraint',
        body: 'You agree to keep company information confidential and to observe the reasonable post-employment restrictions set out in your employment agreement.',
      },
      {
        title: 'Notice period',
        body: 'Given the seniority of this role, a notice period of three months applies to either party once probation is complete.',
      },
    ],
  },
  contract: {
    key: 'contract',
    label: 'Contract Offer',
    description: 'Fixed-term engagement — term and extension options go in Additional Terms.',
    intro:
      'We are pleased to offer you a fixed-term engagement as {{jobTitle}} with {{companyName}}, commencing on {{startDate}}. The engagement term and any extension options are set out under Additional Terms.',
    salaryLabel: 'Contract Remuneration (annualised)',
    showEquity: false,
    showProbation: false,
    clauses: [
      {
        title: 'Term of engagement',
        body: 'This engagement ends on the date set out in the Additional Terms unless extended in writing. It does not create an expectation of ongoing employment.',
      },
      {
        title: 'Deliverables',
        body: 'You will deliver the outcomes agreed with your manager and keep them informed of progress and risks.',
      },
      {
        title: 'Confidentiality and intellectual property',
        body: 'Work you produce during the engagement belongs to {{companyName}}, and you agree to keep company information confidential.',
      },
    ],
  },
  remote: {
    key: 'remote',
    label: 'Remote Worker Offer',
    description: 'Home-based role with workspace, equipment and travel terms.',
    intro:
      'We are pleased to offer you the remote position of {{jobTitle}} at {{companyName}}, commencing on {{startDate}}. You will work primarily from your home location while collaborating closely with the wider team.',
    salaryLabel: 'Annual Salary',
    showEquity: true,
    showProbation: true,
    clauses: [
      {
        title: 'Remote working',
        body: 'You agree to maintain a safe, suitable workspace and to be reachable during the core hours agreed with your manager.',
      },
      {
        title: 'Equipment',
        body: '{{companyName}} will provide the equipment you need to do your job. It remains company property and must be returned when your employment ends.',
      },
      {
        title: 'Travel',
        body: 'Occasional travel to a company office or team event may be required. Approved travel costs are reimbursed.',
      },
    ],
  },
};

export const OFFER_LETTER_TEMPLATE_KEYS = Object.keys(OFFER_LETTER_TEMPLATES) as OfferLetterTemplate[];

/** Replaces `{{key}}` tokens; unknown or empty values render as an empty string. */
export function renderOfferTemplateText(
  text: string,
  vars: Record<string, string | null | undefined>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key]?.trim() ?? '');
}

export interface OfferApprovalRouteStep {
  order: number;
  assigneeType: import('./workflow').WorkflowAssigneeType;
  roleName: string;
}

/** Which approval chain an offer letter goes through (Settings → Approval Workflows). */
export interface OfferApprovalRoute {
  definitionId: string | null;
  name: string;
  /** `system_default` when no active offer-letter workflow is configured for the company. */
  source: 'workflow_builder' | 'system_default';
  steps: OfferApprovalRouteStep[];
}

export interface OfferLetterRecord {
  id: string;
  tenantId: string;
  companyId: string;
  companyName?: string;
  applicationId: string;
  candidateName?: string;
  candidateEmail?: string | null;
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
  declineReason: string | null;
  downloadUrl?: string;
  workflow: import('./workflow').WorkflowInstanceRecord | null;
  approvalRoute: OfferApprovalRoute;
  createdAt: string;
  updatedAt: string;
}

export interface DeclineOfferLetterInput {
  reason?: string;
}

/** Add Employee form defaults derived from the candidate and their accepted offer. */
export interface CandidateHirePrefill {
  applicationId: string;
  companyId: string;
  offerLetterId: string;
  candidateName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  /** Next free employee number; editable in the form. */
  employeeNumber: string;
  hireDate: string;
  jobTitle: string;
  departmentId: string | null;
  designationId: string | null;
  employmentTypeId: string | null;
  workLocationId: string | null;
  /** Employee matched by name from the offer's "Reporting to" text, if any. */
  managerId: string | null;
  reportingTo: string | null;
  probationEndDate: string | null;
  annualSalary: number | null;
  currency: string;
  signingBonus: number | null;
}

/** Body for `POST job-applications/:id/hire`; omitted fields fall back to the accepted offer. */
export interface HireApplicationInput {
  employeeNumber?: string;
  hireDate?: string;
  firstName?: string;
  lastName?: string;
  employmentStatus?: import('./employee').EmploymentStatus;
  departmentId?: string | null;
  designationId?: string | null;
  employmentTypeId?: string | null;
  workLocationId?: string | null;
  managerId?: string | null;
  costCentreId?: string | null;
  probationEndDate?: string | null;
  confirmationDate?: string | null;
  personalInfo?: import('./employee').EmployeePersonalInfo;
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
  candidatePhone?: string | null;
  candidateSource?: CandidateSource;
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
  scorecard: InterviewScorecard | null;
  completedAt: string | null;
  completedByUserId: string | null;
  completedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export const INTERVIEW_RECOMMENDATIONS: ReadonlyArray<{
  value: InterviewRecommendation;
  label: string;
}> = [
  { value: 'strong_yes', label: 'Strong Yes' },
  { value: 'yes', label: 'Yes' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'no', label: 'No' },
  { value: 'strong_no', label: 'Strong No' },
];

export const INTERVIEW_RATING_MIN = 1;
export const INTERVIEW_RATING_MAX = 5;

export interface InterviewScorecardCriterion {
  key: string;
  label: string;
  description: string;
}

/** Competencies rated 1–5 on each round's scorecard (MODULES.md §07 multi-round interview). */
export const INTERVIEW_SCORECARD_CRITERIA: Record<
  InterviewRoundType,
  ReadonlyArray<InterviewScorecardCriterion>
> = {
  technical: [
    { key: 'problem_solving', label: 'Problem solving', description: 'Breaks problems down and reasons to a working solution.' },
    { key: 'technical_depth', label: 'Technical depth', description: 'Command of the core skills and tools the role needs.' },
    { key: 'code_quality', label: 'Quality of work', description: 'Correct, readable, maintainable output.' },
    { key: 'system_design', label: 'Design thinking', description: 'Considers trade-offs, scale and edge cases.' },
    { key: 'learning_agility', label: 'Learning agility', description: 'Picks up new concepts and feedback quickly.' },
  ],
  hr: [
    { key: 'communication', label: 'Communication', description: 'Clear, structured and honest answers.' },
    { key: 'culture_alignment', label: 'Culture & values', description: 'Behaviour aligns with company values.' },
    { key: 'motivation', label: 'Motivation', description: 'Genuine interest in the role and company.' },
    { key: 'teamwork', label: 'Teamwork', description: 'Collaborates and handles conflict constructively.' },
    { key: 'expectations_alignment', label: 'Expectations alignment', description: 'Salary, notice period and working terms fit.' },
  ],
  management: [
    { key: 'leadership', label: 'Leadership', description: 'Guides and motivates others toward outcomes.' },
    { key: 'ownership', label: 'Ownership', description: 'Takes responsibility end to end.' },
    { key: 'strategic_thinking', label: 'Strategic thinking', description: 'Connects day-to-day work to business goals.' },
    { key: 'stakeholder_management', label: 'Stakeholder management', description: 'Manages expectations across teams.' },
    { key: 'decision_making', label: 'Decision making', description: 'Makes sound calls with incomplete information.' },
  ],
  final_decision: [
    { key: 'role_fit', label: 'Overall role fit', description: 'Meets the requirements of the requisition.' },
    { key: 'growth_potential', label: 'Growth potential', description: 'Can grow into larger responsibilities.' },
    { key: 'team_impact', label: 'Team impact', description: 'Will strengthen the team they join.' },
    { key: 'compensation_fit', label: 'Compensation fit', description: 'Offer expectations fit the approved budget.' },
  ],
};

export interface InterviewScorecardRating {
  key: string;
  rating: number;
  comment?: string | null;
}

export interface InterviewScorecard {
  ratings: InterviewScorecardRating[];
  strengths: string | null;
  concerns: string | null;
}

/** Round score = mean of criterion ratings, one decimal place. */
export function interviewScorecardAverage(
  ratings: ReadonlyArray<Pick<InterviewScorecardRating, 'rating'>>,
): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

export interface ScheduleInterviewRoundInput {
  scheduledStartAt: string;
  scheduledEndAt?: string;
  location?: string;
  meetingUrl?: string;
  interviewerEmployeeId?: string;
  /** Book even if the interviewer already has an overlapping interview. */
  allowConflict?: boolean;
}

export interface CompleteInterviewRoundInput {
  /** Required when no scorecard ratings are given; otherwise derived from them. */
  score?: number;
  recommendation: InterviewRecommendation;
  feedback?: string;
  ratings?: InterviewScorecardRating[];
  strengths?: string;
  concerns?: string;
}

export interface CancelInterviewRoundInput {
  reason?: string;
}

/** A round enriched with candidate/requisition context for the interview schedule. */
export interface InterviewScheduleItem extends InterviewRoundRecord {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  requisitionId: string;
  requisitionTitle: string;
  requisitionReference: string;
  applicationStage: ApplicationStage;
  hasResume: boolean;
}

export interface InterviewScheduleQuery {
  from?: string;
  to?: string;
  status?: InterviewRoundStatus;
  interviewerEmployeeId?: string;
  requisitionId?: string;
  /** Pending rounds that are next in line for an application at the interview stage. */
  needsScheduling?: boolean;
}
