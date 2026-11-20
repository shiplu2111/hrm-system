import type {
  CompanyAnnouncementRecord,
  EmployeeKudosModerationRecord,
  EmployeeKudosModerationStatus,
  EmployeeKudosRecord,
  EmployeeKudosType,
  EngagementQuestionType,
  EngagementSurveyRecord,
  EngagementSurveyResults,
  EngagementSurveyType,
  EngagementSummary,
  EnpsTrendPoint,
  KudosModerationFeedResult,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export const QUESTION_TYPE_LABELS: Record<EngagementQuestionType, string> = {
  multiple_choice: 'Multiple choice',
  rating: 'Rating scale',
  text: 'Open text',
  enps: 'eNPS (0–10)',
};

export const SURVEY_TYPE_LABELS: Record<EngagementSurveyType, string> = {
  pulse: 'Pulse survey',
  enps: 'eNPS',
};

export const KUDOS_TYPE_LABELS: Record<EmployeeKudosType, string> = {
  peer: 'Peer recognition',
  manager: 'Manager recognition',
};

export function getEngagementSummary(companyId: string): Promise<EngagementSummary> {
  return tenantApiRequest<EngagementSummary>(
    `/companies/${companyId}/engagement/summary`,
  );
}

export function listAnnouncements(
  companyId: string,
  status?: string,
): Promise<CompanyAnnouncementRecord[]> {
  const query = status ? `?status=${status}` : '';
  return tenantApiRequest<CompanyAnnouncementRecord[]>(
    `/companies/${companyId}/engagement/announcements${query}`,
  );
}

export function createAnnouncement(
  companyId: string,
  input: { title: string; body: string; isPinned?: boolean; expiresAt?: string },
): Promise<CompanyAnnouncementRecord> {
  return tenantApiRequest<CompanyAnnouncementRecord>(
    `/companies/${companyId}/engagement/announcements`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function publishAnnouncement(announcementId: string): Promise<CompanyAnnouncementRecord> {
  return tenantApiRequest<CompanyAnnouncementRecord>(
    `/engagement/announcements/${announcementId}/publish`,
    { method: 'POST' },
  );
}

export function updateAnnouncement(
  announcementId: string,
  input: {
    title?: string;
    body?: string;
    isPinned?: boolean;
    expiresAt?: string | null;
    status?: 'draft' | 'published' | 'archived';
  },
): Promise<CompanyAnnouncementRecord> {
  return tenantApiRequest<CompanyAnnouncementRecord>(
    `/engagement/announcements/${announcementId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function updateSurvey(
  surveyId: string,
  input: {
    title?: string;
    description?: string;
    isAnonymous?: boolean;
  },
): Promise<EngagementSurveyRecord> {
  return tenantApiRequest<EngagementSurveyRecord>(
    `/engagement/surveys/${surveyId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function listSurveys(
  companyId: string,
  params?: { status?: string; surveyType?: EngagementSurveyType },
): Promise<EngagementSurveyRecord[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.surveyType) search.set('surveyType', params.surveyType);
  const query = search.toString();
  return tenantApiRequest<EngagementSurveyRecord[]>(
    `/companies/${companyId}/engagement/surveys${query ? `?${query}` : ''}`,
  );
}

export function createSurvey(
  companyId: string,
  input: {
    title: string;
    description?: string;
    surveyType?: EngagementSurveyType;
    isAnonymous?: boolean;
    questions: Array<{
      questionType: EngagementQuestionType;
      prompt: string;
      isRequired?: boolean;
      options?: string[];
    }>;
  },
): Promise<EngagementSurveyRecord> {
  return tenantApiRequest<EngagementSurveyRecord>(
    `/companies/${companyId}/engagement/surveys`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function publishSurvey(surveyId: string): Promise<EngagementSurveyRecord> {
  return tenantApiRequest<EngagementSurveyRecord>(
    `/engagement/surveys/${surveyId}/publish`,
    { method: 'POST' },
  );
}

export function closeSurvey(surveyId: string): Promise<EngagementSurveyRecord> {
  return tenantApiRequest<EngagementSurveyRecord>(
    `/engagement/surveys/${surveyId}/close`,
    { method: 'POST' },
  );
}

export function getSurveyResults(surveyId: string): Promise<EngagementSurveyResults> {
  return tenantApiRequest<EngagementSurveyResults>(
    `/engagement/surveys/${surveyId}/results`,
  );
}

export function getEnpsTrends(companyId: string): Promise<EnpsTrendPoint[]> {
  return tenantApiRequest<EnpsTrendPoint[]>(
    `/companies/${companyId}/engagement/enps-trends`,
  );
}

export function listKudos(
  companyId: string,
  limitOrParams:
    | number
    | {
        limit?: number;
        kudosType?: EmployeeKudosType;
        toEmployeeId?: string;
        fromEmployeeId?: string;
        q?: string;
      } = 50,
): Promise<EmployeeKudosRecord[]> {
  const params =
    typeof limitOrParams === 'number' ? { limit: limitOrParams } : limitOrParams;
  const search = new URLSearchParams();
  if (params.limit) search.set('limit', String(params.limit));
  if (params.kudosType) search.set('kudosType', params.kudosType);
  if (params.toEmployeeId) search.set('toEmployeeId', params.toEmployeeId);
  if (params.fromEmployeeId) search.set('fromEmployeeId', params.fromEmployeeId);
  if (params.q) search.set('q', params.q);
  const query = search.toString();
  return tenantApiRequest<EmployeeKudosRecord[]>(
    `/companies/${companyId}/engagement/kudos${query ? `?${query}` : ''}`,
  );
}

export function listKudosModeration(
  companyId: string,
  params?: {
    status?: EmployeeKudosModerationStatus | 'all';
    kudosType?: EmployeeKudosType;
    toEmployeeId?: string;
    fromEmployeeId?: string;
    q?: string;
    limit?: number;
  },
): Promise<KudosModerationFeedResult> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.kudosType) search.set('kudosType', params.kudosType);
  if (params?.toEmployeeId) search.set('toEmployeeId', params.toEmployeeId);
  if (params?.fromEmployeeId) search.set('fromEmployeeId', params.fromEmployeeId);
  if (params?.q) search.set('q', params.q);
  if (params?.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  return tenantApiRequest<KudosModerationFeedResult>(
    `/companies/${companyId}/engagement/kudos/moderation${query ? `?${query}` : ''}`,
  );
}

export function createKudos(
  companyId: string,
  input: { fromEmployeeId: string; toEmployeeId: string; message: string },
): Promise<EmployeeKudosRecord> {
  return tenantApiRequest<EmployeeKudosRecord>(
    `/companies/${companyId}/engagement/kudos`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function removeKudos(
  kudosId: string,
  reason?: string,
): Promise<EmployeeKudosModerationRecord> {
  return tenantApiRequest<EmployeeKudosModerationRecord>(
    `/engagement/kudos/${kudosId}/remove`,
    { method: 'POST', body: JSON.stringify({ ...(reason ? { reason } : {}) }) },
  );
}

export function restoreKudos(
  kudosId: string,
): Promise<EmployeeKudosModerationRecord> {
  return tenantApiRequest<EmployeeKudosModerationRecord>(
    `/engagement/kudos/${kudosId}/restore`,
    { method: 'POST' },
  );
}
