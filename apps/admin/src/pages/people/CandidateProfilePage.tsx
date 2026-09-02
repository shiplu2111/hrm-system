import { useState } from 'react';
import {
  ArrowLeft,
  Star,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  Award,
  Check,
  X,
  Send,
  FileText,
  Download,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { useNav } from '@/context/NavContext';
import { candidates } from '@/data/mockData';

const interviewRounds = [
  { id: 1, round: 'Technical', interviewer: 'Sarah Chen', date: '2024-08-20', status: 'completed' as const, score: 4.5, notes: 'Strong problem-solving, excellent system design knowledge.' },
  { id: 2, round: 'HR', interviewer: 'Sofia Martinez', date: '2024-08-22', status: 'completed' as const, score: 4.0, notes: 'Good communication, aligns with company values.' },
  { id: 3, round: 'Management', interviewer: 'John Smith', date: '2024-08-25', status: 'scheduled' as const, score: 0, notes: '' },
  { id: 4, round: 'Final', interviewer: 'Pending', date: '—', status: 'pending' as const, score: 0, notes: '' },
];

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange?.(star)}
          className="transition-transform hover:scale-110"
          disabled={!onChange}
        >
          <Star className={`h-4 w-4 ${star <= value ? 'text-warning-500 fill-warning-500' : 'text-slate-300 dark:text-slate-600'}`} />
        </button>
      ))}
    </div>
  );
}

export function CandidateProfilePage() {
  const { navigate } = useNav();
  const candidate = candidates[4]; // Mei Lin
  const [scoringOpen, setScoringOpen] = useState(false);
  const [scores, setScores] = useState({ technical: 4, culture: 4, communication: 5, overall: 4 });

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <button onClick={() => navigate('recruitment')} className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Pipeline
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Profile + Resume */}
        <div className="space-y-6">
          <Card>
            <CardBody className="flex flex-col items-center text-center">
              <div className={`h-16 w-16 rounded-full ${candidate.avatarColor} flex items-center justify-center text-xl font-semibold`}>
                {candidate.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div className="mt-3 text-lg font-bold text-primary">{candidate.name}</div>
              <div className="text-sm text-secondary">{candidate.role}</div>
              <div className="mt-2"><Badge tone="accent" dot>{candidate.stage}</Badge></div>
              <div className="mt-4 pt-4 border-t border-base w-full space-y-2 text-left">
                <div className="flex items-center gap-2 text-xs text-secondary"><Mail className="h-3.5 w-3.5" /> {candidate.email}</div>
                <div className="flex items-center gap-2 text-xs text-secondary"><Briefcase className="h-3.5 w-3.5" /> {candidate.experience} experience</div>
                <div className="flex items-center gap-2 text-xs text-secondary"><Star className="h-3.5 w-3.5 text-warning-500" /> Rating: {candidate.rating}/5</div>
              </div>
              <div className="mt-4 flex gap-2 w-full">
                <Button variant="secondary" size="sm" className="flex-1"><Send className="h-3.5 w-3.5" /> Message</Button>
                <Button variant="primary" size="sm" className="flex-1" onClick={() => navigate('offer-letter')}>Send Offer</Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Resume Preview</CardTitle>
              <Button variant="ghost" size="sm"><Download className="h-3.5 w-3.5" /></Button>
            </CardHeader>
            <CardBody>
              <div className="aspect-[1/1.414] surface border border-base rounded-lg p-4 text-xs space-y-2 overflow-hidden">
                <div className="text-center pb-2 border-b border-base">
                  <div className="text-sm font-bold text-primary">{candidate.name}</div>
                  <div className="text-muted">{candidate.role}</div>
                </div>
                <div className="space-y-1.5">
                  <div className="font-semibold text-primary text-[11px]">Experience</div>
                  <div className="text-secondary">Senior Engineer at TechCorp (2021-Present)</div>
                  <div className="text-secondary">Engineer at DataSys (2018-2021)</div>
                </div>
                <div className="space-y-1.5">
                  <div className="font-semibold text-primary text-[11px]">Education</div>
                  <div className="text-secondary">M.S. Computer Science — Stanford</div>
                </div>
                <div className="space-y-1.5">
                  <div className="font-semibold text-primary text-[11px]">Skills</div>
                  <div className="flex flex-wrap gap-1">
                    {['React', 'TypeScript', 'Node.js', 'AWS', 'GraphQL'].map((s) => (
                      <span key={s} className="px-1.5 py-0.5 rounded bg-[rgb(var(--bg-muted))] text-muted text-[10px]">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right: Interview timeline + scoring */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Interview Timeline</CardTitle>
              <Button variant="secondary" size="sm" onClick={() => setScoringOpen(true)}>Score Interview</Button>
            </CardHeader>
            <CardBody className="p-0">
              <div className="relative px-5 py-4">
                {interviewRounds.map((round, i) => {
                  const isLast = i === interviewRounds.length - 1;
                  const toneClass = round.status === 'completed' ? 'bg-success-100 text-success-700 dark:bg-success-950/40 dark:text-success-300' :
                    round.status === 'scheduled' ? 'bg-accent-100 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300' :
                    'bg-slate-100 dark:bg-slate-800 text-muted';
                  return (
                    <div key={round.id} className="flex gap-3 pb-6 relative">
                      {!isLast && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-[rgb(var(--border-base))]" />}
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${toneClass}`}>
                        {round.status === 'completed' ? <Check className="h-4 w-4" /> : round.status === 'scheduled' ? <Briefcase className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-primary">{round.round} Interview</span>
                          {round.status === 'completed' ? (
                            <Badge tone="success">Scored: {round.score}/5</Badge>
                          ) : round.status === 'scheduled' ? (
                            <Badge tone="accent" dot>Scheduled</Badge>
                          ) : (
                            <Badge tone="neutral">Pending</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted mt-0.5">{round.interviewer} · {round.date}</div>
                        {round.notes && <p className="text-xs text-secondary mt-1.5 bg-[rgb(var(--bg-muted))] rounded-lg p-2">{round.notes}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Candidate Scoring</CardTitle></CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Technical Skills', value: scores.technical, key: 'technical' as const },
                  { label: 'Culture Fit', value: scores.culture, key: 'culture' as const },
                  { label: 'Communication', value: scores.communication, key: 'communication' as const },
                  { label: 'Overall', value: scores.overall, key: 'overall' as const },
                ].map((s) => (
                  <div key={s.label} className="surface border border-base rounded-lg p-3">
                    <div className="text-xs text-muted mb-1.5">{s.label}</div>
                    <StarRating value={s.value} />
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-base">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">Average Score</span>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-warning-500 fill-warning-500" />
                    <span className="text-lg font-bold text-primary">{((scores.technical + scores.culture + scores.communication + scores.overall) / 4).toFixed(1)}</span>
                    <span className="text-sm text-muted">/ 5</span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Scoring modal */}
      <Modal
        open={scoringOpen}
        onClose={() => setScoringOpen(false)}
        title="Interview Scoring"
        description={`Score ${candidate.name} for the Management round`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setScoringOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setScoringOpen(false)}><Check className="h-4 w-4" /> Submit Score</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Interview Round</Label>
            <Select><option>Management</option><option>Final</option></Select>
          </div>
          <div>
            <Label>Interviewer</Label>
            <Input defaultValue="John Smith" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Technical Skills', key: 'technical' as const },
              { label: 'Culture Fit', key: 'culture' as const },
              { label: 'Communication', key: 'communication' as const },
              { label: 'Overall Impression', key: 'overall' as const },
            ].map((s) => (
              <div key={s.key} className="surface border border-base rounded-lg p-3">
                <div className="text-xs text-muted mb-2">{s.label}</div>
                <StarRating value={scores[s.key]} onChange={(v) => setScores((prev) => ({ ...prev, [s.key]: v }))} />
              </div>
            ))}
          </div>
          <div>
            <Label>Interview Notes</Label>
            <Textarea rows={4} placeholder="Detailed feedback..." />
          </div>
          <div>
            <Label>Recommendation</Label>
            <Select><option>Strong Hire</option><option>Hire</option><option>Neutral</option><option>No Hire</option><option>Strong No Hire</option></Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
