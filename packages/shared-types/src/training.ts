/** Training & certification (MODULES.md §26) */

export type TrainingCourseDeliveryMode =
  | 'self_paced'
  | 'instructor_led'
  | 'virtual'
  | 'blended';

export type TrainingCourseStatus = 'draft' | 'active' | 'archived';

export type TrainingSessionStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type TrainingAttendanceStatus =
  | 'registered'
  | 'attended'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export type TrainingCostCategory =
  | 'venue'
  | 'instructor'
  | 'materials'
  | 'travel'
  | 'catering'
  | 'technology'
  | 'other';

export interface TrainingCourseRecord {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  category: string | null;
  deliveryMode: TrainingCourseDeliveryMode;
  durationMinutes: number | null;
  isMandatory: boolean;
  status: TrainingCourseStatus;
  sessionCount: number;
  /** Scheduled or in-progress sessions that haven't been cancelled. */
  upcomingSessionCount: number;
  nextSessionStart: string | null;
  /** Enrolments across all sessions, excluding withdrawn ones. */
  enrolledCount: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSessionCostRecord {
  id: string;
  sessionId: string;
  category: TrainingCostCategory;
  description: string | null;
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSessionRecord {
  id: string;
  companyId: string;
  courseId: string;
  courseTitle: string;
  courseCategory: string | null;
  courseDeliveryMode: TrainingCourseDeliveryMode;
  courseStatus: TrainingCourseStatus;
  title: string | null;
  displayTitle: string;
  scheduledStart: string;
  scheduledEnd: string | null;
  location: string | null;
  instructor: string | null;
  status: TrainingSessionStatus;
  notes: string | null;
  /** Enrolments excluding withdrawn ones (same as `enrolledCount`). */
  attendeeCount: number;
  enrolledCount: number;
  /** Attended or completed. */
  attendedCount: number;
  completedCount: number;
  noShowCount: number;
  /** Still `registered`, i.e. attendance not marked yet. */
  unmarkedCount: number;
  /** Sum of cost lines in the company currency. */
  totalCost: number;
  currency: string;
  /** Total cost ÷ people who attended; null until someone attends. */
  costPerAttendee: number | null;
  /** Total cost ÷ people enrolled; null with no enrolments. */
  costPerEnrolled: number | null;
  /** Older cost lines recorded in another currency; not included in the totals. */
  otherCurrencyCosts: Array<{ currency: string; amount: number }>;
  costs: TrainingSessionCostRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface TrainingEnrollmentResult {
  attendance: TrainingAttendanceRecord[];
  enrolledCount: number;
  /** Previously withdrawn enrolments that were restored. */
  restoredCount: number;
  skipped: Array<{ employeeId: string; employeeName: string; reason: string }>;
}

/** Statuses an admin can set when marking attendance; withdrawing uses its own action. */
export type TrainingAttendanceMarkStatus = Exclude<TrainingAttendanceStatus, 'cancelled'>;

export interface TrainingAttendanceRecord {
  id: string;
  companyId: string;
  sessionId: string;
  sessionTitle: string;
  courseTitle: string;
  scheduledStart: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  departmentName: string | null;
  status: TrainingAttendanceStatus;
  registeredAt: string;
  attendedAt: string | null;
  completedAt: string | null;
  score: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSummary {
  activeCourseCount: number;
  upcomingSessionCount: number;
  totalAttendees: number;
  completionRatePercent: number | null;
  totalTrainingCost: number;
  currency: string;
  expiringCertificationCount: number;
  skillAssignmentCount: number;
}

export type SkillProficiencyLevel =
  | 'none'
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert';

export type EmployeeCertificationStatus = 'active' | 'expired' | 'revoked';

/** Days before expiry when a certificate shows as expiring and the alert is sent. */
export const CERTIFICATION_EXPIRY_WARNING_DAYS = 30;

/**
 * Display state derived from the expiry date: valid, no expiry, expiring within
 * `CERTIFICATION_EXPIRY_WARNING_DAYS`, expired (from the day after expiry), or revoked.
 */
export type CertificationExpiryState = 'valid' | 'no_expiry' | 'expiring_soon' | 'expired' | 'revoked';

export const SKILL_PROFICIENCY_LEVELS: SkillProficiencyLevel[] = [
  'none',
  'beginner',
  'intermediate',
  'advanced',
  'expert',
];

export interface SkillRecord {
  id: string;
  companyId: string;
  name: string;
  category: string | null;
  description: string | null;
  assignmentCount: number;
  /** Designations with a target level for this skill. */
  targetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeSkillRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  departmentName: string | null;
  skillId: string;
  skillName: string;
  skillCategory: string | null;
  level: SkillProficiencyLevel;
  assessedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeCertificationRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  departmentName: string | null;
  courseId: string | null;
  courseTitle: string | null;
  name: string;
  issuer: string | null;
  certificateNumber: string | null;
  issuedAt: string | null;
  expiryDate: string | null;
  /** `expired` once the expiry date has passed, whatever was stored. */
  status: EmployeeCertificationStatus;
  expiryState: CertificationExpiryState;
  /** Days left until expiry; negative once expired; null without an expiry date. */
  daysUntilExpiry: number | null;
  /** Set when a newer certificate with the same name replaces this one (a renewal). */
  supersededById: string | null;
  notes: string | null;
  /** The uploaded certificate (PDF, JPG or PNG), if any. */
  file: CertificationFileInfo | null;
  createdAt: string;
  updatedAt: string;
}

export interface CertificationFileInfo {
  name: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

/** Levels a designation can be expected to reach (`none` is not a target). */
export const SKILL_TARGET_LEVELS: SkillProficiencyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

export interface DesignationSkillTargetRecord {
  id: string;
  companyId: string;
  designationId: string;
  designationName: string;
  skillId: string;
  skillName: string;
  skillCategory: string | null;
  targetLevel: SkillProficiencyLevel;
  updatedAt: string;
}

export type SkillGapStatus = 'met' | 'below' | 'not_assessed';

export interface SkillGapItem {
  skillId: string;
  skillName: string;
  skillCategory: string | null;
  targetLevel: SkillProficiencyLevel;
  currentLevel: SkillProficiencyLevel | null;
  assessedAt: string | null;
  status: SkillGapStatus;
  /** Levels short of the target; 0 when met. Not assessed counts from `none`. */
  gap: number;
}

export interface EmployeeSkillGapRow {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  departmentName: string | null;
  designationId: string;
  designationName: string;
  targetCount: number;
  metCount: number;
  /** Sum of `gap` over the employee's targets. */
  totalGap: number;
  items: SkillGapItem[];
}

export interface SkillGapBySkill {
  skillId: string;
  skillName: string;
  skillCategory: string | null;
  targetedEmployees: number;
  belowCount: number;
  notAssessedCount: number;
}

export interface SkillGapReport {
  employees: EmployeeSkillGapRow[];
  skills: SkillGapBySkill[];
  summary: {
    employeesWithTargets: number;
    employeesMeetingAll: number;
    openGaps: number;
    designationsWithTargets: number;
    /** Current employees whose designation has no targets, or who have no designation. */
    employeesWithoutTargets: number;
  };
}
