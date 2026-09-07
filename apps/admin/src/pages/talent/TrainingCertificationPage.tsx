import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DollarSign,
  GraduationCap,
  Grid3X3,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Toggle';
import { useCompany } from '@/context/CompanyContext';
import { listEmployees } from '@/lib/employees-api';
import {
  ATTENDANCE_STATUS_LABELS,
  COST_CATEGORY_LABELS,
  COURSE_STATUS_LABELS,
  DELIVERY_MODE_LABELS,
  SESSION_STATUS_LABELS,
  CERTIFICATION_STATUS_LABELS,
  SKILL_LEVEL_LABELS,
  addSessionCost,
  createCertification,
  createSkill,
  createTrainingCourse,
  createTrainingSession,
  formatDurationMinutes,
  getTrainingSummary,
  listCertifications,
  listEmployeeSkills,
  listSkills,
  listTrainingAttendance,
  listTrainingCourses,
  listTrainingSessions,
  registerTrainingAttendance,
  upsertEmployeeSkill,
} from '@/lib/training-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  EmployeeCertificationRecord,
  EmployeeRecord,
  EmployeeSkillRecord,
  SkillProficiencyLevel,
  SkillRecord,
  TrainingAttendanceRecord,
  TrainingCostCategory,
  TrainingCourseDeliveryMode,
  TrainingCourseRecord,
  TrainingSessionRecord,
  TrainingSummary,
} from '@hrm/shared-types';

type View = 'catalog' | 'sessions' | 'records' | 'certifications' | 'skills';

const tabs: { id: View; label: string; icon: typeof BookOpen }[] = [
  { id: 'catalog', label: 'Course catalog', icon: BookOpen },
  { id: 'sessions', label: 'Sessions & costs', icon: DollarSign },
  { id: 'records', label: 'Training records', icon: GraduationCap },
  { id: 'certifications', label: 'Certification expiry', icon: Award },
  { id: 'skills', label: 'Skill matrix', icon: Grid3X3 },
];

const courseIcons = [Users, ShieldCheck, Sparkles, UserPlus, Award, GraduationCap];
const courseColors = [
  'from-blue-700 to-cyan-500',
  'from-indigo-700 to-violet-500',
  'from-sky-700 to-blue-500',
  'from-cyan-700 to-teal-500',
  'from-slate-800 to-blue-600',
  'from-blue-800 to-indigo-500',
];

function attendanceTone(status: TrainingAttendanceRecord['status']) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'no_show':
    case 'cancelled':
      return 'error' as const;
    case 'attended':
      return 'accent' as const;
    default:
      return 'warning' as const;
  }
}

export function TrainingCertificationPage() {
  const { companyId } = useCompany();
  const [view, setView] = useState<View>('catalog');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [courses, setCourses] = useState<TrainingCourseRecord[]>([]);
  const [sessions, setSessions] = useState<TrainingSessionRecord[]>([]);
  const [attendance, setAttendance] = useState<TrainingAttendanceRecord[]>([]);
  const [certifications, setCertifications] = useState<EmployeeCertificationRecord[]>([]);
  const [expiringCertifications, setExpiringCertifications] = useState<EmployeeCertificationRecord[]>([]);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [employeeSkills, setEmployeeSkills] = useState<EmployeeSkillRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [courseModal, setCourseModal] = useState(false);
  const [sessionModal, setSessionModal] = useState(false);
  const [costModalSessionId, setCostModalSessionId] = useState<string | null>(null);
  const [assignModal, setAssignModal] = useState(false);
  const [certModal, setCertModal] = useState(false);
  const [skillModal, setSkillModal] = useState(false);
  const [assignSkillModal, setAssignSkillModal] = useState(false);

  const [certEmployeeId, setCertEmployeeId] = useState('');
  const [certName, setCertName] = useState('');
  const [certCourseId, setCertCourseId] = useState('');
  const [certIssuer, setCertIssuer] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [certIssuedAt, setCertIssuedAt] = useState('');
  const [certExpiryDate, setCertExpiryDate] = useState('');

  const [skillName, setSkillName] = useState('');
  const [skillCategory, setSkillCategory] = useState('');
  const [skillDescription, setSkillDescription] = useState('');

  const [assignSkillEmployeeId, setAssignSkillEmployeeId] = useState('');
  const [assignSkillId, setAssignSkillId] = useState('');
  const [assignSkillLevel, setAssignSkillLevel] = useState<SkillProficiencyLevel>('beginner');

  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [courseCategory, setCourseCategory] = useState('Compliance');
  const [courseDeliveryMode, setCourseDeliveryMode] = useState<TrainingCourseDeliveryMode>('instructor_led');
  const [courseDuration, setCourseDuration] = useState('60');
  const [courseMandatory, setCourseMandatory] = useState(false);

  const [sessionCourseId, setSessionCourseId] = useState('');
  const [sessionStart, setSessionStart] = useState('2026-10-01T09:00');
  const [sessionEnd, setSessionEnd] = useState('2026-10-01T10:00');
  const [sessionLocation, setSessionLocation] = useState('');
  const [sessionInstructor, setSessionInstructor] = useState('');

  const [costCategory, setCostCategory] = useState<TrainingCostCategory>('venue');
  const [costAmount, setCostAmount] = useState('');
  const [costDescription, setCostDescription] = useState('');

  const [assignSessionId, setAssignSessionId] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const categories = useMemo(() => {
    const values = new Set(courses.map((course) => course.category).filter(Boolean) as string[]);
    return ['All', ...Array.from(values).sort()];
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return courses.filter(
      (course) =>
        (category === 'All' || course.category === category) &&
        (!normalized || `${course.title} ${course.category ?? ''}`.toLowerCase().includes(normalized)),
    );
  }, [category, courses, query]);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [
        summaryRow,
        courseRows,
        sessionRows,
        attendanceRows,
        certificationRows,
        expiringRows,
        skillRows,
        employeeSkillRows,
        employeeRows,
      ] = await Promise.all([
        getTrainingSummary(companyId),
        listTrainingCourses(companyId),
        listTrainingSessions(companyId),
        listTrainingAttendance(companyId),
        listCertifications(companyId),
        listCertifications(companyId, { expiringOnly: true }),
        listSkills(companyId),
        listEmployeeSkills(companyId),
        listEmployees(companyId),
      ]);
      setSummary(summaryRow);
      setCourses(courseRows);
      setSessions(sessionRows);
      setAttendance(attendanceRows);
      setCertifications(certificationRows);
      setExpiringCertifications(expiringRows);
      setSkills(skillRows);
      setEmployeeSkills(employeeSkillRows);
      setEmployees(employeeRows);
      setSessionCourseId((current) => current || courseRows[0]?.id || '');
      setAssignSessionId((current) => current || sessionRows[0]?.id || '');
      setCertEmployeeId((current) => current || employeeRows[0]?.id || '');
      setAssignSkillEmployeeId((current) => current || employeeRows[0]?.id || '');
      setAssignSkillId((current) => current || skillRows[0]?.id || '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load training data');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateCourse = async () => {
    if (!companyId || !courseTitle.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createTrainingCourse(companyId, {
        title: courseTitle.trim(),
        description: courseDescription.trim() || undefined,
        category: courseCategory.trim() || undefined,
        deliveryMode: courseDeliveryMode,
        durationMinutes: courseDuration ? Number(courseDuration) : undefined,
        isMandatory: courseMandatory,
      });
      setCourseModal(false);
      setCourseTitle('');
      setCourseDescription('');
      await loadData();
      setMessage('Course added to catalog.');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create course');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSession = async () => {
    if (!companyId || !sessionCourseId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createTrainingSession(companyId, {
        courseId: sessionCourseId,
        scheduledStart: new Date(sessionStart).toISOString(),
        scheduledEnd: sessionEnd ? new Date(sessionEnd).toISOString() : undefined,
        location: sessionLocation.trim() || undefined,
        instructor: sessionInstructor.trim() || undefined,
      });
      setSessionModal(false);
      await loadData();
      setMessage('Training session scheduled.');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create session');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCost = async () => {
    if (!costModalSessionId || !costAmount) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await addSessionCost(costModalSessionId, {
        category: costCategory,
        amount: Number(costAmount),
        description: costDescription.trim() || undefined,
      });
      setCostModalSessionId(null);
      setCostAmount('');
      setCostDescription('');
      await loadData();
      setMessage('Session cost recorded.');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to add cost');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async () => {
    if (!assignSessionId || selectedEmployeeIds.length === 0) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await registerTrainingAttendance(assignSessionId, selectedEmployeeIds);
      setAssignModal(false);
      setSelectedEmployeeIds([]);
      await loadData();
      setMessage(`Registered ${selectedEmployeeIds.length} employees for training.`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to register attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCertification = async () => {
    if (!companyId || !certEmployeeId || !certName.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createCertification(companyId, {
        employeeId: certEmployeeId,
        name: certName.trim(),
        courseId: certCourseId || undefined,
        issuer: certIssuer.trim() || undefined,
        certificateNumber: certNumber.trim() || undefined,
        issuedAt: certIssuedAt || undefined,
        expiryDate: certExpiryDate || undefined,
      });
      setCertModal(false);
      setCertName('');
      setCertIssuer('');
      setCertNumber('');
      setCertIssuedAt('');
      setCertExpiryDate('');
      setCertCourseId('');
      await loadData();
      setMessage('Certification recorded.');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create certification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSkill = async () => {
    if (!companyId || !skillName.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createSkill(companyId, {
        name: skillName.trim(),
        category: skillCategory.trim() || undefined,
        description: skillDescription.trim() || undefined,
      });
      setSkillModal(false);
      setSkillName('');
      setSkillCategory('');
      setSkillDescription('');
      await loadData();
      setMessage('Skill added to catalog.');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create skill');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignSkill = async () => {
    if (!companyId || !assignSkillEmployeeId || !assignSkillId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await upsertEmployeeSkill(companyId, {
        employeeId: assignSkillEmployeeId,
        skillId: assignSkillId,
        level: assignSkillLevel,
      });
      setAssignSkillModal(false);
      await loadData();
      setMessage('Skill level updated in matrix.');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to assign skill');
    } finally {
      setSubmitting(false);
    }
  };

  function certificationTone(status: EmployeeCertificationRecord['status']) {
    switch (status) {
      case 'active':
        return 'success' as const;
      case 'expired':
        return 'error' as const;
      default:
        return 'warning' as const;
    }
  }

  if (!companyId) {
    return <div className="p-6 text-sm text-secondary">Select a company to manage training.</div>;
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-accent-600">
            <GraduationCap className="h-3.5 w-3.5" /> Learning & compliance
          </div>
          <h1 className="text-xl font-bold text-primary">Training & Certification</h1>
          <p className="mt-1 text-sm text-secondary">Catalog, attendance, certifications, expiry alerts, and skill matrix.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setCourseModal(true)}><Plus className="h-4 w-4" /> Add course</Button>
          <Button variant="secondary" onClick={() => setCertModal(true)}><Award className="h-4 w-4" /> Add certification</Button>
          <Button variant="secondary" onClick={() => setSkillModal(true)}><Grid3X3 className="h-4 w-4" /> Add skill</Button>
          <Button variant="secondary" onClick={() => setSessionModal(true)}><CalendarClock className="h-4 w-4" /> Schedule session</Button>
          <Button onClick={() => setAssignModal(true)}><UserPlus className="h-4 w-4" /> Register attendance</Button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-950/40 dark:text-danger-300">{error}</div>
      )}
      {message && (
        <div className="flex items-center justify-between rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-950/40 dark:text-success-300">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{message}</span>
          <button type="button" onClick={() => setMessage('')} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Active courses', summary?.activeCourseCount ?? 0, `${courses.length} in catalog`, Users],
          ['Expiring certs', summary?.expiringCertificationCount ?? 0, 'Within 30 days', AlertTriangle],
          ['Skill assignments', summary?.skillAssignmentCount ?? 0, `${skills.length} catalog skills`, Grid3X3],
          ['Training spend', summary ? `${summary.currency} ${summary.totalTrainingCost.toLocaleString()}` : '—', 'Across all sessions', DollarSign],
        ].map(([label, value, detail, Icon]) => {
          const StatIcon = Icon as typeof Users;
          return (
          <section key={String(label)} className="surface rounded-xl border border-base p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div><p className="text-xs font-medium text-secondary">{String(label)}</p><p className="mt-2 text-2xl font-bold text-primary">{String(value)}</p></div>
              <div className="rounded-lg bg-accent-50 p-2 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400"><StatIcon className="h-5 w-5" /></div>
            </div>
            <p className="mt-2 text-xs text-muted">{String(detail)}</p>
          </section>
        );})}
      </div>

      <nav className="surface flex gap-1 overflow-x-auto rounded-xl border border-base p-1.5 shadow-card scrollbar-thin" aria-label="Training sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" onClick={() => setView(tab.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${view === tab.id ? 'bg-accent-600 text-white shadow-sm' : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </nav>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-secondary"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading training data…</div>
      ) : view === 'catalog' && (
        <div className="space-y-4">
          <div className="surface flex flex-col gap-3 rounded-xl border border-base p-3 shadow-card sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses or categories" className="pl-9" /></div>
            <Select value={category} onChange={(event) => setCategory(event.target.value)} className="sm:w-48">
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </div>
          {filteredCourses.length === 0 ? (
            <div className="surface rounded-xl border border-base p-8 text-center text-sm text-secondary">No courses yet. Add one to the catalog.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCourses.map((course, index) => {
                const Icon = courseIcons[index % courseIcons.length];
                const color = courseColors[index % courseColors.length];
                return (
                  <article key={course.id} className="surface overflow-hidden rounded-xl border border-base shadow-card">
                    <div className={`relative flex h-32 items-center justify-center bg-gradient-to-br ${color}`}>
                      <Icon className="relative h-12 w-12 text-white/90" strokeWidth={1.5} />
                      <Badge className="absolute left-3 top-3 border-white/20 bg-black/20 text-white">{course.category ?? 'General'}</Badge>
                      {course.isMandatory && <Badge tone="warning" className="absolute right-3 top-3">Mandatory</Badge>}
                    </div>
                    <div className="p-4">
                      <h2 className="text-sm font-semibold text-primary">{course.title}</h2>
                      <p className="mt-1 line-clamp-2 text-xs text-secondary">{course.description ?? 'No description'}</p>
                      <div className="mt-3 flex items-center gap-4 text-xs text-secondary">
                        <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{formatDurationMinutes(course.durationMinutes)}</span>
                        <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{course.enrolledCount} enrolled</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-base pt-3 text-xs">
                        <span className="text-secondary">{DELIVERY_MODE_LABELS[course.deliveryMode]}</span>
                        <Badge tone={course.status === 'active' ? 'success' : 'neutral'}>{COURSE_STATUS_LABELS[course.status]}</Badge>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!loading && view === 'sessions' && (
        <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
          <div className="border-b border-base px-5 py-4">
            <h2 className="text-sm font-semibold text-primary">Training sessions & costs</h2>
            <p className="mt-0.5 text-xs text-secondary">Each session tracks venue, instructor, and other cost line items.</p>
          </div>
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-sm text-secondary">No sessions scheduled yet.</div>
          ) : (
            <div className="divide-y divide-[rgb(var(--border-base))]">
              {sessions.map((session) => (
                <div key={session.id} className="space-y-4 px-5 py-4">
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                    <div>
                      <div className="font-medium text-primary">{session.displayTitle}</div>
                      <div className="mt-1 text-xs text-secondary">
                        {session.courseCategory ?? 'General'} · {new Date(session.scheduledStart).toLocaleString()} · {session.attendeeCount} attendees
                      </div>
                      {session.instructor && <div className="mt-1 text-xs text-muted">Instructor: {session.instructor}</div>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent">{SESSION_STATUS_LABELS[session.status]}</Badge>
                      <Badge tone="info">{session.currency} {session.totalCost.toLocaleString()}</Badge>
                      <Button size="sm" variant="secondary" onClick={() => setCostModalSessionId(session.id)}>Add cost</Button>
                    </div>
                  </div>
                  {session.costs.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {session.costs.map((cost) => (
                        <div key={cost.id} className="surface-muted rounded-lg px-3 py-2 text-xs">
                          <div className="font-medium text-primary">{COST_CATEGORY_LABELS[cost.category]}</div>
                          <div className="mt-1 text-secondary">{cost.currency} {cost.amount.toLocaleString()}{cost.description ? ` · ${cost.description}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {!loading && view === 'records' && (
        <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
          <div className="flex flex-col justify-between gap-3 border-b border-base px-5 py-4 sm:flex-row sm:items-center">
            <div><h2 className="text-sm font-semibold text-primary">Employee training attendance</h2><p className="mt-0.5 text-xs text-secondary">Per-employee registration and completion by session.</p></div>
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter records" className="pl-9 sm:w-64" /></div>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                <tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Course / session</th><th className="px-5 py-3">Session date</th><th className="px-5 py-3">Completed</th><th className="px-5 py-3">Score</th><th className="px-5 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {attendance
                  .filter((record) => !query.trim() || `${record.employeeName} ${record.courseTitle}`.toLowerCase().includes(query.toLowerCase()))
                  .map((record) => (
                    <tr key={record.id} className="hover:bg-[rgb(var(--bg-hover))]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={record.employeeName} size="sm" />
                          <div><div className="font-medium text-primary">{record.employeeName}</div><div className="text-xs text-secondary">{record.departmentName ?? record.employeeNumber}</div></div>
                        </div>
                      </td>
                      <td className="px-5 py-3"><div className="font-medium text-primary">{record.courseTitle}</div><div className="text-xs text-secondary">{record.sessionTitle}</div></td>
                      <td className="whitespace-nowrap px-5 py-3 text-secondary">{new Date(record.scheduledStart).toLocaleDateString()}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-secondary">{record.completedAt ? new Date(record.completedAt).toLocaleDateString() : '—'}</td>
                      <td className="px-5 py-3">{record.score != null ? <span className="font-mono font-semibold">{record.score}%</span> : '—'}</td>
                      <td className="px-5 py-3"><Badge tone={attendanceTone(record.status)} dot>{ATTENDANCE_STATUS_LABELS[record.status]}</Badge></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && view === 'certifications' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
          <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
            <div className="border-b border-base px-5 py-4">
              <h2 className="text-sm font-semibold text-primary">Certification expiry watchlist</h2>
              <p className="mt-0.5 text-xs text-secondary">Active certifications expiring within 30 days — alerts fire via the notification engine.</p>
            </div>
            <div className="divide-y divide-[rgb(var(--border-base))]">
              {expiringCertifications.length === 0 ? (
                <p className="px-5 py-8 text-sm text-secondary">No certifications expiring in the next 30 days.</p>
              ) : (
                expiringCertifications.map((item) => (
                  <div key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_170px_140px] sm:items-center">
                    <div>
                      <div className="font-medium text-primary">{item.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-secondary">
                        <Avatar name={item.employeeName} size="sm" />
                        {item.employeeName} · {item.departmentName ?? item.employeeNumber}
                      </div>
                    </div>
                    <div className="text-xs text-secondary">{item.daysUntilExpiry ?? 0} days remaining</div>
                    <div className="sm:text-right">
                      <Badge tone="warning" dot>{item.expiryDate ?? '—'}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
          <aside className="rounded-xl border border-warning-200 bg-warning-50 p-5 dark:border-warning-800 dark:bg-warning-950/30">
            <div className="flex items-center gap-2 text-warning-700 dark:text-warning-300">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Expiry notifications</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-warning-800 dark:text-warning-200">
              Daily at 6 AM, the system emits <code className="text-[11px]">certification.expiring</code> to the employee, manager, and HR — same pattern as contract and document expiry alerts.
            </p>
            <p className="mt-3 text-xs font-medium text-warning-900 dark:text-warning-100">{certifications.length} total certifications on file</p>
          </aside>
          <section className="surface overflow-hidden rounded-xl border border-base shadow-card lg:col-span-2">
            <div className="border-b border-base px-5 py-4">
              <h2 className="text-sm font-semibold text-primary">All certifications</h2>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                  <tr>
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-5 py-3">Certification</th>
                    <th className="px-5 py-3">Issuer</th>
                    <th className="px-5 py-3">Expires</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {certifications.map((record) => (
                    <tr key={record.id} className="hover:bg-[rgb(var(--bg-hover))]">
                      <td className="px-5 py-3">{record.employeeName}</td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-primary">{record.name}</div>
                        {record.courseTitle && <div className="text-xs text-secondary">{record.courseTitle}</div>}
                      </td>
                      <td className="px-5 py-3 text-secondary">{record.issuer ?? '—'}</td>
                      <td className="px-5 py-3 text-secondary">{record.expiryDate ?? 'No expiry'}</td>
                      <td className="px-5 py-3">
                        <Badge tone={certificationTone(record.status)} dot>{CERTIFICATION_STATUS_LABELS[record.status]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {!loading && view === 'skills' && (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <section className="surface rounded-xl border border-base p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">Skill catalog</h2>
              <Button size="sm" variant="secondary" onClick={() => setAssignSkillModal(true)}>Assign</Button>
            </div>
            <div className="space-y-2">
              {skills.map((skill) => (
                <div key={skill.id} className="rounded-lg border border-base px-3 py-2">
                  <div className="font-medium text-primary">{skill.name}</div>
                  <div className="text-xs text-secondary">{skill.category ?? 'Uncategorized'} · {skill.assignmentCount} assigned</div>
                </div>
              ))}
            </div>
          </section>
          <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
            <div className="border-b border-base px-5 py-4">
              <h2 className="text-sm font-semibold text-primary">Employee skill matrix</h2>
              <p className="mt-0.5 text-xs text-secondary">Employee ↔ skill ↔ proficiency level.</p>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                  <tr>
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-5 py-3">Skill</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Level</th>
                    <th className="px-5 py-3">Assessed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {employeeSkills.map((row) => (
                    <tr key={row.id} className="hover:bg-[rgb(var(--bg-hover))]">
                      <td className="px-5 py-3">
                        <div className="font-medium text-primary">{row.employeeName}</div>
                        <div className="text-xs text-secondary">{row.departmentName ?? row.employeeNumber}</div>
                      </td>
                      <td className="px-5 py-3 font-medium text-primary">{row.skillName}</td>
                      <td className="px-5 py-3 text-secondary">{row.skillCategory ?? '—'}</td>
                      <td className="px-5 py-3"><Badge tone="accent">{SKILL_LEVEL_LABELS[row.level]}</Badge></td>
                      <td className="px-5 py-3 text-secondary">{row.assessedAt ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      <Modal open={courseModal} onClose={() => setCourseModal(false)} title="Add course" description="Create an admin-managed catalog entry." size="lg" footer={<><Button variant="secondary" onClick={() => setCourseModal(false)}>Cancel</Button><Button onClick={() => void handleCreateCourse()} disabled={submitting}>{submitting ? 'Saving…' : 'Create course'}</Button></>}>
        {formError && <p className="mb-3 text-sm text-danger-600">{formError}</p>}
        <div className="space-y-4">
          <div><Label>Title</Label><Input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} placeholder="Data Privacy Essentials" /></div>
          <div><Label>Description</Label><Textarea rows={2} value={courseDescription} onChange={(event) => setCourseDescription(event.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Category</Label><Input value={courseCategory} onChange={(event) => setCourseCategory(event.target.value)} /></div>
            <div><Label>Duration (minutes)</Label><Input type="number" value={courseDuration} onChange={(event) => setCourseDuration(event.target.value)} /></div>
          </div>
          <div><Label>Delivery mode</Label><Select value={courseDeliveryMode} onChange={(event) => setCourseDeliveryMode(event.target.value as TrainingCourseDeliveryMode)}>{Object.entries(DELIVERY_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={courseMandatory} onChange={(event) => setCourseMandatory(event.target.checked)} />Mandatory for all staff</label>
        </div>
      </Modal>

      <Modal open={sessionModal} onClose={() => setSessionModal(false)} title="Schedule session" description="Link a catalog course to a scheduled delivery." size="lg" footer={<><Button variant="secondary" onClick={() => setSessionModal(false)}>Cancel</Button><Button onClick={() => void handleCreateSession()} disabled={submitting}>{submitting ? 'Saving…' : 'Create session'}</Button></>}>
        {formError && <p className="mb-3 text-sm text-danger-600">{formError}</p>}
        <div className="space-y-4">
          <div><Label>Course</Label><Select value={sessionCourseId} onChange={(event) => setSessionCourseId(event.target.value)}>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</Select></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Start</Label><Input type="datetime-local" value={sessionStart} onChange={(event) => setSessionStart(event.target.value)} /></div>
            <div><Label>End</Label><Input type="datetime-local" value={sessionEnd} onChange={(event) => setSessionEnd(event.target.value)} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Location</Label><Input value={sessionLocation} onChange={(event) => setSessionLocation(event.target.value)} placeholder="Virtual or room" /></div>
            <div><Label>Instructor</Label><Input value={sessionInstructor} onChange={(event) => setSessionInstructor(event.target.value)} /></div>
          </div>
        </div>
      </Modal>

      <Modal open={costModalSessionId != null} onClose={() => setCostModalSessionId(null)} title="Add session cost" description="Track spend by category for this training session." footer={<><Button variant="secondary" onClick={() => setCostModalSessionId(null)}>Cancel</Button><Button onClick={() => void handleAddCost()} disabled={submitting || !costAmount}>{submitting ? 'Saving…' : 'Add cost'}</Button></>}>
        {formError && <p className="mb-3 text-sm text-danger-600">{formError}</p>}
        <div className="space-y-4">
          <div><Label>Category</Label><Select value={costCategory} onChange={(event) => setCostCategory(event.target.value as TrainingCostCategory)}>{Object.entries(COST_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
          <div><Label>Amount</Label><Input type="number" min={0} step={0.01} value={costAmount} onChange={(event) => setCostAmount(event.target.value)} /></div>
          <div><Label>Description</Label><Input value={costDescription} onChange={(event) => setCostDescription(event.target.value)} placeholder="Optional detail" /></div>
        </div>
      </Modal>

      <Modal open={assignModal} onClose={() => setAssignModal(false)} title="Register attendance" description="Enroll employees for a scheduled training session." size="lg" footer={<><Button variant="secondary" onClick={() => setAssignModal(false)}>Cancel</Button><Button disabled={!selectedEmployeeIds.length || submitting} onClick={() => void handleAssign()}>Register {selectedEmployeeIds.length}</Button></>}>
        {formError && <p className="mb-3 text-sm text-danger-600">{formError}</p>}
        <div className="space-y-4">
          <div><Label>Session</Label><Select value={assignSessionId} onChange={(event) => setAssignSessionId(event.target.value)}>{sessions.map((session) => <option key={session.id} value={session.id}>{session.displayTitle} · {new Date(session.scheduledStart).toLocaleDateString()}</option>)}</Select></div>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-base p-3">
            {employees.map((employee) => (
              <label key={employee.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selectedEmployeeIds.includes(employee.id)} onChange={(event) => setSelectedEmployeeIds((current) => event.target.checked ? [...current, employee.id] : current.filter((id) => id !== employee.id))} />
                {employee.firstName} {employee.lastName}
              </label>
            ))}
          </div>
        </div>
      </Modal>

      <Modal open={certModal} onClose={() => setCertModal(false)} title="Add certification" description="Track employee certifications with optional expiry dates." size="lg" footer={<><Button variant="secondary" onClick={() => setCertModal(false)}>Cancel</Button><Button onClick={() => void handleCreateCertification()} disabled={submitting || !certName.trim()}>{submitting ? 'Saving…' : 'Save certification'}</Button></>}>
        {formError && <p className="mb-3 text-sm text-danger-600">{formError}</p>}
        <div className="space-y-4">
          <div><Label>Employee</Label><Select value={certEmployeeId} onChange={(event) => setCertEmployeeId(event.target.value)}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</Select></div>
          <div><Label>Certification name</Label><Input value={certName} onChange={(event) => setCertName(event.target.value)} placeholder="First Aid at Work" /></div>
          <div><Label>Linked course (optional)</Label><Select value={certCourseId} onChange={(event) => setCertCourseId(event.target.value)}><option value="">None</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</Select></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Issuer</Label><Input value={certIssuer} onChange={(event) => setCertIssuer(event.target.value)} /></div>
            <div><Label>Certificate number</Label><Input value={certNumber} onChange={(event) => setCertNumber(event.target.value)} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Issued date</Label><Input type="date" value={certIssuedAt} onChange={(event) => setCertIssuedAt(event.target.value)} /></div>
            <div><Label>Expiry date</Label><Input type="date" value={certExpiryDate} onChange={(event) => setCertExpiryDate(event.target.value)} /></div>
          </div>
        </div>
      </Modal>

      <Modal open={skillModal} onClose={() => setSkillModal(false)} title="Add skill" description="Add a skill to the company catalog for the matrix." footer={<><Button variant="secondary" onClick={() => setSkillModal(false)}>Cancel</Button><Button onClick={() => void handleCreateSkill()} disabled={submitting || !skillName.trim()}>{submitting ? 'Saving…' : 'Add skill'}</Button></>}>
        {formError && <p className="mb-3 text-sm text-danger-600">{formError}</p>}
        <div className="space-y-4">
          <div><Label>Name</Label><Input value={skillName} onChange={(event) => setSkillName(event.target.value)} placeholder="Project Management" /></div>
          <div><Label>Category</Label><Input value={skillCategory} onChange={(event) => setSkillCategory(event.target.value)} placeholder="Management" /></div>
          <div><Label>Description</Label><Textarea rows={2} value={skillDescription} onChange={(event) => setSkillDescription(event.target.value)} /></div>
        </div>
      </Modal>

      <Modal open={assignSkillModal} onClose={() => setAssignSkillModal(false)} title="Assign skill level" description="Set employee proficiency for a catalog skill." footer={<><Button variant="secondary" onClick={() => setAssignSkillModal(false)}>Cancel</Button><Button onClick={() => void handleAssignSkill()} disabled={submitting}>{submitting ? 'Saving…' : 'Save assignment'}</Button></>}>
        {formError && <p className="mb-3 text-sm text-danger-600">{formError}</p>}
        <div className="space-y-4">
          <div><Label>Employee</Label><Select value={assignSkillEmployeeId} onChange={(event) => setAssignSkillEmployeeId(event.target.value)}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</Select></div>
          <div><Label>Skill</Label><Select value={assignSkillId} onChange={(event) => setAssignSkillId(event.target.value)}>{skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</Select></div>
          <div><Label>Proficiency level</Label><Select value={assignSkillLevel} onChange={(event) => setAssignSkillLevel(event.target.value as SkillProficiencyLevel)}>{Object.entries(SKILL_LEVEL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
        </div>
      </Modal>
    </div>
  );
}
