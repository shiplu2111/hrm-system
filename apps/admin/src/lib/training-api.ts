import type {
  CertificationExpiryState,
  DesignationSkillTargetRecord,
  EmployeeCertificationRecord,
  EmployeeCertificationStatus,
  EmployeeSkillRecord,
  SkillGapReport,
  SkillProficiencyLevel,
  SkillRecord,
  TrainingAttendanceMarkStatus,
  TrainingAttendanceRecord,
  TrainingAttendanceStatus,
  TrainingCostCategory,
  TrainingCourseDeliveryMode,
  TrainingCourseRecord,
  TrainingCourseStatus,
  TrainingEnrollmentResult,
  TrainingSessionRecord,
  TrainingSessionStatus,
  TrainingSummary,
} from '@hrm/shared-types';
import { fetchTenantFile, type DownloadedFile } from './download';
import { ApiError, getTenantAccessToken, tenantApiRequest } from './tenant-api-client';

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

export const   ATTENDANCE_STATUS_LABELS: Record<TrainingAttendanceStatus, string> = {
  registered: 'Registered',
  attended: 'Attended',
  completed: 'Completed',
  no_show: 'No show',
  cancelled: 'Withdrawn',
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

export const CERTIFICATION_EXPIRY_STATE_LABELS: Record<CertificationExpiryState, string> = {
  valid: 'Valid',
  no_expiry: 'No expiry',
  expiring_soon: 'Expiring soon',
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

export interface UpdateTrainingCourseInput {
  title?: string;
  description?: string | null;
  category?: string | null;
  deliveryMode?: TrainingCourseDeliveryMode;
  durationMinutes?: number | null;
  isMandatory?: boolean;
  status?: TrainingCourseStatus;
}

export function updateTrainingCourse(
  courseId: string,
  input: UpdateTrainingCourseInput,
): Promise<TrainingCourseRecord> {
  return tenantApiRequest<TrainingCourseRecord>(`/training/courses/${courseId}`, {
    method: 'PATCH',
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

export function getTrainingSession(sessionId: string): Promise<TrainingSessionRecord> {
  return tenantApiRequest<TrainingSessionRecord>(`/training/sessions/${sessionId}`);
}

export interface UpdateTrainingSessionInput {
  title?: string | null;
  scheduledStart?: string;
  scheduledEnd?: string | null;
  location?: string | null;
  instructor?: string | null;
  notes?: string | null;
  status?: TrainingSessionStatus;
}

export function updateTrainingSession(
  sessionId: string,
  input: UpdateTrainingSessionInput,
): Promise<TrainingSessionRecord> {
  return tenantApiRequest<TrainingSessionRecord>(`/training/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** Cost lines are recorded in the company currency; each call returns the refreshed session. */
export function addSessionCost(
  sessionId: string,
  input: { category: TrainingCostCategory; description?: string; amount: number },
): Promise<TrainingSessionRecord> {
  return tenantApiRequest<TrainingSessionRecord>(`/training/sessions/${sessionId}/costs`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSessionCost(
  costId: string,
  input: { category?: TrainingCostCategory; description?: string | null; amount?: number },
): Promise<TrainingSessionRecord> {
  return tenantApiRequest<TrainingSessionRecord>(`/training/session-costs/${costId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteSessionCost(costId: string): Promise<TrainingSessionRecord> {
  return tenantApiRequest<TrainingSessionRecord>(`/training/session-costs/${costId}`, {
    method: 'DELETE',
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

export const MAX_ENROLMENTS_PER_REQUEST = 200;

export function registerTrainingAttendance(
  sessionId: string,
  employeeIds: string[],
): Promise<TrainingEnrollmentResult> {
  return tenantApiRequest<TrainingEnrollmentResult>(`/training/sessions/${sessionId}/attendance`, {
    method: 'POST',
    body: JSON.stringify({ employeeIds }),
  });
}

export function markTrainingAttendance(
  sessionId: string,
  attendanceIds: string[],
  status: TrainingAttendanceMarkStatus,
): Promise<TrainingAttendanceRecord[]> {
  return tenantApiRequest<TrainingAttendanceRecord[]>(
    `/training/sessions/${sessionId}/attendance/mark`,
    { method: 'POST', body: JSON.stringify({ attendanceIds, status }) },
  );
}

export function withdrawTrainingAttendance(attendanceId: string): Promise<TrainingAttendanceRecord> {
  return tenantApiRequest<TrainingAttendanceRecord>(`/training/attendance/${attendanceId}/withdraw`, {
    method: 'POST',
  });
}

export function updateTrainingAttendance(
  attendanceId: string,
  input: { status?: TrainingAttendanceMarkStatus; score?: number | null; notes?: string | null },
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

export function updateSkill(
  skillId: string,
  input: { name?: string; category?: string | null; description?: string | null },
): Promise<SkillRecord> {
  return tenantApiRequest<SkillRecord>(`/training/skills/${skillId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** Removes the skill with all of its ratings and designation targets. */
export function deleteSkill(skillId: string): Promise<{ removedRatings: number; removedTargets: number }> {
  return tenantApiRequest<{ removedRatings: number; removedTargets: number }>(`/training/skills/${skillId}`, {
    method: 'DELETE',
  });
}

export function listSkillTargets(
  companyId: string,
  params?: { designationId?: string },
): Promise<DesignationSkillTargetRecord[]> {
  const query = params?.designationId ? `?designationId=${encodeURIComponent(params.designationId)}` : '';
  return tenantApiRequest<DesignationSkillTargetRecord[]>(`/companies/${companyId}/training/skill-targets${query}`);
}

export function setSkillTarget(
  companyId: string,
  input: { designationId: string; skillId: string; targetLevel: SkillProficiencyLevel },
): Promise<DesignationSkillTargetRecord> {
  return tenantApiRequest<DesignationSkillTargetRecord>(`/companies/${companyId}/training/skill-targets`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteSkillTarget(targetId: string): Promise<{ deleted: boolean }> {
  return tenantApiRequest<{ deleted: boolean }>(`/training/skill-targets/${targetId}`, { method: 'DELETE' });
}

export function getSkillGapReport(companyId: string): Promise<SkillGapReport> {
  return tenantApiRequest<SkillGapReport>(`/companies/${companyId}/training/skill-gaps`);
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

/** Sets a matrix cell; the assessed date defaults to today. */
export function upsertEmployeeSkill(
  companyId: string,
  input: {
    employeeId: string;
    skillId: string;
    level: SkillProficiencyLevel;
    assessedAt?: string;
    notes?: string | null;
  },
): Promise<EmployeeSkillRecord> {
  return tenantApiRequest<EmployeeSkillRecord>(`/companies/${companyId}/training/employee-skills`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteEmployeeSkill(assignmentId: string): Promise<{ deleted: boolean }> {
  return tenantApiRequest<{ deleted: boolean }>(`/training/employee-skills/${assignmentId}`, {
    method: 'DELETE',
  });
}

export function listCertifications(
  companyId: string,
  params?: {
    employeeId?: string;
    status?: EmployeeCertificationStatus;
    expiryState?: CertificationExpiryState;
    expiringOnly?: boolean;
    currentOnly?: boolean;
  },
): Promise<EmployeeCertificationRecord[]> {
  const search = new URLSearchParams();
  if (params?.employeeId) search.set('employeeId', params.employeeId);
  if (params?.status) search.set('status', params.status);
  if (params?.expiryState) search.set('expiryState', params.expiryState);
  if (params?.expiringOnly) search.set('expiringOnly', 'true');
  if (params?.currentOnly) search.set('currentOnly', 'true');
  const query = search.toString();
  return tenantApiRequest<EmployeeCertificationRecord[]>(
    `/companies/${companyId}/training/certifications${query ? `?${query}` : ''}`,
  );
}

export interface CreateCertificationInput {
  employeeId: string;
  name: string;
  courseId?: string;
  issuer?: string;
  certificateNumber?: string;
  issuedAt?: string;
  expiryDate?: string;
  notes?: string;
}

export interface UpdateCertificationInput {
  name?: string;
  courseId?: string | null;
  issuer?: string | null;
  certificateNumber?: string | null;
  issuedAt?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  status?: 'active' | 'revoked';
  /** Required when revoking. */
  revocationReason?: string;
}

export function createCertification(
  companyId: string,
  input: CreateCertificationInput,
): Promise<EmployeeCertificationRecord> {
  return tenantApiRequest<EmployeeCertificationRecord>(
    `/companies/${companyId}/training/certifications`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateCertification(
  certificationId: string,
  input: UpdateCertificationInput,
): Promise<EmployeeCertificationRecord> {
  return tenantApiRequest<EmployeeCertificationRecord>(`/training/certifications/${certificationId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteCertification(certificationId: string): Promise<{ deleted: boolean }> {
  return tenantApiRequest<{ deleted: boolean }>(`/training/certifications/${certificationId}`, {
    method: 'DELETE',
  });
}

export const CERTIFICATE_FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';
export const CERTIFICATE_FILE_MAX_BYTES = 10 * 1024 * 1024;

/** Attaches the certificate file, replacing any earlier one. */
export async function uploadCertificationFile(
  certificationId: string,
  file: File,
): Promise<EmployeeCertificationRecord> {
  const token = getTenantAccessToken();
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}/training/certifications/${certificationId}/file`,
    { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    data?: EmployeeCertificationRecord;
    error?: { message?: string; code?: string };
  };
  if (!response.ok || !payload.data) {
    throw new ApiError(payload.error?.message ?? `Upload failed (${response.status})`, response.status, payload.error?.code);
  }
  return payload.data;
}

/** Certificate bytes (behind the bearer token, so they're fetched rather than linked). */
export function fetchCertificationFile(certification: Pick<EmployeeCertificationRecord, 'id' | 'file'>): Promise<DownloadedFile> {
  return fetchTenantFile(`/training/certifications/${certification.id}/file`, {
    filename: certification.file?.name ?? 'certificate',
    errorMessage: (status) => `Couldn’t load the certificate file (${status})`,
  });
}

export function removeCertificationFile(certificationId: string): Promise<EmployeeCertificationRecord> {
  return tenantApiRequest<EmployeeCertificationRecord>(`/training/certifications/${certificationId}/file`, {
    method: 'DELETE',
  });
}
