import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Award, BookOpen, CheckCircle2, Grid3X3, Loader2, ShieldCheck } from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Toggle';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { listEmployees } from '@/lib/employees-api';
import {
  CERTIFICATION_STATUS_LABELS,
  SKILL_LEVEL_LABELS,
  createCertification,
  createSkill,
  listCertifications,
  listEmployeeSkills,
  listSkills,
  listTrainingCourses,
  upsertEmployeeSkill,
} from '@/lib/training-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  EmployeeCertificationRecord,
  EmployeeRecord,
  EmployeeSkillRecord,
  SkillProficiencyLevel,
  SkillRecord,
  TrainingCourseRecord,
} from '@hrm/shared-types';

type View = 'certifications' | 'skills';

const tabs: { id: View; label: string; icon: typeof Award }[] = [
  { id: 'certifications', label: 'Certification expiry', icon: Award },
  { id: 'skills', label: 'Skill matrix', icon: Grid3X3 },
];

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

export function TrainingCertificationPage() {
  const { companyId } = useCompany();
  const { navigate } = useNav();
  const { can } = usePermissions();
  const canCreate = can('training', 'create');
  const canEdit = can('training', 'edit');
  const [view, setView] = useState<View>('certifications');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<TrainingCourseRecord[]>([]);
  const [certifications, setCertifications] = useState<EmployeeCertificationRecord[]>([]);
  const [expiringCertifications, setExpiringCertifications] = useState<EmployeeCertificationRecord[]>([]);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [employeeSkills, setEmployeeSkills] = useState<EmployeeSkillRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState('');

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

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [courseRows, certificationRows, expiringRows, skillRows, employeeSkillRows, employeeRows] =
        await Promise.all([
          listTrainingCourses(companyId),
          listCertifications(companyId),
          listCertifications(companyId, { expiringOnly: true }),
          listSkills(companyId),
          listEmployeeSkills(companyId),
          listEmployees(companyId),
        ]);
      setCourses(courseRows);
      setCertifications(certificationRows);
      setExpiringCertifications(expiringRows);
      setSkills(skillRows);
      setEmployeeSkills(employeeSkillRows);
      setEmployees(employeeRows);
      setCertEmployeeId((current) => current || employeeRows[0]?.id || '');
      setAssignSkillEmployeeId((current) => current || employeeRows[0]?.id || '');
      setAssignSkillId((current) => current || skillRows[0]?.id || '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load certifications and skills');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  if (!companyId) {
    return <div className="p-6 text-sm text-secondary">Select a company to manage certifications and skills.</div>;
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-primary">Certifications &amp; skills</h1>
          <p className="mt-1 text-sm text-secondary">Employee certifications, expiry alerts and the skill matrix.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate('training-catalog')}>
            <BookOpen className="h-4 w-4" /> Course catalog
          </Button>
          {canCreate && (
            <>
              <Button variant="secondary" onClick={() => setCertModal(true)}><Award className="h-4 w-4" /> Add certification</Button>
              <Button variant="secondary" onClick={() => setSkillModal(true)}><Grid3X3 className="h-4 w-4" /> Add skill</Button>
            </>
          )}
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
          ['Expiring certs', expiringCertifications.length, 'Within 30 days', AlertTriangle],
          ['Certifications', certifications.length, 'On file', ShieldCheck],
          ['Skill assignments', employeeSkills.length, 'In the matrix', Grid3X3],
          ['Catalog skills', skills.length, 'Available to assign', Award],
        ].map(([label, value, detail, Icon]) => {
          const StatIcon = Icon as typeof Award;
          return (
            <section key={String(label)} className="surface rounded-xl border border-base p-4 shadow-card">
              <div className="flex items-start justify-between">
                <div><p className="text-xs font-medium text-secondary">{String(label)}</p><p className="mt-2 text-2xl font-bold text-primary">{String(value)}</p></div>
                <div className="rounded-lg bg-accent-50 p-2 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400"><StatIcon className="h-5 w-5" /></div>
              </div>
              <p className="mt-2 text-xs text-muted">{String(detail)}</p>
            </section>
          );
        })}
      </div>

      <nav className="surface flex gap-1 overflow-x-auto rounded-xl border border-base p-1.5 shadow-card scrollbar-thin" aria-label="Certification sections">
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
        <div className="flex items-center justify-center py-16 text-secondary"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading certifications and skills…</div>
      ) : view === 'certifications' ? (
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
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <section className="surface rounded-xl border border-base p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">Skill catalog</h2>
              {canEdit && <Button size="sm" variant="secondary" onClick={() => setAssignSkillModal(true)}>Assign</Button>}
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
