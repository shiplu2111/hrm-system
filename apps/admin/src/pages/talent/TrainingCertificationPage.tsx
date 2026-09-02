import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Toggle';

type View = 'catalog' | 'records' | 'certifications';

const courses = [
  { id: 1, title: 'Leading Through Change', category: 'Leadership', duration: '2h 30m', enrolled: 148, color: 'from-blue-700 to-cyan-500', icon: Users },
  { id: 2, title: 'Data Privacy Essentials', category: 'Compliance', duration: '45m', enrolled: 312, color: 'from-indigo-700 to-violet-500', icon: ShieldCheck },
  { id: 3, title: 'Strategic Product Discovery', category: 'Product', duration: '3h 15m', enrolled: 86, color: 'from-sky-700 to-blue-500', icon: Sparkles },
  { id: 4, title: 'Inclusive Interviewing', category: 'People', duration: '1h 20m', enrolled: 204, color: 'from-cyan-700 to-teal-500', icon: UserPlus },
  { id: 5, title: 'Advanced Cloud Security', category: 'Technical', duration: '4h 10m', enrolled: 73, color: 'from-slate-800 to-blue-600', icon: Award },
  { id: 6, title: 'Finance for Managers', category: 'Business', duration: '1h 50m', enrolled: 121, color: 'from-blue-800 to-indigo-500', icon: GraduationCap },
];

const initialRecords = [
  { employee: 'Maya Patel', role: 'Senior Product Manager', course: 'Data Privacy Essentials', completed: '18 Aug 2026', validity: '18 Aug 2027', score: 96, status: 'Completed' },
  { employee: 'Omar Hassan', role: 'Engineering Manager', course: 'Advanced Cloud Security', completed: '11 Aug 2026', validity: '11 Aug 2027', score: 91, status: 'Completed' },
  { employee: 'Elena Rossi', role: 'People Partner', course: 'Inclusive Interviewing', completed: '—', validity: '—', score: 68, status: 'In progress' },
  { employee: 'Noah Williams', role: 'Finance Lead', course: 'Finance for Managers', completed: '02 Jul 2026', validity: 'No expiry', score: 88, status: 'Completed' },
  { employee: 'Aisha Khan', role: 'Sales Director', course: 'Leading Through Change', completed: '—', validity: 'Due 04 Sep 2026', score: 42, status: 'Overdue' },
  { employee: 'Leo Zhang', role: 'Product Designer', course: 'Strategic Product Discovery', completed: '29 Jun 2026', validity: '29 Jun 2028', score: 94, status: 'Completed' },
];

const expiries = [
  { certification: 'AWS Solutions Architect', employee: 'Omar Hassan', expires: '29 Aug 2026', days: 4, owner: 'Engineering' },
  { certification: 'First Aid at Work', employee: 'Sarah Chen', expires: '06 Sep 2026', days: 12, owner: 'Operations' },
  { certification: 'ISO 27001 Lead Auditor', employee: 'Nadia Rahman', expires: '19 Sep 2026', days: 25, owner: 'Security' },
  { certification: 'PMP Certification', employee: 'Maya Patel', expires: '14 Oct 2026', days: 50, owner: 'Product' },
  { certification: 'SHRM-CP', employee: 'Elena Rossi', expires: '22 Nov 2026', days: 89, owner: 'People' },
];

const tabs: { id: View; label: string; icon: typeof BookOpen }[] = [
  { id: 'catalog', label: 'Course catalog', icon: BookOpen },
  { id: 'records', label: 'Training records', icon: GraduationCap },
  { id: 'certifications', label: 'Certification expiry', icon: Award },
];

const employees = ['Maya Patel', 'Omar Hassan', 'Elena Rossi', 'Noah Williams', 'Aisha Khan', 'Leo Zhang'];

export function TrainingCertificationPage() {
  const [view, setView] = useState<View>('catalog');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [department, setDepartment] = useState('Product');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(['Maya Patel', 'Leo Zhang']);
  const [selectedCourse, setSelectedCourse] = useState('Data Privacy Essentials');
  const [dueDate, setDueDate] = useState('2026-09-30');
  const [assignedMessage, setAssignedMessage] = useState('');
  const [enrolledCourses, setEnrolledCourses] = useState<number[]>([]);

  const filteredCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return courses.filter((course) =>
      (category === 'All' || course.category === category)
      && (!normalized || `${course.title} ${course.category}`.toLowerCase().includes(normalized)),
    );
  }, [category, query]);

  const toggleEmployee = (employee: string) => {
    setSelectedEmployees((current) => current.includes(employee) ? current.filter((name) => name !== employee) : [...current, employee]);
  };

  const assignTraining = () => {
    if (!selectedEmployees.length) return;
    setAssignedMessage(`${selectedCourse} assigned to ${selectedEmployees.length} employees, due ${dueDate}.`);
    setAssignmentOpen(false);
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-accent-600"><GraduationCap className="h-3.5 w-3.5" /> Learning & compliance</div>
          <h1 className="text-xl font-bold text-primary">Training & Certification</h1>
          <p className="mt-1 text-sm text-secondary">Develop critical skills and keep workforce credentials current.</p>
        </div>
        <Button onClick={() => setAssignmentOpen(true)}><UserPlus className="h-4 w-4" /> Bulk assign</Button>
      </header>

      {assignedMessage && (
        <div className="flex items-center justify-between rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-950/40 dark:text-success-300">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{assignedMessage}</span>
          <button onClick={() => setAssignedMessage('')} aria-label="Dismiss notification">×</button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Active learners', '284', '+18 this month', Users],
          ['Completion rate', '91.4%', '+3.2% vs Q2', CheckCircle2],
          ['Hours completed', '1,842', 'Last 90 days', Clock3],
          ['Expiring soon', '12', 'Within 30 days', AlertTriangle],
        ].map(([label, value, detail, Icon]) => (
          <section key={String(label)} className="surface rounded-xl border border-base p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div><p className="text-xs font-medium text-secondary">{String(label)}</p><p className="mt-2 text-2xl font-bold text-primary">{String(value)}</p></div>
              <div className="rounded-lg bg-accent-50 p-2 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400"><Icon className="h-5 w-5" /></div>
            </div>
            <p className="mt-2 text-xs text-muted">{String(detail)}</p>
          </section>
        ))}
      </div>

      <nav className="surface flex gap-1 overflow-x-auto rounded-xl border border-base p-1.5 shadow-card scrollbar-thin" aria-label="Training sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setView(tab.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${view === tab.id ? 'bg-accent-600 text-white shadow-sm' : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </nav>

      {view === 'catalog' && (
        <div className="space-y-4">
          <div className="surface flex flex-col gap-3 rounded-xl border border-base p-3 shadow-card sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses or categories" className="pl-9" /></div>
            <Select value={category} onChange={(event) => setCategory(event.target.value)} className="sm:w-48">
              {['All', 'Leadership', 'Compliance', 'Product', 'People', 'Technical', 'Business'].map((item) => <option key={item}>{item}</option>)}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => {
              const Icon = course.icon;
              const enrolled = enrolledCourses.includes(course.id);
              return (
                <article key={course.id} className="surface overflow-hidden rounded-xl border border-base shadow-card transition-transform hover:-translate-y-0.5">
                  <div className={`relative flex h-32 items-center justify-center bg-gradient-to-br ${course.color}`}>
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 25% 20%, white 0 2px, transparent 3px)', backgroundSize: '24px 24px' }} />
                    <Icon className="relative h-12 w-12 text-white/90" strokeWidth={1.5} />
                    <Badge className="absolute left-3 top-3 border-white/20 bg-black/20 text-white">{course.category}</Badge>
                  </div>
                  <div className="p-4">
                    <h2 className="text-sm font-semibold text-primary">{course.title}</h2>
                    <div className="mt-3 flex items-center gap-4 text-xs text-secondary">
                      <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{course.duration}</span>
                      <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{course.enrolled + (enrolled ? 1 : 0)} enrolled</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-base pt-3">
                      <span className="text-xs font-medium text-secondary">Self-paced</span>
                      <Button size="sm" variant={enrolled ? 'secondary' : 'primary'} disabled={enrolled} onClick={() => setEnrolledCourses((current) => [...current, course.id])}>{enrolled ? <><Check className="h-3.5 w-3.5" /> Enrolled</> : 'Enroll'}</Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {view === 'records' && (
        <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
          <div className="flex flex-col justify-between gap-3 border-b border-base px-5 py-4 sm:flex-row sm:items-center">
            <div><h2 className="text-sm font-semibold text-primary">Employee training record</h2><p className="mt-0.5 text-xs text-secondary">Completion, assessment, and certificate validity.</p></div>
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter records" className="pl-9 sm:w-64" /></div>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                <tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Course</th><th className="px-5 py-3">Completed</th><th className="px-5 py-3">Certificate valid until</th><th className="px-5 py-3">Score</th><th className="px-5 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {initialRecords.filter((record) => !query.trim() || `${record.employee} ${record.course}`.toLowerCase().includes(query.toLowerCase())).map((record) => (
                  <tr key={`${record.employee}-${record.course}`} className="hover:bg-[rgb(var(--bg-hover))]">
                    <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={record.employee} size="sm" /><div><div className="font-medium text-primary">{record.employee}</div><div className="text-xs text-secondary">{record.role}</div></div></div></td>
                    <td className="px-5 py-3 font-medium text-primary">{record.course}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-secondary">{record.completed}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-secondary">{record.validity}</td>
                    <td className="px-5 py-3"><span className="font-mono font-semibold text-primary">{record.score}%</span><div className="mt-1 h-1.5 w-20 rounded-full bg-[rgb(var(--bg-muted))]"><div className={`h-1.5 rounded-full ${record.score >= 80 ? 'bg-success-500' : record.score >= 60 ? 'bg-warning-500' : 'bg-error-500'}`} style={{ width: `${record.score}%` }} /></div></td>
                    <td className="px-5 py-3"><Badge tone={record.status === 'Completed' ? 'success' : record.status === 'Overdue' ? 'error' : 'warning'} dot>{record.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'certifications' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
          <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
            <div className="border-b border-base px-5 py-4"><h2 className="text-sm font-semibold text-primary">Certification expiry watchlist</h2><p className="mt-0.5 text-xs text-secondary">Renewals prioritized by remaining validity.</p></div>
            <div className="divide-y divide-[rgb(var(--border-base))]">
              {expiries.map((item) => {
                const urgency = item.days <= 7 ? 'error' : item.days <= 30 ? 'warning' : 'info';
                const bar = item.days <= 7 ? 'bg-error-500' : item.days <= 30 ? 'bg-warning-500' : 'bg-sky-500';
                return (
                  <div key={item.certification} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_170px_140px] sm:items-center">
                    <div><div className="font-medium text-primary">{item.certification}</div><div className="mt-1 flex items-center gap-2 text-xs text-secondary"><Avatar name={item.employee} size="sm" />{item.employee} · {item.owner}</div></div>
                    <div><div className="mb-1.5 flex justify-between text-[11px] text-secondary"><span>Validity remaining</span><span>{item.days} days</span></div><div className="h-2 rounded-full bg-[rgb(var(--bg-muted))]"><div className={`h-2 rounded-full ${bar}`} style={{ width: `${Math.min(100, Math.max(8, item.days))}%` }} /></div></div>
                    <div className="sm:text-right"><Badge tone={urgency} dot>{item.expires}</Badge></div>
                  </div>
                );
              })}
            </div>
          </section>
          <aside className="space-y-4">
            <section className="rounded-xl border border-error-200 bg-error-50 p-5 dark:border-error-800 dark:bg-error-950/30">
              <div className="flex items-center gap-2 text-error-700 dark:text-error-300"><AlertTriangle className="h-5 w-5" /><h3 className="text-sm font-semibold">Critical renewals</h3></div>
              <p className="mt-2 text-3xl font-bold text-error-700 dark:text-error-300">1</p><p className="mt-1 text-xs text-error-700/80 dark:text-error-300/80">Expires within seven days</p>
            </section>
            <section className="rounded-xl border border-warning-200 bg-warning-50 p-5 dark:border-warning-800 dark:bg-warning-950/30">
              <div className="flex items-center gap-2 text-warning-700 dark:text-warning-300"><CalendarClock className="h-5 w-5" /><h3 className="text-sm font-semibold">Due this month</h3></div>
              <p className="mt-2 text-3xl font-bold text-warning-700 dark:text-warning-300">3</p><p className="mt-1 text-xs text-warning-700/80 dark:text-warning-300/80">Renewal owners notified</p>
            </section>
            <Button className="w-full" variant="secondary" onClick={() => setAssignmentOpen(true)}>Assign renewal training</Button>
          </aside>
        </div>
      )}

      <Modal
        open={assignmentOpen}
        onClose={() => setAssignmentOpen(false)}
        title="Bulk assign training"
        description="Assign one course to a department or selected employees."
        size="lg"
        footer={<><Button variant="secondary" onClick={() => setAssignmentOpen(false)}>Cancel</Button><Button disabled={!selectedEmployees.length} onClick={assignTraining}>Assign to {selectedEmployees.length}</Button></>}
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="department">Department</Label><Select id="department" value={department} onChange={(event) => setDepartment(event.target.value)}><option>Product</option><option>Engineering</option><option>People</option><option>Finance</option><option>All departments</option></Select></div>
            <div><Label htmlFor="course">Course</Label><Select id="course" value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)}>{courses.map((course) => <option key={course.id}>{course.title}</option>)}</Select></div>
          </div>
          <div><Label htmlFor="due-date">Completion due date</Label><Input id="due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
          <div>
            <div className="mb-2 flex items-center justify-between"><Label>Employees</Label><button type="button" onClick={() => setSelectedEmployees(selectedEmployees.length === employees.length ? [] : employees)} className="text-xs font-medium text-accent-600">{selectedEmployees.length === employees.length ? 'Clear all' : 'Select all'}</button></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {employees.map((employee) => {
                const selected = selectedEmployees.includes(employee);
                return (
                  <button type="button" key={employee} onClick={() => toggleEmployee(employee)} className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${selected ? 'border-accent-400 bg-accent-50 dark:bg-accent-950/30' : 'border-base hover:bg-[rgb(var(--bg-hover))]'}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? 'border-accent-600 bg-accent-600 text-white' : 'border-strong'}`}>{selected && <Check className="h-3.5 w-3.5" />}</span>
                    <Avatar name={employee} size="sm" /><span className="text-sm font-medium text-primary">{employee}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="surface-muted flex items-start gap-3 rounded-lg p-3"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" /><p className="text-xs leading-5 text-secondary">Learners receive an email immediately and reminders seven days and one day before the due date.</p></div>
        </div>
      </Modal>
    </div>
  );
}
