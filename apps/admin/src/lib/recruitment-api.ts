import type {
  ApplicationStage,
  CandidateRecord,
  CandidateSource,
  JobApplicationRecord,
  JobPostingRecord,
  JobRequisitionRecord,
  JobRequisitionStatus,
  OfferLetterRecord,
  OfferLetterTemplate,
} from '@hrm/shared-types';
import { ApiError, getTenantAccessToken, tenantApiRequest } from './tenant-api-client';

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

export interface RequisitionActionInput {
  comment?: string;
}

export interface HireApplicationInput {
  employeeNumber?: string;
  hireDate?: string;
}

export interface CreateJobPostingInput {
  requisitionId: string;
  title?: string;
  summary?: string;
  description?: string;
}

export interface CreateCandidateInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  source?: CandidateSource;
  yearsExperience?: number;
  notes?: string;
}

export interface CreateJobApplicationInput {
  candidateId: string;
  requisitionId: string;
  postingId?: string;
  stage?: ApplicationStage;
  coverLetter?: string;
}

export function listJobRequisitions(
  companyId: string,
  status?: JobRequisitionStatus,
): Promise<JobRequisitionRecord[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const qs = params.toString();
  return tenantApiRequest<JobRequisitionRecord[]>(
    `/companies/${companyId}/job-requisitions${qs ? `?${qs}` : ''}`,
  );
}

export function createJobRequisition(
  companyId: string,
  input: CreateJobRequisitionInput,
): Promise<JobRequisitionRecord> {
  return tenantApiRequest<JobRequisitionRecord>(
    `/companies/${companyId}/job-requisitions`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function submitJobRequisition(
  requisitionId: string,
): Promise<JobRequisitionRecord> {
  return tenantApiRequest<JobRequisitionRecord>(
    `/job-requisitions/${requisitionId}/submit`,
    { method: 'POST' },
  );
}

export function approveJobRequisition(
  requisitionId: string,
  input?: RequisitionActionInput,
): Promise<JobRequisitionRecord> {
  return tenantApiRequest<JobRequisitionRecord>(
    `/job-requisitions/${requisitionId}/approve`,
    { method: 'POST', body: JSON.stringify(input ?? {}) },
  );
}

export function rejectJobRequisition(
  requisitionId: string,
  input?: RequisitionActionInput,
): Promise<JobRequisitionRecord> {
  return tenantApiRequest<JobRequisitionRecord>(
    `/job-requisitions/${requisitionId}/reject`,
    { method: 'POST', body: JSON.stringify(input ?? {}) },
  );
}

export function openJobRequisition(
  requisitionId: string,
): Promise<JobRequisitionRecord> {
  return tenantApiRequest<JobRequisitionRecord>(
    `/job-requisitions/${requisitionId}/open`,
    { method: 'POST' },
  );
}

export function listJobPostings(
  companyId: string,
): Promise<JobPostingRecord[]> {
  return tenantApiRequest<JobPostingRecord[]>(
    `/companies/${companyId}/job-postings`,
  );
}

export function createJobPosting(
  companyId: string,
  input: CreateJobPostingInput,
): Promise<JobPostingRecord> {
  return tenantApiRequest<JobPostingRecord>(
    `/companies/${companyId}/job-postings`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function publishJobPosting(
  postingId: string,
): Promise<JobPostingRecord> {
  return tenantApiRequest<JobPostingRecord>(
    `/job-postings/${postingId}/publish`,
    { method: 'POST' },
  );
}

export function listCandidates(
  companyId: string,
  search?: string,
): Promise<CandidateRecord[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const qs = params.toString();
  return tenantApiRequest<CandidateRecord[]>(
    `/companies/${companyId}/candidates${qs ? `?${qs}` : ''}`,
  );
}

export function createCandidate(
  companyId: string,
  input: CreateCandidateInput,
): Promise<CandidateRecord> {
  return tenantApiRequest<CandidateRecord>(
    `/companies/${companyId}/candidates`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function listJobApplications(
  companyId: string,
  query?: { requisitionId?: string; stage?: ApplicationStage },
): Promise<JobApplicationRecord[]> {
  const params = new URLSearchParams();
  if (query?.requisitionId) params.set('requisitionId', query.requisitionId);
  if (query?.stage) params.set('stage', query.stage);
  const qs = params.toString();
  return tenantApiRequest<JobApplicationRecord[]>(
    `/companies/${companyId}/job-applications${qs ? `?${qs}` : ''}`,
  );
}

export function getJobApplication(
  applicationId: string,
): Promise<JobApplicationRecord> {
  return tenantApiRequest<JobApplicationRecord>(
    `/job-applications/${applicationId}`,
  );
}

export function createJobApplication(
  companyId: string,
  input: CreateJobApplicationInput,
): Promise<JobApplicationRecord> {
  return tenantApiRequest<JobApplicationRecord>(
    `/companies/${companyId}/job-applications`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateApplicationStage(
  applicationId: string,
  stage: ApplicationStage,
  rating?: number,
): Promise<JobApplicationRecord> {
  return tenantApiRequest<JobApplicationRecord>(
    `/job-applications/${applicationId}/stage`,
    { method: 'PATCH', body: JSON.stringify({ stage, rating }) },
  );
}

export function hireApplication(
  applicationId: string,
  input?: HireApplicationInput,
): Promise<JobApplicationRecord> {
  return tenantApiRequest<JobApplicationRecord>(
    `/job-applications/${applicationId}/hire`,
    { method: 'POST', body: JSON.stringify(input ?? {}) },
  );
}

export function listInterviewRounds(
  applicationId: string,
): Promise<import('@hrm/shared-types').InterviewRoundRecord[]> {
  return tenantApiRequest<import('@hrm/shared-types').InterviewRoundRecord[]>(
    `/job-applications/${applicationId}/interview-rounds`,
  );
}

export function initInterviewRounds(
  applicationId: string,
): Promise<import('@hrm/shared-types').InterviewRoundRecord[]> {
  return tenantApiRequest<import('@hrm/shared-types').InterviewRoundRecord[]>(
    `/job-applications/${applicationId}/interview-rounds/init`,
    { method: 'POST' },
  );
}

export interface ScheduleInterviewRoundInput {
  scheduledStartAt: string;
  scheduledEndAt?: string;
  location?: string;
  meetingUrl?: string;
  interviewerEmployeeId?: string;
}

export interface CompleteInterviewRoundInput {
  score: number;
  recommendation:
    | 'strong_yes'
    | 'yes'
    | 'neutral'
    | 'no'
    | 'strong_no';
  feedback?: string;
}

export function scheduleInterviewRound(
  roundId: string,
  input: ScheduleInterviewRoundInput,
): Promise<import('@hrm/shared-types').InterviewRoundRecord> {
  return tenantApiRequest<import('@hrm/shared-types').InterviewRoundRecord>(
    `/interview-rounds/${roundId}/schedule`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function completeInterviewRound(
  roundId: string,
  input: CompleteInterviewRoundInput,
): Promise<import('@hrm/shared-types').InterviewRoundRecord> {
  return tenantApiRequest<import('@hrm/shared-types').InterviewRoundRecord>(
    `/interview-rounds/${roundId}/complete`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function skipInterviewRound(
  roundId: string,
  feedback?: string,
): Promise<import('@hrm/shared-types').InterviewRoundRecord> {
  return tenantApiRequest<import('@hrm/shared-types').InterviewRoundRecord>(
    `/interview-rounds/${roundId}/skip`,
    { method: 'POST', body: JSON.stringify({ feedback }) },
  );
}

export async function uploadApplicationResume(
  applicationId: string,
  file: File,
): Promise<JobApplicationRecord['resume']> {
  const token = getTenantAccessToken();
  const formData = new FormData();
  formData.append('file', file);

  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}/job-applications/${applicationId}/resume`,
    { method: 'POST', headers, body: formData },
  );

  const body = (await response.json()) as {
    data?: JobApplicationRecord['resume'];
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new ApiError(
      body.error?.message ?? `Upload failed (${response.status})`,
      response.status,
    );
  }

  return body.data!;
}

export function getApplicationResumeFileUrl(
  applicationId: string,
): Promise<{ url: string; expiresInSeconds: number }> {
  return tenantApiRequest<{ url: string; expiresInSeconds: number }>(
    `/job-applications/${applicationId}/resume/file-url`,
  );
}

export function formatResumeSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface UpsertOfferLetterInput {
  template?: OfferLetterTemplate;
  jobTitle?: string;
  departmentId?: string | null;
  designationId?: string | null;
  employmentTypeId?: string | null;
  workLocationId?: string | null;
  annualSalary?: number;
  currency?: string;
  startDate?: string;
  reportingTo?: string;
  signingBonus?: number;
  equityNotes?: string;
  probationMonths?: number;
  expiryDate?: string | null;
  additionalTerms?: string;
}

export function getOfferLetter(applicationId: string): Promise<OfferLetterRecord> {
  return tenantApiRequest<OfferLetterRecord>(
    `/job-applications/${applicationId}/offer-letter`,
  );
}

export function updateOfferLetter(
  applicationId: string,
  input: UpsertOfferLetterInput,
): Promise<OfferLetterRecord> {
  return tenantApiRequest<OfferLetterRecord>(
    `/job-applications/${applicationId}/offer-letter`,
    { method: 'PUT', body: JSON.stringify(input) },
  );
}

export function generateOfferLetterPdf(
  offerLetterId: string,
): Promise<OfferLetterRecord> {
  return tenantApiRequest<OfferLetterRecord>(
    `/offer-letters/${offerLetterId}/generate`,
    { method: 'POST' },
  );
}

export function submitOfferLetter(offerLetterId: string): Promise<OfferLetterRecord> {
  return tenantApiRequest<OfferLetterRecord>(
    `/offer-letters/${offerLetterId}/submit`,
    { method: 'POST' },
  );
}

export function approveOfferLetter(
  offerLetterId: string,
  comment?: string,
): Promise<OfferLetterRecord> {
  return tenantApiRequest<OfferLetterRecord>(
    `/offer-letters/${offerLetterId}/approve`,
    { method: 'POST', body: JSON.stringify({ comment }) },
  );
}

export function rejectOfferLetter(
  offerLetterId: string,
  comment?: string,
): Promise<OfferLetterRecord> {
  return tenantApiRequest<OfferLetterRecord>(
    `/offer-letters/${offerLetterId}/reject`,
    { method: 'POST', body: JSON.stringify({ comment }) },
  );
}

export function sendOfferLetter(offerLetterId: string): Promise<OfferLetterRecord> {
  return tenantApiRequest<OfferLetterRecord>(
    `/offer-letters/${offerLetterId}/send`,
    { method: 'POST' },
  );
}

export function acceptOfferLetter(offerLetterId: string): Promise<OfferLetterRecord> {
  return tenantApiRequest<OfferLetterRecord>(
    `/offer-letters/${offerLetterId}/accept`,
    { method: 'POST' },
  );
}

export async function downloadOfferLetterPdf(offerLetterId: string): Promise<void> {
  const token = getTenantAccessToken();
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}/offer-letters/${offerLetterId}/download`,
    { headers },
  );

  if (!response.ok) {
    const body = (await response.json()) as { error?: { message?: string } };
    throw new ApiError(
      body.error?.message ?? `Download failed (${response.status})`,
      response.status,
    );
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  URL.revokeObjectURL(url);
}
