/** Employee Engagement (MODULES.md §29) */

export type CompanyAnnouncementStatus = 'draft' | 'published' | 'archived';

export interface CompanyAnnouncementRecord {
  id: string;
  companyId: string;
  title: string;
  body: string;
  status: CompanyAnnouncementStatus;
  isPinned: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EngagementSurveyStatus = 'draft' | 'published' | 'closed';
export type EngagementSurveyType = 'pulse' | 'enps';
export type EngagementQuestionType =
  | 'multiple_choice'
  | 'rating'
  | 'text'
  | 'enps';

export interface EngagementSurveyQuestionRecord {
  id: string;
  sortOrder: number;
  questionType: EngagementQuestionType;
  prompt: string;
  isRequired: boolean;
  options: string[] | null;
}

export interface EngagementSurveyRecord {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  surveyType: EngagementSurveyType;
  isAnonymous: boolean;
  status: EngagementSurveyStatus;
  publishedAt: string | null;
  closedAt: string | null;
  responseCount: number;
  questions: EngagementSurveyQuestionRecord[];
  createdAt: string;
  updatedAt: string;
}

/** Employee-facing survey list item (no individual responses). */
export interface EngagementSurveyListItem {
  id: string;
  title: string;
  description: string | null;
  surveyType: EngagementSurveyType;
  isAnonymous: boolean;
  questionCount: number;
  alreadySubmitted: boolean;
  publishedAt: string | null;
}

export interface EngagementSurveyAnswerInput {
  questionId: string;
  textValue?: string;
  numericValue?: number;
  selectedOption?: string;
}

export interface EnpsSummary {
  score: number;
  promoters: number;
  passives: number;
  detractors: number;
  total: number;
  distribution: Array<{ score: number; count: number }>;
}

export interface EngagementQuestionResult {
  questionId: string;
  prompt: string;
  questionType: EngagementQuestionType;
  responseCount: number;
  averageRating?: number;
  optionCounts?: Array<{ option: string; count: number }>;
  textResponses?: string[];
  enps?: EnpsSummary;
}

export interface EngagementSurveyResults {
  surveyId: string;
  title: string;
  surveyType: EngagementSurveyType;
  isAnonymous: boolean;
  responseCount: number;
  questions: EngagementQuestionResult[];
  enps?: EnpsSummary;
}

export interface EnpsTrendPoint {
  surveyId: string;
  title: string;
  publishedAt: string | null;
  enps: EnpsSummary;
}

export interface EngagementSummary {
  publishedAnnouncementCount: number;
  activeSurveyCount: number;
  totalSurveyResponses: number;
  latestEnpsScore: number | null;
  kudosThisMonthCount: number;
}

export type EmployeeKudosType = 'peer' | 'manager';

export interface EmployeeKudosRecord {
  id: string;
  companyId: string;
  fromEmployeeId: string;
  fromEmployeeName: string;
  toEmployeeId: string;
  toEmployeeName: string;
  kudosType: EmployeeKudosType;
  message: string;
  createdAt: string;
}

export interface EmployeeEngagementFeed {
  announcements: CompanyAnnouncementRecord[];
  activeSurveys: EngagementSurveyListItem[];
}
