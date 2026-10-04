import type {
  ApplicationStage,
  CandidateHirePrefill,
  CandidateDocumentRecord,
  CandidateNoteRecord,
  CandidateRecord,
  CandidateSource,
  CompleteInterviewRoundInput,
  CreateCandidateNoteInput,
  CreateJobRequisitionInput,
  DeclineOfferLetterInput,
  HireApplicationInput,
  InterviewRoundRecord,
  InterviewScheduleItem,
  InterviewScheduleQuery,
  JobApplicationRecord,
  JobPostingRecord,
  JobRequisitionRecord,
  JobRequisitionStatus,
  OfferLetterRecord,
  OfferLetterTemplate,
  RecruitmentLookups,
  ScheduleInterviewRoundInput,
  UpdateCandidateInput,
  UpdateJobRequisitionInput,
} from '@hrm/shared-types';
import { ApiError, getTenantAccessToken, tenantApiRequest } from './tenant-api-client';

export type { CreateJobRequisitionInput, HireApplicationInput, UpdateJobRequisitionInput };

export interface RequisitionActionInput {
  comment?: string;
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

export function updateJobRequisition(
  requisitionId: string,
  input: UpdateJobRequisitionInput,
): Promise<JobRequisitionRecord> {
  return tenantApiRequest<JobRequisitionRecord>(`/job-requisitions/${requisitionId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function closeJobRequisition(
  requisitionId: string,
): Promise<JobRequisitionRecord> {
  return tenantApiRequest<JobRequisitionRecord>(
    `/job-requisitions/${requisitionId}/close`,
    { method: 'POST' },
  );
}

export function getRecruitmentLookups(companyId: string): Promise<RecruitmentLookups> {
  return tenantApiRequest<RecruitmentLookups>(
    `/companies/${companyId}/recruitment/lookups`,
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

export function getHirePrefill(applicationId: string): Promise<CandidateHirePrefill> {
  return tenantApiRequest<CandidateHirePrefill>(
    `/job-applications/${applicationId}/hire-prefill`,
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

export function cancelInterviewRound(
  roundId: string,
  reason?: string,
): Promise<InterviewRoundRecord> {
  return tenantApiRequest<InterviewRoundRecord>(
    `/interview-rounds/${roundId}/cancel`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}

function scheduleQueryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function listInterviewSchedule(
  companyId: string,
  query: InterviewScheduleQuery = {},
): Promise<InterviewScheduleItem[]> {
  return tenantApiRequest<InterviewScheduleItem[]>(
    `/companies/${companyId}/interview-rounds${scheduleQueryString(query)}`,
  );
}

export function listMyInterviews(
  query: Pick<InterviewScheduleQuery, 'from' | 'to' | 'status'> = {},
): Promise<InterviewScheduleItem[]> {
  return tenantApiRequest<InterviewScheduleItem[]>(
    `/my-interviews${scheduleQueryString(query)}`,
  );
}

export function completeMyInterview(
  roundId: string,
  input: CompleteInterviewRoundInput,
): Promise<InterviewRoundRecord> {
  return tenantApiRequest<InterviewRoundRecord>(
    `/my-interviews/${roundId}/complete`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function getMyInterviewResumeFileUrl(
  roundId: string,
): Promise<{ url: string; expiresInSeconds: number }> {
  return tenantApiRequest<{ url: string; expiresInSeconds: number }>(
    `/my-interviews/${roundId}/resume/file-url`,
  );
}

async function uploadMultipart<T>(
  path: string,
  file: File,
  fields: Record<string, string | undefined> = {},
): Promise<T> {
  const token = getTenantAccessToken();
  const formData = new FormData();
  formData.append('file', file);
  for (const [key, value] of Object.entries(fields)) {
    if (value) formData.append(key, value);
  }

  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}${path}`,
    { method: 'POST', headers, body: formData },
  );

  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
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

export function uploadApplicationResume(
  applicationId: string,
  file: File,
): Promise<JobApplicationRecord['resume']> {
  return uploadMultipart<JobApplicationRecord['resume']>(
    `/job-applications/${applicationId}/resume`,
    file,
  );
}

export function updateCandidate(
  candidateId: string,
  input: UpdateCandidateInput,
): Promise<CandidateRecord> {
  return tenantApiRequest<CandidateRecord>(`/candidates/${candidateId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getCandidate(candidateId: string): Promise<CandidateRecord> {
  return tenantApiRequest<CandidateRecord>(`/candidates/${candidateId}`);
}

export function listCandidateApplications(
  companyId: string,
  candidateId: string,
): Promise<JobApplicationRecord[]> {
  return tenantApiRequest<JobApplicationRecord[]>(
    `/companies/${companyId}/job-applications?candidateId=${encodeURIComponent(candidateId)}`,
  );
}

export function listCandidateNotes(candidateId: string): Promise<CandidateNoteRecord[]> {
  return tenantApiRequest<CandidateNoteRecord[]>(`/candidates/${candidateId}/notes`);
}

export function createCandidateNote(
  candidateId: string,
  input: CreateCandidateNoteInput,
): Promise<CandidateNoteRecord> {
  return tenantApiRequest<CandidateNoteRecord>(`/candidates/${candidateId}/notes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteCandidateNote(noteId: string): Promise<void> {
  return tenantApiRequest<void>(`/candidate-notes/${noteId}`, { method: 'DELETE' });
}

export function listCandidateDocuments(
  candidateId: string,
): Promise<CandidateDocumentRecord[]> {
  return tenantApiRequest<CandidateDocumentRecord[]>(
    `/candidates/${candidateId}/documents`,
  );
}

export function uploadCandidateDocument(
  candidateId: string,
  file: File,
  label?: string,
): Promise<CandidateDocumentRecord> {
  return uploadMultipart<CandidateDocumentRecord>(
    `/candidates/${candidateId}/documents`,
    file,
    { label },
  );
}

export function getCandidateDocumentFileUrl(
  documentId: string,
): Promise<{ url: string; expiresInSeconds: number; originalName: string }> {
  return tenantApiRequest(`/candidate-documents/${documentId}/file-url`);
}

export function deleteCandidateDocument(documentId: string): Promise<void> {
  return tenantApiRequest<void>(`/candidate-documents/${documentId}`, {
    method: 'DELETE',
  });
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
  annualSalary?: number | null;
  currency?: string;
  startDate?: string;
  reportingTo?: string | null;
  signingBonus?: number | null;
  equityNotes?: string | null;
  probationMonths?: number | null;
  expiryDate?: string | null;
  additionalTerms?: string | null;
}

export interface SendOfferLetterInput {
  deliveryMethod: 'email' | 'manual';
  message?: string;
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

export function sendOfferLetter(
  offerLetterId: string,
  input: SendOfferLetterInput = { deliveryMethod: 'email' },
): Promise<OfferLetterRecord> {
  return tenantApiRequest<OfferLetterRecord>(
    `/offer-letters/${offerLetterId}/send`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function acceptOfferLetter(offerLetterId: string): Promise<OfferLetterRecord> {
  return tenantApiRequest<OfferLetterRecord>(
    `/offer-letters/${offerLetterId}/accept`,
    { method: 'POST' },
  );
}

export function declineOfferLetter(
  offerLetterId: string,
  input: DeclineOfferLetterInput,
): Promise<OfferLetterRecord> {
  return tenantApiRequest<OfferLetterRecord>(
    `/offer-letters/${offerLetterId}/decline`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function reviseOfferLetter(offerLetterId: string): Promise<OfferLetterRecord> {
  return tenantApiRequest<OfferLetterRecord>(
    `/offer-letters/${offerLetterId}/revise`,
    { method: 'POST' },
  );
}

/** Fetches the generated PDF (auth header required, so it can't be a plain link). */
export async function fetchOfferLetterPdf(
  offerLetterId: string,
): Promise<{ blob: Blob; filename: string }> {
  const token = getTenantAccessToken();
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}/offer-letters/${offerLetterId}/download`,
    { headers },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    throw new ApiError(
      body.error?.message ?? `Download failed (${response.status})`,
      response.status,
      body.error?.code,
    );
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'offer-letter.pdf';
  return { blob: await response.blob(), filename };
}

export async function downloadOfferLetterPdf(offerLetterId: string): Promise<void> {
  const { blob, filename } = await fetchOfferLetterPdf(offerLetterId);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
