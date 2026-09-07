import type {
  EmployeeCertificationRecord,
  EmployeeCertificationStatus,
  EmployeeSkillRecord,
  SkillProficiencyLevel,
  SkillRecord,
  TrainingAttendanceRecord,
  TrainingAttendanceStatus,
  TrainingCostCategory,
  TrainingCourseDeliveryMode,
  TrainingCourseRecord,
  TrainingCourseStatus,
  TrainingSessionRecord,
  TrainingSessionStatus,
  TrainingSummary,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export const DELIVERY_MODE_LABELS: Record<TrainingCourseDeliveryMode, string> = {
  self_paced: 'Self-paced',
  instructor_led: 'Instructor-led',
  virtual: 'Virtual',
  blended: 'Blended',
};

export const COURSE_STATUS_LABELS: Record<TrainingCourseStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

export const SESSION_STATUS_LABELS: Record<TrainingSessionStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ATTENDANCE_STATUS_LABELS: Record<TrainingAttendanceStatus, string> = {
  registered: 'Registered',
  attended: 'Attended',
  completed: 'Completed',
  no_show: 'No show',
  cancelled: 'Cancelled',
};

export const COST_CATEGORY_LABELS: Record<TrainingCostCategory, string> = {
  venue: 'Venue',
  instructor: 'Instructor',
  materials: 'Materials',
  travel: 'Travel',
  catering: 'Catering',
  technology: 'Technology',
  other: 'Other',
};

export const SKILL_LEVEL_LABELS: Record<SkillProficiencyLevel, string> = {
  none: 'None',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

export const CERTIFICATION_STATUS_LABELS: Record<EmployeeCertificationStatus, string> = {
  active: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
};

export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function getTrainingSummary(companyId: string): Promise<TrainingSummary> {
  return tenantApiRequest<TrainingSummary>(`/companies/${companyId}/training/summary`);
}

export function listTrainingCourses(
  companyId: string,
  params?: { category?: string; status?: TrainingCourseStatus; activeOnly?: boolean },
): Promise<TrainingCourseRecord[]> {
  const search = new URLSearchParams();
  if (params?.category) search.set('category', params.category);
  if (params?.status) search.set('status', params.status);
  if (params?.activeOnly) search.set('activeOnly', 'true');
  const query = search.toString();
  return tenantApiRequest<TrainingCourseRecord[]>(
    `/companies/${companyId}/training/courses${query ? `?${query}` : ''}`,
  );
}

export interface CreateTrainingCourseInput {
  title: string;
  description?: string;
  category?: string;
  deliveryMode?: TrainingCourseDeliveryMode;
  durationMinutes?: number;
  isMandatory?: boolean;
  status?: TrainingCourseStatus;
}

export function createTrainingCourse(
  companyId: string,
  input: CreateTrainingCourseInput,
): Promise<TrainingCourseRecord> {
  return tenantApiRequest<TrainingCourseRecord>(`/companies/${companyId}/training/courses`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listTrainingSessions(
  companyId: string,
  params?: { courseId?: string; status?: TrainingSessionStatus },
): Promise<TrainingSessionRecord[]> {
  const search = new URLSearchParams();
  if (params?.courseId) search.set('courseId', params.courseId);
  if (params?.status) search.set('status', params.status);
  const query = search.toString();
  return tenantApiRequest<TrainingSessionRecord[]>(
    `/companies/${companyId}/training/sessions${query ? `?${query}` : ''}`,
  );
}

export interface CreateTrainingSessionInput {
  courseId: string;
  title?: string;
  scheduledStart: string;
  scheduledEnd?: string;
  location?: string;
  instructor?: string;
  notes?: string;
}

export function createTrainingSession(
  companyId: string,
  input: CreateTrainingSessionInput,
): Promise<TrainingSessionRecord> {
  return tenantApiRequest<TrainingSessionRecord>(`/companies/${companyId}/training/sessions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function addSessionCost(
  sessionId: string,
  input: { category: TrainingCostCategory; description?: string; amount: number; currency?: string },
): Promise<TrainingSessionRecord['costs'][number]> {
  return tenantApiRequest(`/training/sessions/${sessionId}/costs`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listTrainingAttendance(
  companyId: string,
  params?: { sessionId?: string; employeeId?: string; courseId?: string; status?: TrainingAttendanceStatus },
): Promise<TrainingAttendanceRecord[]> {
  const search = new URLSearchParams();
  if (params?.sessionId) search.set('sessionId', params.sessionId);
  if (params?.employeeId) search.set('employeeId', params.employeeId);
  if (params?.courseId) search.set('courseId', params.courseId);
  if (params?.status) search.set('status', params.status);
  const query = search.toString();
  return tenantApiRequest<TrainingAttendanceRecord[]>(
    `/companies/${companyId}/training/attendance${query ? `?${query}` : ''}`,
  );
}

export function registerTrainingAttendance(
  sessionId: string,
  employeeIds: string[],
): Promise<TrainingAttendanceRecord[]> {
  return tenantApiRequest<TrainingAttendanceRecord[]>(`/training/sessions/${sessionId}/attendance`, {
    method: 'POST',
    body: JSON.stringify({ employeeIds }),
  });
}

export function updateTrainingAttendance(
  attendanceId: string,
  input: { status?: TrainingAttendanceStatus; score?: number; notes?: string },
): Promise<TrainingAttendanceRecord> {
  return tenantApiRequest<TrainingAttendanceRecord>(`/training/attendance/${attendanceId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listSkills(companyId: string, params?: { category?: string }): Promise<SkillRecord[]> {
  const search = new URLSearchParams();
  if (params?.category) search.set('category', params.category);
  const query = search.toString();
  return tenantApiRequest<SkillRecord[]>(
    `/companies/${companyId}/training/skills${query ? `?${query}` : ''}`,
  );
}

export function createSkill(
  companyId: string,
  input: { name: string; category?: string; description?: string },
): Promise<SkillRecord> {
  return tenantApiRequest<SkillRecord>(`/companies/${companyId}/training/skills`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listEmployeeSkills(
  companyId: string,
  params?: { employeeId?: string; skillId?: string; level?: SkillProficiencyLevel },
): Promise<EmployeeSkillRecord[]> {
  const search = new URLSearchParams();
  if (params?.employeeId) search.set('employeeId', params.employeeId);
  if (params?.skillId) search.set('skillId', params.skillId);
  if (params?.level) search.set('level', params.level);
  const query = search.toString();
  return tenantApiRequest<EmployeeSkillRecord[]>(
    `/companies/${companyId}/training/employee-skills${query ? `?${query}` : ''}`,
  );
}

export function upsertEmployeeSkill(
  companyId: string,
  input: {
    employeeId: string;
    skillId: string;
    level: SkillProficiencyLevel;
    assessedAt?: string;
    notes?: string;
  },
): Promise<EmployeeSkillRecord> {
  return tenantApiRequest<EmployeeSkillRecord>(`/companies/${companyId}/training/employee-skills`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listCertifications(
  companyId: string,
  params?: {
    employeeId?: string;
    status?: EmployeeCertificationStatus;
    expiringOnly?: boolean;
  },
): Promise<EmployeeCertificationRecord[]> {
  const search = new URLSearchParams();
  if (params?.employeeId) search.set('employeeId', params.employeeId);
  if (params?.status) search.set('status', params.status);
  if (params?.expiringOnly) search.set('expiringOnly', 'true');
  const query = search.toString();
  return tenantApiRequest<EmployeeCertificationRecord[]>(
    `/companies/${companyId}/training/certifications${query ? `?${query}` : ''}`,
  );
}

export function createCertification(
  companyId: string,
  input: {
    employeeId: string;
    name: string;
    courseId?: string;
    issuer?: string;
    certificateNumber?: string;
    issuedAt?: string;
    expiryDate?: string;
    notes?: string;
  },
): Promise<EmployeeCertificationRecord> {
  return tenantApiRequest<EmployeeCertificationRecord>(
    `/companies/${companyId}/training/certifications`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}
