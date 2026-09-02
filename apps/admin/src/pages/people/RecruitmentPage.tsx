import { useState } from 'react';
import {
  Plus,
  Star,
  Mail,
  Clock,
  ArrowLeft,
  FileText,
  Check,
  X,
  Download,
  Send,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { useNav } from '@/context/NavContext';
import { candidates, type Candidate } from '@/data/mockData';

const stages: { key: Candidate['stage']; label: string; color: string }[] = [
  { key: 'Applied', label: 'Applied', color: 'border-t-slate-400' },
  { key: 'Screening', label: 'Screening', color: 'border-t-sky-500' },
  { key: 'Interview', label: 'Interview', color: 'border-t-accent-500' },
  { key: 'Offer', label: 'Offer', color: 'border-t-warning-500' },
  { key: 'Hired', label: 'Hired', color: 'border-t-success-500' },
];

function KanbanCard({ candidate, onClick }: { candidate: Candidate; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="surface rounded-lg border shadow-card p-3 hover:shadow-card-hover hover:-translate-y-0.5 transition-all cursor-pointer"
    >
      <div className="flex items-start gap-2.5">
        <div className={`h-8 w-8 rounded-full ${candidate.avatarColor} flex items-center justify-center text-xs font-semibold shrink-0`}>
          {candidate.name.split(' ').map((n) => n[0]).join('')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-primary truncate">{candidate.name}</div>
          <div className="text-xs text-secondary truncate">{candidate.role}</div>
        </div>
        {candidate.rating > 0 && (
          <div className="flex items-center gap-0.5">
            <Star className="h-3 w-3 text-warning-500 fill-warning-500" />
            <span className="text-xs text-muted">{candidate.rating}</span>
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted">
        <Clock className="h-3 w-3" /> {candidate.experience}
        <span>·</span>
        <Mail className="h-3 w-3" />
      </div>
    </div>
  );
}

export function RecruitmentPage() {
  const { navigate } = useNav();
  const [addOpen, setAddOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [candidateList, setCandidateList] = useState(candidates);

  const handleDrop = (stage: Candidate['stage']) => {
    if (!draggedId) return;
    setCandidateList((prev) => prev.map((c) => (c.id === draggedId ? { ...c, stage } : c)));
    setDraggedId(null);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Recruitment Pipeline</h1>
          <p className="text-sm text-secondary mt-0.5">{candidateList.length} candidates · {stages.length} stages</p>
        </div>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Candidate
        </Button>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto scrollbar-thin pb-4">
        {stages.map((stage) => {
          const stageCandidates = candidateList.filter((c) => c.stage === stage.key);
          return (
            <div
              key={stage.key}
              className="flex flex-col w-72 shrink-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage.key)}
            >
              <div className={`surface rounded-t-xl border border-b-0 ${stage.color} border-t-2 px-3 py-2.5 flex items-center justify-between`}>
                <span className="text-sm font-semibold text-primary">{stage.label}</span>
                <Badge tone="neutral">{stageCandidates.length}</Badge>
              </div>
              <div className="surface rounded-b-xl border border-t-0 p-2.5 space-y-2 min-h-[200px] flex-1">
                {stageCandidates.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDraggedId(c.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className={draggedId === c.id ? 'opacity-50' : ''}
                  >
                    <KanbanCard candidate={c} onClick={() => navigate('candidate-profile')} />
                  </div>
                ))}
                {stageCandidates.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-xs text-muted border-2 border-dashed border-base rounded-lg">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add candidate modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Candidate"
        description="Add a new candidate to the pipeline"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setAddOpen(false)}><Check className="h-4 w-4" /> Add Candidate</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Full Name</Label>
              <Input placeholder="e.g. Jennifer Wu" />
            </div>
            <div>
              <Label>Applying For</Label>
              <Select><option>Senior Frontend Engineer</option><option>Backend Engineer</option><option>Product Designer</option><option>Sales Executive</option></Select>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" placeholder="candidate@email.com" />
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input placeholder="+1 415 555 0000" />
            </div>
            <div>
              <Label>Experience</Label>
              <Input placeholder="e.g. 5 years" />
            </div>
            <div>
              <Label>Initial Stage</Label>
              <Select><option>Applied</option><option>Screening</option></Select>
            </div>
          </div>
          <div>
            <Label>Resume / Notes</Label>
            <Textarea rows={3} placeholder="Paste resume link or notes..." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
