import { useMemo, useState } from 'react';
import {
  AlignLeft,
  BarChart3,
  ChevronDown,
  ChevronUp,
  CircleDot,
  ClipboardList,
  Eye,
  GripVertical,
  MessageSquareText,
  Plus,
  Radio,
  Send,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';

type PageView = 'builder' | 'results' | 'enps';
type QuestionType = 'multiple' | 'rating' | 'text';

interface SurveyQuestion {
  id: number;
  type: QuestionType;
  prompt: string;
  required: boolean;
  options?: string[];
}

const initialQuestions: SurveyQuestion[] = [
  { id: 1, type: 'rating', prompt: 'How satisfied are you with your experience at the company?', required: true },
  { id: 2, type: 'multiple', prompt: 'How supported do you feel by your direct manager?', required: true, options: ['Very supported', 'Supported', 'Neutral', 'Unsupported'] },
  { id: 3, type: 'text', prompt: 'What is one thing we could improve about your work experience?', required: false },
];

const questionMeta: Record<QuestionType, { label: string; icon: typeof Radio }> = {
  multiple: { label: 'Multiple choice', icon: CircleDot },
  rating: { label: 'Rating scale', icon: Star },
  text: { label: 'Open text', icon: AlignLeft },
};

const resultBars = [
  { label: 'Very satisfied', value: 46, color: 'bg-emerald-500' },
  { label: 'Satisfied', value: 34, color: 'bg-teal-500' },
  { label: 'Neutral', value: 13, color: 'bg-amber-400' },
  { label: 'Dissatisfied', value: 7, color: 'bg-rose-500' },
];

export function EmployeeEngagementPage() {
  const [view, setView] = useState<PageView>('builder');
  const [questions, setQuestions] = useState(initialQuestions);
  const [selectedId, setSelectedId] = useState(1);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [surveyTitle, setSurveyTitle] = useState('Quarterly Engagement Pulse');
  const [anonymous, setAnonymous] = useState(true);
  const [published, setPublished] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<number, string>>({});

  const selectedQuestion = questions.find((question) => question.id === selectedId) ?? questions[0];
  const completion = useMemo(() => {
    const answered = Object.values(previewAnswers).filter(Boolean).length;
    return Math.round((answered / Math.max(questions.length, 1)) * 100);
  }, [previewAnswers, questions.length]);

  const addQuestion = (type: QuestionType) => {
    const nextId = Math.max(0, ...questions.map((question) => question.id)) + 1;
    const next: SurveyQuestion = {
      id: nextId,
      type,
      prompt: type === 'rating' ? 'How would you rate this area?' : type === 'multiple' ? 'Choose the option that best describes your experience.' : 'Share your feedback.',
      required: false,
      ...(type === 'multiple' ? { options: ['Option 1', 'Option 2', 'Option 3'] } : {}),
    };
    setQuestions((current) => [...current, next]);
    setSelectedId(nextId);
  };

  const updateQuestion = (patch: Partial<SurveyQuestion>) => {
    setQuestions((current) => current.map((question) => question.id === selectedId ? { ...question, ...patch } : question));
  };

  const moveQuestion = (id: number, direction: -1 | 1) => {
    setQuestions((current) => {
      const index = current.findIndex((question) => question.id === id);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
      return reordered;
    });
  };

  const moveBefore = (targetId: number) => {
    if (draggedId === null || draggedId === targetId) return;
    setQuestions((current) => {
      const dragged = current.find((question) => question.id === draggedId);
      if (!dragged) return current;
      const without = current.filter((question) => question.id !== draggedId);
      const targetIndex = without.findIndex((question) => question.id === targetId);
      without.splice(targetIndex, 0, dragged);
      return without;
    });
    setDraggedId(null);
  };

  const deleteQuestion = (id: number) => {
    setQuestions((current) => current.filter((question) => question.id !== id));
    if (selectedId === id) setSelectedId(questions.find((question) => question.id !== id)?.id ?? 0);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div><h1 className="text-xl font-bold text-primary">Employee Engagement</h1><p className="mt-0.5 text-sm text-secondary">Design pulse surveys, understand sentiment, and track advocacy.</p></div>
        <div className="flex items-center gap-2">
          {view === 'builder' && <Button variant="secondary" onClick={() => setPublished(false)}><Eye className="h-4 w-4" /> Preview</Button>}
          {view === 'builder' && <Button onClick={() => setPublished(true)}><Send className="h-4 w-4" /> Publish survey</Button>}
        </div>
      </div>

      <div className="surface flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-base p-1 shadow-card">
        {[
          { id: 'builder' as const, label: 'Survey builder', icon: ClipboardList },
          { id: 'results' as const, label: 'Results dashboard', icon: BarChart3 },
          { id: 'enps' as const, label: 'eNPS trends', icon: TrendingUp },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setView(id)} className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${view === id ? 'bg-accent-600 text-white shadow-sm' : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {published && view === 'builder' && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-success-800 dark:border-success-800/60 dark:bg-success-950/30 dark:text-success-200">
          <div className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4" /><span><strong>{surveyTitle}</strong> is live for 486 employees.</span></div>
          <button onClick={() => setPublished(false)} className="text-xs font-semibold hover:underline">Return to draft</button>
        </div>
      )}

      {view === 'builder' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(380px,.92fr)]">
          <div className="space-y-5">
            <section className="surface rounded-xl border border-base p-5 shadow-card">
              <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                <div><Label htmlFor="survey-title">Survey title</Label><Input id="survey-title" value={surveyTitle} onChange={(event) => setSurveyTitle(event.target.value)} /></div>
                <div><Label htmlFor="survey-audience">Audience</Label><Select id="survey-audience"><option>All employees (486)</option><option>People managers (68)</option><option>Custom audience</option></Select></div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-[rgb(var(--bg-muted))] p-3">
                <div><p className="text-sm font-medium text-primary">Anonymous responses</p><p className="text-xs text-muted">Identity will not be connected to individual answers.</p></div>
                <Toggle checked={anonymous} onChange={setAnonymous} />
              </div>
            </section>

            <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
              <div className="flex flex-col justify-between gap-3 border-b border-base px-5 py-4 sm:flex-row sm:items-center">
                <div><h2 className="text-sm font-semibold text-primary">Questions</h2><p className="mt-0.5 text-xs text-muted">Drag cards or use arrows to reorder.</p></div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(questionMeta) as QuestionType[]).map((type) => {
                    const Icon = questionMeta[type].icon;
                    return <Button key={type} variant="secondary" size="sm" onClick={() => addQuestion(type)}><Icon className="h-3.5 w-3.5" /> {questionMeta[type].label}</Button>;
                  })}
                </div>
              </div>
              <div className="space-y-3 p-4">
                {questions.map((question, index) => {
                  const TypeIcon = questionMeta[question.type].icon;
                  const active = selectedId === question.id;
                  return (
                    <div
                      key={question.id}
                      draggable
                      onDragStart={() => setDraggedId(question.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => moveBefore(question.id)}
                      onClick={() => setSelectedId(question.id)}
                      className={`group flex cursor-pointer gap-3 rounded-xl border p-4 transition-all ${active ? 'border-accent-400 bg-accent-50/50 ring-2 ring-accent-500/10 dark:border-accent-700 dark:bg-accent-950/20' : 'border-base hover:border-strong'} ${draggedId === question.id ? 'opacity-50' : ''}`}
                    >
                      <GripVertical className="mt-0.5 h-5 w-5 shrink-0 cursor-grab text-muted active:cursor-grabbing" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-muted">Q{index + 1}</span><Badge tone="neutral"><TypeIcon className="mr-1 h-3 w-3" />{questionMeta[question.type].label}</Badge>{question.required && <Badge tone="accent">Required</Badge>}</div>
                        <p className="mt-2 text-sm font-medium text-primary">{question.prompt}</p>
                      </div>
                      <div className="flex shrink-0 items-start">
                        <button aria-label="Move question up" onClick={(event) => { event.stopPropagation(); moveQuestion(question.id, -1); }} disabled={index === 0} className="rounded p-1.5 text-muted hover:bg-[rgb(var(--bg-hover))] hover:text-primary disabled:opacity-25"><ChevronUp className="h-4 w-4" /></button>
                        <button aria-label="Move question down" onClick={(event) => { event.stopPropagation(); moveQuestion(question.id, 1); }} disabled={index === questions.length - 1} className="rounded p-1.5 text-muted hover:bg-[rgb(var(--bg-hover))] hover:text-primary disabled:opacity-25"><ChevronDown className="h-4 w-4" /></button>
                        <button aria-label="Delete question" onClick={(event) => { event.stopPropagation(); deleteQuestion(question.id); }} className="rounded p-1.5 text-muted hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-950/30"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  );
                })}
                {!questions.length && <div className="rounded-xl border border-dashed border-strong p-10 text-center text-sm text-muted">Add your first question to begin.</div>}
              </div>
            </section>

            {selectedQuestion && (
              <section className="surface rounded-xl border border-base p-5 shadow-card">
                <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-primary">Edit question</h2><div className="flex items-center gap-2 text-xs text-secondary"><span>Required</span><Toggle size="sm" checked={selectedQuestion.required} onChange={(required) => updateQuestion({ required })} /></div></div>
                <div className="mt-4"><Label htmlFor="question-prompt">Question prompt</Label><Textarea id="question-prompt" rows={2} value={selectedQuestion.prompt} onChange={(event) => updateQuestion({ prompt: event.target.value })} /></div>
                {selectedQuestion.type === 'multiple' && (
                  <div className="mt-4 space-y-2">
                    <Label>Answer options</Label>
                    {selectedQuestion.options?.map((option, index) => (
                      <div key={`${selectedQuestion.id}-${index}`} className="flex items-center gap-2"><Radio className="h-4 w-4 text-muted" /><Input value={option} onChange={(event) => updateQuestion({ options: selectedQuestion.options?.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} /></div>
                    ))}
                    <button onClick={() => updateQuestion({ options: [...(selectedQuestion.options ?? []), `Option ${(selectedQuestion.options?.length ?? 0) + 1}`] })} className="inline-flex items-center gap-1 text-xs font-semibold text-accent-600 hover:text-accent-700 dark:text-accent-400"><Plus className="h-3.5 w-3.5" /> Add option</button>
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="xl:sticky xl:top-5 xl:self-start">
            <SurveyPreview title={surveyTitle} anonymous={anonymous} questions={questions} answers={previewAnswers} setAnswer={(id, value) => setPreviewAnswers((current) => ({ ...current, [id]: value }))} completion={completion} />
          </div>
        </div>
      )}

      {view === 'results' && <ResultsDashboard />}
      {view === 'enps' && <EnpsDashboard />}
    </div>
  );
}

function SurveyPreview({ title, anonymous, questions, answers, setAnswer, completion }: { title: string; anonymous: boolean; questions: SurveyQuestion[]; answers: Record<number, string>; setAnswer: (id: number, value: string) => void; completion: number }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-base bg-[rgb(var(--bg-muted))] shadow-card">
      <div className="flex items-center justify-between border-b border-base px-5 py-3"><div className="flex items-center gap-2 text-xs font-semibold text-secondary"><Eye className="h-3.5 w-3.5" /> LIVE EMPLOYEE PREVIEW</div><Badge tone="neutral">{completion}% complete</Badge></div>
      <div className="max-h-[760px] overflow-y-auto p-4 sm:p-6">
        <div className="surface mx-auto max-w-xl overflow-hidden rounded-xl border border-base shadow-card">
          <div className="bg-accent-600 p-6 text-white"><p className="text-xs font-medium uppercase tracking-widest text-white/70">People experience</p><h2 className="mt-2 text-xl font-bold">{title || 'Untitled survey'}</h2><div className="mt-3 flex items-center gap-2 text-xs text-white/80">{anonymous ? <><Users className="h-3.5 w-3.5" /> Your responses are anonymous</> : <><MessageSquareText className="h-3.5 w-3.5" /> Responses include your profile</>}</div></div>
          <div className="space-y-7 p-6">
            {questions.map((question, index) => (
              <div key={question.id}>
                <p className="mb-3 text-sm font-semibold text-primary"><span className="mr-2 text-muted">{index + 1}.</span>{question.prompt}{question.required && <span className="ml-1 text-error-500">*</span>}</p>
                {question.type === 'rating' && <div className="flex gap-2">{[1, 2, 3, 4, 5].map((score) => <button key={score} onClick={() => setAnswer(question.id, String(score))} className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${answers[question.id] === String(score) ? 'border-accent-600 bg-accent-600 text-white' : 'border-base text-secondary hover:border-accent-400'}`}>{score}</button>)}</div>}
                {question.type === 'multiple' && <div className="space-y-2">{question.options?.map((option) => <button key={option} onClick={() => setAnswer(question.id, option)} className={`flex w-full items-center gap-2 rounded-lg border p-3 text-left text-sm ${answers[question.id] === option ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-950/30 dark:text-accent-300' : 'border-base text-secondary hover:border-strong'}`}><span className={`h-3.5 w-3.5 rounded-full border-2 ${answers[question.id] === option ? 'border-4 border-accent-500' : 'border-strong'}`} />{option}</button>)}</div>}
                {question.type === 'text' && <Textarea rows={3} placeholder="Type your response…" value={answers[question.id] ?? ''} onChange={(event) => setAnswer(question.id, event.target.value)} />}
              </div>
            ))}
            <Button className="w-full">Submit response</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResultsDashboard() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="Responses" value="387 / 486" detail="79.6% participation" />
        <MetricCard icon={Sparkles} label="Positive sentiment" value="78%" detail="+6% vs last pulse" tone="text-emerald-500" />
        <MetricCard icon={MessageSquareText} label="Comments" value="214" detail="163 constructive" />
        <MetricCard icon={TrendingUp} label="Engagement index" value="8.1" detail="+0.4 quarter over quarter" tone="text-accent-500" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="surface rounded-xl border border-base p-5 shadow-card">
          <h2 className="text-sm font-semibold text-primary">Response rate</h2><p className="mt-0.5 text-xs text-muted">Quarterly pulse · All employees</p>
          <div className="mt-5 flex items-center justify-center">
            <div className="relative h-52 w-52">
              <svg viewBox="0 0 120 120" className="-rotate-90"><circle cx="60" cy="60" r="47" fill="none" stroke="rgb(var(--border-base))" strokeWidth="13" /><circle cx="60" cy="60" r="47" fill="none" stroke="rgb(var(--accent-500))" strokeWidth="13" strokeLinecap="round" strokeDasharray="235 296" /></svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold text-primary">79.6%</span><span className="text-xs text-muted">387 responses</span></div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center"><div className="rounded-lg bg-[rgb(var(--bg-muted))] p-3"><p className="text-lg font-bold text-primary">326</p><p className="text-xs text-muted">Completed</p></div><div className="rounded-lg bg-[rgb(var(--bg-muted))] p-3"><p className="text-lg font-bold text-primary">61</p><p className="text-xs text-muted">In progress</p></div></div>
        </section>

        <section className="surface rounded-xl border border-base p-5 shadow-card">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-primary">Overall satisfaction</h2><p className="mt-0.5 text-xs text-muted">387 responses</p></div><Badge tone="success">80% favorable</Badge></div>
          <div className="mt-8 space-y-5">
            {resultBars.map((bar) => (
              <div key={bar.label}><div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-secondary">{bar.label}</span><span className="font-semibold text-primary">{bar.value}%</span></div><div className="h-3 overflow-hidden rounded-full bg-[rgb(var(--bg-muted))]"><div className={`h-full rounded-full ${bar.color}`} style={{ width: `${bar.value}%` }} /></div></div>
            ))}
          </div>
          <div className="mt-8 border-t border-base pt-5"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Manager support by department</p>{[['Product', 87], ['People', 84], ['Engineering', 79], ['Commercial', 68]].map(([team, score]) => <div key={String(team)} className="mb-3 grid grid-cols-[90px_1fr_38px] items-center gap-3 text-xs"><span className="text-secondary">{team}</span><div className="h-2 rounded-full bg-[rgb(var(--bg-muted))]"><div className="h-2 rounded-full bg-accent-500" style={{ width: `${score}%` }} /></div><span className="text-right font-semibold text-primary">{score}%</span></div>)}</div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface rounded-xl border border-base p-5 shadow-card"><h2 className="text-sm font-semibold text-primary">Comment themes</h2><p className="mt-0.5 text-xs text-muted">Most common terms from 214 open responses</p><div className="mt-6 flex min-h-52 flex-wrap items-center justify-center gap-x-5 gap-y-3 rounded-xl bg-[rgb(var(--bg-muted))] p-6 text-center">{[['flexibility', 'text-2xl text-accent-600'], ['growth', 'text-3xl text-emerald-500'], ['manager support', 'text-xl text-sky-500'], ['workload', 'text-2xl text-amber-500'], ['recognition', 'text-lg text-violet-500'], ['collaboration', 'text-xl text-teal-500'], ['communication', 'text-2xl text-rose-400'], ['learning', 'text-lg text-indigo-500'], ['purpose', 'text-xl text-cyan-600'], ['benefits', 'text-base text-secondary']].map(([word, style]) => <span key={word} className={`font-semibold ${style}`}>{word}</span>)}</div></section>
        <section className="surface rounded-xl border border-base p-5 shadow-card"><h2 className="text-sm font-semibold text-primary">Sentiment summary</h2><p className="mt-0.5 text-xs text-muted">AI-assisted theme classification</p><div className="mt-5 space-y-3"><SentimentRow label="Positive" count={167} percent={78} color="bg-emerald-500" icon="😊" /><SentimentRow label="Neutral" count={28} percent={13} color="bg-amber-400" icon="😐" /><SentimentRow label="Negative" count={19} percent={9} color="bg-rose-500" icon="😟" /></div><div className="mt-5 rounded-lg border border-accent-200 bg-accent-50 p-4 text-sm text-accent-800 dark:border-accent-800/60 dark:bg-accent-950/30 dark:text-accent-200"><Sparkles className="mb-2 h-4 w-4" /><strong>Key insight:</strong> Growth opportunities improved, while workload remains the strongest negative theme in Commercial and Support.</div></section>
      </div>
    </div>
  );
}

function EnpsDashboard() {
  const points = [62, 66, 64, 71, 74, 72, 78];
  const coordinates = points.map((value, index) => `${55 + index * 91},${250 - (value - 40) * 4}`).join(' ');
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3"><MetricCard icon={TrendingUp} label="Current eNPS" value="+38" detail="+6 since Q2" tone="text-emerald-500" /><MetricCard icon={Users} label="Promoters" value="62%" detail="240 respondents" tone="text-emerald-500" /><MetricCard icon={MessageSquareText} label="Detractors" value="24%" detail="93 respondents" tone="text-rose-500" /></div>
      <section className="surface rounded-xl border border-base p-5 shadow-card">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-sm font-semibold text-primary">eNPS trend</h2><p className="mt-0.5 text-xs text-muted">Employee recommendation score · Last 7 quarters</p></div><div className="flex flex-wrap gap-3 text-xs"><Legend color="bg-emerald-500" label="Promoters 9–10" /><Legend color="bg-amber-400" label="Passives 7–8" /><Legend color="bg-rose-500" label="Detractors 0–6" /></div></div>
        <div className="mt-6 overflow-x-auto">
          <svg viewBox="0 0 660 300" className="min-w-[620px]">
            <rect x="45" y="35" width="575" height="75" rx="4" fill="rgb(16 185 129 / .10)" /><rect x="45" y="110" width="575" height="70" fill="rgb(245 158 11 / .10)" /><rect x="45" y="180" width="575" height="70" rx="4" fill="rgb(244 63 94 / .08)" />
            {[50, 90, 130, 170, 210, 250].map((y) => <line key={y} x1="45" x2="620" y1={y} y2={y} stroke="rgb(var(--border-base))" strokeWidth="1" />)}
            <polyline points={coordinates} fill="none" stroke="rgb(var(--accent-500))" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((value, index) => <g key={index}><circle cx={55 + index * 91} cy={250 - (value - 40) * 4} r="6" fill="rgb(var(--accent-500))" stroke="rgb(var(--bg-surface))" strokeWidth="3" /><text x={55 + index * 91} y={242 - (value - 40) * 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor" className="text-primary">{value - 40 > 0 ? '+' : ''}{value - 40}</text></g>)}
            {['Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26', 'Q2 26', 'Q3 26'].map((label, index) => <text key={label} x={55 + index * 91} y="277" textAnchor="middle" fontSize="11" fill="currentColor" className="text-muted">{label}</text>)}
          </svg>
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-3">{[['Promoters', '240', '62%', 'bg-emerald-500', 'Enthusiastic advocates who are likely to recommend the company.'], ['Passives', '54', '14%', 'bg-amber-400', 'Generally satisfied, but not yet strongly connected or advocating.'], ['Detractors', '93', '24%', 'bg-rose-500', 'Employees whose concerns need focused listening and action.']].map(([label, count, percent, color, description]) => <section key={label} className="surface rounded-xl border border-base p-5 shadow-card"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${color}`} /><h3 className="text-sm font-semibold text-primary">{label}</h3></div><span className="text-2xl font-bold text-primary">{percent}</span></div><p className="mt-1 text-xs text-muted">{count} respondents</p><p className="mt-4 text-sm text-secondary">{description}</p></section>)}</div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'text-accent-500' }: { icon: typeof Users; label: string; value: string; detail: string; tone?: string }) {
  return <div className="surface rounded-xl border border-base p-4 shadow-card"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-secondary">{label}</p><p className="mt-2 text-2xl font-bold text-primary">{value}</p><p className="mt-1 text-xs text-muted">{detail}</p></div><div className={`rounded-lg bg-[rgb(var(--bg-muted))] p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div></div></div>;
}

function SentimentRow({ label, count, percent, color, icon }: { label: string; count: number; percent: number; color: string; icon: string }) {
  return <div className="rounded-lg border border-base p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span>{icon}</span><span className="text-sm font-medium text-primary">{label}</span></div><span className="text-sm font-semibold text-primary">{percent}%</span></div><div className="mt-3 h-2 rounded-full bg-[rgb(var(--bg-muted))]"><div className={`h-2 rounded-full ${color}`} style={{ width: `${percent}%` }} /></div><p className="mt-2 text-xs text-muted">{count} classified comments</p></div>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5 text-secondary"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</span>;
}
