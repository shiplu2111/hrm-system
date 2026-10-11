import { useEffect, useState } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';
import {
  SKILL_PROFICIENCY_LEVELS,
  type EmployeeSkillRecord,
  type SkillProficiencyLevel,
  type SkillRecord,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Banner, errorMessage } from '@/components/performance/performance-ui';
import { formatDateOnly } from '@/lib/currency-display';
import { deleteEmployeeSkill, SKILL_LEVEL_LABELS, upsertEmployeeSkill } from '@/lib/training-api';
import { SKILL_LEVEL_CELL, todayDateOnly } from './training-ui';

export interface SkillLevelTarget {
  employeeId: string;
  employeeName: string;
  skill: SkillRecord;
  rating: EmployeeSkillRecord | null;
}

const LEVEL_HINTS: Record<SkillProficiencyLevel, string> = {
  none: 'Assessed, no working knowledge yet',
  beginner: 'Needs guidance on routine tasks',
  intermediate: 'Works independently on routine tasks',
  advanced: 'Handles complex work, guides others',
  expert: 'Recognised authority, sets the standard',
};

export function SkillLevelModal({
  target,
  companyId,
  onClose,
  onSaved,
}: {
  /** Closed when null. */
  target: SkillLevelTarget | null;
  companyId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [level, setLevel] = useState<SkillProficiencyLevel | null>(null);
  const [assessedAt, setAssessedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayDateOnly();

  useEffect(() => {
    if (!target) return;
    setLevel(target.rating?.level ?? null);
    setAssessedAt(today);
    setNotes(target.rating?.notes ?? '');
    setError(null);
  }, [target, today]);

  if (!target) return null;

  const { rating, skill } = target;
  const dateError = assessedAt > today ? 'The assessment date can’t be in the future.' : null;
  const canSave = level != null && !!assessedAt && !dateError && !saving;

  const run = async (action: () => Promise<string>) => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await action());
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t save the skill level'));
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!canSave || level == null) return;
    void run(async () => {
      await upsertEmployeeSkill(companyId, {
        employeeId: target.employeeId,
        skillId: skill.id,
        level,
        assessedAt,
        notes: notes.trim() || null,
      });
      return `${target.employeeName}: ${skill.name} set to ${SKILL_LEVEL_LABELS[level]}.`;
    });
  };

  const clear = () => {
    if (!rating) return;
    void run(async () => {
      await deleteEmployeeSkill(rating.id);
      return `${target.employeeName}: ${skill.name} rating cleared.`;
    });
  };

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title={skill.name}
      description={`${target.employeeName}${skill.category ? ` · ${skill.category}` : ''}`}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {rating ? (
            <Button variant="ghost" onClick={clear} disabled={saving}>
              <Trash2 className="h-4 w-4" /> Clear rating
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!canSave}>
              {saving ? 'Saving…' : 'Save level'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? (
          <Banner icon={AlertCircle} tone="error">
            {error}
          </Banner>
        ) : null}
        {rating ? (
          <p className="text-xs text-muted">
            Currently {SKILL_LEVEL_LABELS[rating.level]}
            {rating.assessedAt ? `, assessed ${formatDateOnly(rating.assessedAt)}` : ''}.
          </p>
        ) : null}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-primary">Proficiency</legend>
          <div className="space-y-1.5" role="radiogroup">
            {SKILL_PROFICIENCY_LEVELS.map((item) => (
              <label
                key={item}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${
                  level === item ? 'border-accent-500 ring-1 ring-accent-500' : 'border-base hover:border-accent-300'
                }`}
              >
                <input
                  type="radio"
                  name="skill-level"
                  className="sr-only"
                  checked={level === item}
                  onChange={() => setLevel(item)}
                />
                <span className={`w-24 shrink-0 rounded-sm px-2 py-0.5 text-center text-xs font-medium ${SKILL_LEVEL_CELL[item]}`}>
                  {SKILL_LEVEL_LABELS[item]}
                </span>
                <span className="text-xs text-secondary">{LEVEL_HINTS[item]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Label htmlFor="skill-assessed">Assessed on</Label>
          <Input id="skill-assessed" type="date" max={today} value={assessedAt} onChange={(e) => setAssessedAt(e.target.value)} />
          {dateError ? <p className="mt-1 text-xs text-error-600">{dateError}</p> : null}
        </div>
        <div>
          <Label htmlFor="skill-notes">Notes</Label>
          <Textarea
            id="skill-notes"
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Evidence, assessor or next step"
          />
        </div>
      </div>
    </Modal>
  );
}
