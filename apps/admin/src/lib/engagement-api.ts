import type {
  CompanyAnnouncementRecord,
  EmployeeKudosRecord,
  EmployeeKudosType,
  EngagementQuestionType,
  EngagementSurveyRecord,
  EngagementSurveyResults,
  EngagementSurveyType,
  EngagementSummary,
  EnpsTrendPoint,
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
  limit = 20,
): Promise<EmployeeKudosRecord[]> {
  return tenantApiRequest<EmployeeKudosRecord[]>(
    `/companies/${companyId}/engagement/kudos?limit=${limit}`,
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
