import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  MessageSquareText,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Toggle';

type View = 'goals' | 'cycles' | 'review' | 'feedback' | 'promotion';
type RatingMap = Record<string, number>;

interface Goal {
  id: number;
  title: string;
  metric: string;
  progress: number;
  due: string;
  linked: string;
}

const initialGoals: Goal[] = [
  { id: 1, title: 'Increase enterprise activation', metric: 'Activation rate · 72% / 80%', progress: 72, due: '30 Sep 2026', linked: 'Company OKR · Growth' },
  { id: 2, title: 'Reduce support resolution time', metric: 'Median time · 5.8h / 4h', progress: 61, due: '15 Oct 2026', linked: 'CX · Operational excellence' },
  { id: 3, title: 'Launch manager analytics', metric: 'Milestones · 7 / 10', progress: 70, due: '31 Dec 2026', linked: 'Product · Insight platform' },
  { id: 4, title: 'Mentor emerging leaders', metric: 'Sessions · 8 / 12', progress: 67, due: '20 Dec 2026', linked: 'People · Leadership bench' },
];

const cycles = [
  { title: 'H2 2026 Performance Review', period: 'Jul – Dec 2026', status: 'In progress', completed: 184, total: 246, due: '18 Dec 2026' },
  { title: 'Q3 Probation Review', period: 'Jul – Sep 2026', status: 'Manager review', completed: 28, total: 34, due: '30 Sep 2026' },
  { title: 'H1 2026 Performance Review', period: 'Jan – Jun 2026', status: 'Completed', completed: 239, total: 239, due: 'Closed 19 Jul' },
  { title: 'Leadership Calibration 2025', period: 'Annual', status: 'Archived', completed: 42, total: 42, due: 'Closed 12 Jan' },
];

const competencies = [
  { key: 'impact', label: 'Business impact', detail: 'Prioritizes work that creates measurable customer and company value.' },
  { key: 'ownership', label: 'Ownership', detail: 'Takes accountability and resolves ambiguity proactively.' },
  { key: 'collaboration', label: 'Collaboration', detail: 'Builds trust across functions and shares context effectively.' },
  { key: 'craft', label: 'Functional excellence', detail: 'Demonstrates deep expertise and raises the quality bar.' },
];

const tabs: { id: View; label: string; icon: typeof Target }[] = [
  { id: 'goals', label: 'Goals & OKRs', icon: Target },
  { id: 'cycles', label: 'Review cycles', icon: CalendarDays },
  { id: 'review', label: 'Review form', icon: ClipboardCheck },
  { id: 'feedback', label: '360° feedback', icon: Users },
  { id: 'promotion', label: 'Promotion', icon: Trophy },
];

function Rating({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          role="radio"
          aria-checked={value === rating}
          onClick={() => onChange(rating)}
          className={`h-7 w-7 rounded-md border text-xs font-semibold transition-colors ${
            rating <= value
              ? 'border-accent-500 bg-accent-600 text-white'
              : 'border-base surface text-secondary hover:border-accent-400 hover:text-accent-600'
          }`}
        >
          {rating}
        </button>
      ))}
    </div>
  );
}

function RadarChart() {
  const labels = ['Impact', 'Ownership', 'Collaboration', 'Leadership', 'Craft'];
  const values = [4.4, 4.6, 4.1, 3.8, 4.5];
  const center = 130;
  const radius = 88;
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / labels.length;
    const distance = (radius * value) / 5;
    return `${center + Math.cos(angle) * distance},${center + Math.sin(angle) * distance}`;
  };
  return (
    <svg viewBox="0 0 260 260" className="mx-auto h-64 w-full max-w-[300px]" aria-label="360 feedback competency radar chart">
      {[1, 2, 3, 4, 5].map((level) => (
        <polygon
          key={level}
          points={labels.map((_, index) => point(index, level)).join(' ')}
          fill={level % 2 ? 'rgb(var(--bg-muted))' : 'none'}
          fillOpacity=".35"
          stroke="rgb(var(--border-strong))"
          strokeWidth="1"
        />
      ))}
      {labels.map((label, index) => {
        const [x, y] = point(index, 5);
        const [lx, ly] = point(index, 6.15);
        return (
          <g key={label}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="rgb(var(--border-base))" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-[rgb(var(--text-secondary))] text-[10px] font-medium">{label}</text>
          </g>
        );
      })}
      <polygon points={values.map((value, index) => point(index, value)).join(' ')} fill="rgb(37 99 235 / .2)" stroke="rgb(37 99 235)" strokeWidth="2" />
      {values.map((value, index) => {
        const [x, y] = point(index, value);
        return <circle key={labels[index]} cx={x} cy={y} r="3.5" fill="rgb(37 99 235)" />;
      })}
    </svg>
  );
}

export function PerformanceManagementPage() {
  const [view, setView] = useState<View>('goals');
  const [goalModal, setGoalModal] = useState(false);
  const [goals, setGoals] = useState(initialGoals);
  const [objective, setObjective] = useState('');
  const [keyResults, setKeyResults] = useState(['', '']);
  const [selfRatings, setSelfRatings] = useState<RatingMap>({ impact: 4, ownership: 5, collaboration: 4, craft: 4 });
  const [managerRatings, setManagerRatings] = useState<RatingMap>({ impact: 4, ownership: 4, collaboration: 5, craft: 4 });
  const [reviewSaved, setReviewSaved] = useState(false);
  const [decision, setDecision] = useState<'approved' | 'returned' | null>(null);
  const [promotionNote, setPromotionNote] = useState('Consistently operating at Staff level; recommend promotion in the October cycle.');

  const overall = useMemo(() => Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length), [goals]);

  const addGoal = () => {
    if (!objective.trim()) return;
    setGoals((current) => [
      ...current,
      {
        id: Date.now(),
        title: objective.trim(),
        metric: `${keyResults.filter((result) => result.trim()).length} key results`,
        progress: 0,
        due: '31 Dec 2026',
        linked: 'Company OKR · 2026 priorities',
      },
    ]);
    setObjective('');
    setKeyResults(['', '']);
    setGoalModal(false);
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-accent-600"><Sparkles className="h-3.5 w-3.5" /> Talent intelligence</div>
          <h1 className="text-xl font-bold text-primary">Performance Management</h1>
          <p className="mt-1 text-sm text-secondary">Align outcomes, run equitable reviews, and make confident talent decisions.</p>
        </div>
        <Button onClick={() => setGoalModal(true)}><Plus className="h-4 w-4" /> Add goal</Button>
      </header>

      <nav className="surface flex gap-1 overflow-x-auto rounded-xl border border-base p-1.5 shadow-card scrollbar-thin" aria-label="Performance sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                view === tab.id ? 'bg-accent-600 text-white shadow-sm' : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
              }`}
            >
              <Icon className="h-4 w-4" /> {tab.label}
            </button>
          );
        })}
      </nav>

      {view === 'goals' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Overall progress', `${overall}%`, TrendingUp, 'Across 4 active goals'],
              ['Goals on track', '3 / 4', Target, 'One goal needs attention'],
              ['Next deadline', '30 Sep', Clock3, 'Enterprise activation'],
            ].map(([label, value, Icon, detail]) => (
              <section key={String(label)} className="surface rounded-xl border border-base p-4 shadow-card">
                <div className="flex items-start justify-between">
                  <div><p className="text-xs font-medium text-secondary">{String(label)}</p><p className="mt-2 text-2xl font-bold text-primary">{String(value)}</p></div>
                  <div className="rounded-lg bg-accent-50 p-2 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400"><Icon className="h-5 w-5" /></div>
                </div>
                <p className="mt-2 text-xs text-muted">{String(detail)}</p>
              </section>
            ))}
          </div>
          <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
            <div className="flex items-center justify-between border-b border-base px-5 py-4">
              <div><h2 className="text-sm font-semibold text-primary">My 2026 goals</h2><p className="mt-0.5 text-xs text-secondary">Updated today at 10:42 AM</p></div>
              <Badge tone="accent">{goals.length} active</Badge>
            </div>
            <div className="grid gap-px bg-[rgb(var(--border-base))] lg:grid-cols-2">
              {goals.map((goal) => (
                <article key={goal.id} className="surface p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="text-sm font-semibold text-primary">{goal.title}</h3><p className="mt-1 text-xs text-secondary">{goal.metric}</p></div>
                    <Badge tone={goal.progress >= 65 ? 'success' : 'warning'}>{goal.progress >= 65 ? 'On track' : 'At risk'}</Badge>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs"><span className="text-secondary">Progress</span><span className="font-semibold text-primary">{goal.progress}%</span></div>
                    <div className="h-2 rounded-full bg-[rgb(var(--bg-muted))]"><div className="h-2 rounded-full bg-accent-600 transition-all" style={{ width: `${goal.progress}%` }} /></div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-base pt-3 text-xs text-secondary">
                    <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {goal.due}</span>
                    <button className="flex items-center gap-1 font-medium text-accent-600 hover:text-accent-700">{goal.linked}<ArrowUpRight className="h-3 w-3" /></button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {view === 'cycles' && (
        <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
          <div className="border-b border-base px-5 py-4"><h2 className="text-sm font-semibold text-primary">Review cycles</h2><p className="mt-0.5 text-xs text-secondary">Company-wide and targeted evaluation programs.</p></div>
          <div className="divide-y divide-[rgb(var(--border-base))]">
            {cycles.map((cycle) => {
              const percent = Math.round((cycle.completed / cycle.total) * 100);
              const tone = cycle.status === 'Completed' ? 'success' : cycle.status === 'Archived' ? 'neutral' : cycle.status === 'Manager review' ? 'warning' : 'accent';
              return (
                <button key={cycle.title} className="grid w-full gap-4 px-5 py-4 text-left hover:bg-[rgb(var(--bg-hover))] md:grid-cols-[1fr_150px_220px_120px_20px] md:items-center">
                  <div><div className="font-medium text-primary">{cycle.title}</div><div className="mt-1 text-xs text-secondary">{cycle.period}</div></div>
                  <Badge tone={tone} dot className="w-fit">{cycle.status}</Badge>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-secondary"><span>{cycle.completed} / {cycle.total} reviews</span><span>{percent}%</span></div>
                    <div className="h-1.5 rounded-full bg-[rgb(var(--bg-muted))]"><div className="h-1.5 rounded-full bg-accent-600" style={{ width: `${percent}%` }} /></div>
                  </div>
                  <span className="text-xs text-secondary">{cycle.due}</span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {view === 'review' && (
        <div className="space-y-5">
          <section className="surface flex flex-col gap-4 rounded-xl border border-base p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><Avatar name="Maya Patel" size="lg" /><div><h2 className="text-sm font-semibold text-primary">Maya Patel · H2 2026 Review</h2><p className="mt-0.5 text-xs text-secondary">Senior Product Manager · Product Platform</p></div></div>
            <div className="flex items-center gap-2"><Badge tone="warning" dot>Manager review</Badge><span className="text-xs text-secondary">Due 18 Dec</span></div>
          </section>
          <div className="grid gap-5 xl:grid-cols-2">
            {[
              { title: 'Self assessment', subtitle: 'Submitted 8 Dec 2026', values: selfRatings, setValues: setSelfRatings },
              { title: 'Manager assessment', subtitle: 'Draft · Not shared', values: managerRatings, setValues: setManagerRatings },
            ].map((column) => (
              <section key={column.title} className="surface rounded-xl border border-base shadow-card">
                <div className="border-b border-base px-5 py-4"><h3 className="text-sm font-semibold text-primary">{column.title}</h3><p className="mt-0.5 text-xs text-secondary">{column.subtitle}</p></div>
                <div className="divide-y divide-[rgb(var(--border-base))]">
                  {competencies.map((competency) => (
                    <div key={competency.key} className="p-5">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div className="max-w-sm"><div className="text-sm font-medium text-primary">{competency.label}</div><p className="mt-1 text-xs leading-5 text-secondary">{competency.detail}</p></div>
                        <Rating label={`${column.title}: ${competency.label}`} value={column.values[competency.key]} onChange={(rating) => column.setValues((current) => ({ ...current, [competency.key]: rating }))} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-base p-5"><Label>Overall comments</Label><Textarea rows={3} defaultValue={column.title.startsWith('Self') ? 'I strengthened the roadmap process and improved cross-team decision velocity.' : 'Maya has delivered strong outcomes while creating clarity across a complex program.'} /></div>
              </section>
            ))}
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setReviewSaved(true)}>Save draft</Button><Button onClick={() => setReviewSaved(true)}><Check className="h-4 w-4" /> Submit review</Button></div>
          {reviewSaved && <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-950/40 dark:text-success-300">Review saved successfully.</div>}
        </div>
      )}

      {view === 'feedback' && (
        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <section className="surface rounded-xl border border-base p-5 shadow-card">
            <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-primary">Competency signal</h2><p className="mt-1 text-xs text-secondary">14 responses · normalized to 5.0</p></div><Badge tone="accent">4.3 avg</Badge></div>
            <RadarChart />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="surface-muted rounded-lg p-3"><span className="text-secondary">Highest</span><div className="mt-1 font-semibold text-primary">Ownership · 4.6</div></div>
              <div className="surface-muted rounded-lg p-3"><span className="text-secondary">Opportunity</span><div className="mt-1 font-semibold text-primary">Leadership · 3.8</div></div>
            </div>
          </section>
          <section className="surface rounded-xl border border-base shadow-card">
            <div className="border-b border-base px-5 py-4"><h2 className="text-sm font-semibold text-primary">Feedback themes</h2><p className="mt-0.5 text-xs text-secondary">Comments are anonymized and grouped by relationship.</p></div>
            <div className="space-y-5 p-5">
              {[
                { group: 'Peers · 7 responses', tone: 'accent' as const, comments: ['Creates clarity quickly and makes space for dissent before decisions.', 'A dependable partner who connects product choices to customer evidence.'] },
                { group: 'Direct reports · 4 responses', tone: 'success' as const, comments: ['Gives actionable context and trusts us to own the solution.', 'Could share feedback earlier during high-pressure delivery periods.'] },
                { group: 'Cross-functional · 3 responses', tone: 'info' as const, comments: ['Consistently brings engineering, design, and GTM into one operating rhythm.'] },
              ].map((group) => (
                <div key={group.group}>
                  <Badge tone={group.tone}>{group.group}</Badge>
                  <div className="mt-2 space-y-2">
                    {group.comments.map((comment) => <blockquote key={comment} className="flex gap-3 rounded-lg border border-base p-3 text-sm leading-6 text-secondary"><MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />{comment}</blockquote>)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {view === 'promotion' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="surface rounded-xl border border-base shadow-card">
            <div className="flex flex-col gap-4 border-b border-base p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3"><Avatar name="Maya Patel" size="lg" /><div><h2 className="text-base font-semibold text-primary">Maya Patel</h2><p className="text-sm text-secondary">Senior Product Manager → Staff Product Manager</p></div></div>
              <Badge tone="warning" dot>{decision === 'approved' ? 'Approved' : decision === 'returned' ? 'Returned' : 'Awaiting committee'}</Badge>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-4">
              {[['Tenure', '3y 8m'], ['Current level', 'P4'], ['Performance', 'Exceeds'], ['Comp ratio', '0.91']].map(([label, value]) => <div key={label} className="surface-muted rounded-lg p-3"><div className="text-[11px] uppercase tracking-wide text-muted">{label}</div><div className="mt-1 text-sm font-semibold text-primary">{value}</div></div>)}
            </div>
            <div className="border-t border-base p-5">
              <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold text-primary">Performance history</h3><p className="text-xs text-secondary">Four review cycles</p></div><TrendingUp className="h-4 w-4 text-success-600" /></div>
              <svg viewBox="0 0 620 150" className="h-40 w-full" aria-label="Performance rating history chart">
                {[30, 65, 100, 135].map((y) => <line key={y} x1="30" y1={y} x2="600" y2={y} stroke="rgb(var(--border-base))" />)}
                <polyline points="55,108 225,83 395,67 565,38" fill="none" stroke="rgb(37 99 235)" strokeWidth="3" />
                {[['55','108','H1 25'],['225','83','H2 25'],['395','67','H1 26'],['565','38','H2 26']].map(([x,y,label]) => <g key={label}><circle cx={x} cy={y} r="5" fill="rgb(37 99 235)" /><text x={x} y="148" textAnchor="middle" className="fill-[rgb(var(--text-secondary))] text-[10px]">{label}</text></g>)}
              </svg>
            </div>
          </section>
          <aside className="surface rounded-xl border border-base p-5 shadow-card">
            <div className="flex items-center gap-2"><UserRoundCheck className="h-5 w-5 text-accent-600" /><h2 className="text-sm font-semibold text-primary">Recommendation</h2></div>
            <p className="mt-2 text-xs leading-5 text-secondary">Submitted by Priya Shah, VP Product · 22 Aug 2026</p>
            <div className="my-4 rounded-lg border border-accent-200 bg-accent-50 p-3 text-xs leading-5 text-accent-800 dark:border-accent-800 dark:bg-accent-950/40 dark:text-accent-200"><CircleDot className="mr-1 inline h-3.5 w-3.5" /> Evidence meets 5 of 5 Staff-level expectations.</div>
            <Label>Committee note</Label>
            <Textarea rows={6} value={promotionNote} onChange={(event) => setPromotionNote(event.target.value)} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setDecision('returned')}><RotateCcw className="h-4 w-4" /> Return</Button>
              <Button onClick={() => setDecision('approved')}><Check className="h-4 w-4" /> Approve</Button>
            </div>
            {decision && <p className="mt-3 text-center text-xs font-medium text-secondary">Recommendation {decision === 'approved' ? 'approved for calibration.' : 'returned to the submitter.'}</p>}
          </aside>
        </div>
      )}

      <Modal
        open={goalModal}
        onClose={() => setGoalModal(false)}
        title="Add goal & key results"
        description="Create a measurable objective and connect it to company priorities."
        size="lg"
        footer={<><Button variant="secondary" onClick={() => setGoalModal(false)}>Cancel</Button><Button onClick={addGoal}>Create goal</Button></>}
      >
        <div className="space-y-5">
          <div><Label htmlFor="objective">Objective</Label><Input id="objective" value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="e.g. Make enterprise onboarding effortless" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Owner</Label><Select defaultValue="Maya Patel"><option>Maya Patel</option><option>Product Platform</option></Select></div>
            <div><Label>Due date</Label><Input type="date" defaultValue="2026-12-31" /></div>
          </div>
          <div><Label>Linked company objective</Label><Select defaultValue="growth"><option value="growth">Growth · Expand enterprise revenue</option><option>Customer · Improve retention</option><option>People · Build leadership bench</option></Select></div>
          <div>
            <div className="mb-2 flex items-center justify-between"><Label>Key results</Label><button type="button" onClick={() => setKeyResults((current) => [...current, ''])} className="text-xs font-medium text-accent-600 hover:text-accent-700"><Plus className="mr-1 inline h-3.5 w-3.5" />Add result</button></div>
            <div className="space-y-2">
              {keyResults.map((result, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--bg-muted))] text-xs font-semibold text-secondary">KR{index + 1}</span>
                  <Input value={result} onChange={(event) => setKeyResults((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder="Define a measurable outcome" />
                  {keyResults.length > 1 && <Button type="button" size="icon" variant="ghost" onClick={() => setKeyResults((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</Button>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
