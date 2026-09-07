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
  enrolledCount: number;
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
  title: string | null;
  displayTitle: string;
  scheduledStart: string;
  scheduledEnd: string | null;
  location: string | null;
  instructor: string | null;
  status: TrainingSessionStatus;
  notes: string | null;
  attendeeCount: number;
  completedCount: number;
  totalCost: number;
  currency: string;
  costs: TrainingSessionCostRecord[];
  createdAt: string;
  updatedAt: string;
}

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

export interface SkillRecord {
  id: string;
  companyId: string;
  name: string;
  category: string | null;
  description: string | null;
  assignmentCount: number;
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
  status: EmployeeCertificationStatus;
  daysUntilExpiry: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
