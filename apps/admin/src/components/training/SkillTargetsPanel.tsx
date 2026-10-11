import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Target } from 'lucide-react';
import {
  SKILL_TARGET_LEVELS,
  type DesignationRecord,
  type DesignationSkillTargetRecord,
  type SkillProficiencyLevel,
  type SkillRecord,
} from '@hrm/shared-types';
import { Label, Select } from '@/components/ui/Form';
import { SidePanel } from '@/components/ui/SidePanel';
import { Banner, errorMessage } from '@/components/performance/performance-ui';
import { deleteSkillTarget, setSkillTarget, SKILL_LEVEL_LABELS } from '@/lib/training-api';
import { SKILL_LEVEL_CELL } from './training-ui';

const UNCATEGORISED = 'Uncategorised';

export function SkillTargetsPanel({
  open,
  companyId,
  designations,
  skills,
  targets,
  headcount,
  canEdit,
  initialDesignationId,
  onClose,
  onChanged,
}: {
  open: boolean;
  companyId: string;
  designations: DesignationRecord[];
  skills: SkillRecord[];
  targets: DesignationSkillTargetRecord[];
  /** Current employees per designation id. */
  headcount: Map<string, number>;
  canEdit: boolean;
  initialDesignationId?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [designationId, setDesignationId] = useState('');
  const [savingSkillId, setSavingSkillId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedDesignations = useMemo(
    () => [...designations].sort((a, b) => a.name.localeCompare(b.name)),
    [designations],
  );
  const targetCountByDesignation = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of targets) map.set(row.designationId, (map.get(row.designationId) ?? 0) + 1);
    return map;
  }, [targets]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDesignationId(
      (current) =>
        initialDesignationId ||
        current ||
        sortedDesignations.find((row) => targetCountByDesignation.has(row.id))?.id ||
        sortedDesignations[0]?.id ||
        '',
    );
    // Only when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDesignationId]);

  const targetBySkill = useMemo(
    () =>
      new Map(targets.filter((row) => row.designationId === designationId).map((row) => [row.skillId, row])),
    [targets, designationId],
  );
  const groups = useMemo(() => {
    const map = new Map<string, SkillRecord[]>();
    for (const skill of [...skills].sort((a, b) => a.name.localeCompare(b.name))) {
      const key = skill.category ?? UNCATEGORISED;
      map.set(key, [...(map.get(key) ?? []), skill]);
    }
    return [...map.entries()].sort(([a], [b]) =>
      a === UNCATEGORISED ? 1 : b === UNCATEGORISED ? -1 : a.localeCompare(b),
    );
  }, [skills]);

  const change = async (skill: SkillRecord, value: '' | SkillProficiencyLevel) => {
    const existing = targetBySkill.get(skill.id);
    if ((existing?.targetLevel ?? '') === value) return;
    setSavingSkillId(skill.id);
    setError(null);
    try {
      if (value) await setSkillTarget(companyId, { designationId, skillId: skill.id, targetLevel: value });
      else if (existing) await deleteSkillTarget(existing.id);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, `Couldn’t save the target for ${skill.name}`));
    } finally {
      setSavingSkillId(null);
    }
  };

  const designation = sortedDesignations.find((row) => row.id === designationId);
  const people = headcount.get(designationId) ?? 0;

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Role targets"
      description="The level each designation should reach in each skill. Gaps are measured against these."
      icon={<Target className="h-5 w-5" />}
    >
      <div className="space-y-5">
        {error ? (
          <Banner icon={AlertCircle} tone="error">
            {error}
          </Banner>
        ) : null}
        {sortedDesignations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-base px-4 py-8 text-center text-sm text-secondary">
            No designations yet. Add designations under Organisation first.
          </p>
        ) : skills.length === 0 ? (
          <p className="rounded-lg border border-dashed border-base px-4 py-8 text-center text-sm text-secondary">
            Add skills to the catalog before setting targets.
          </p>
        ) : (
          <>
            <div>
              <Label htmlFor="target-designation">Designation</Label>
              <Select id="target-designation" value={designationId} onChange={(e) => setDesignationId(e.target.value)}>
                {sortedDesignations.map((row) => {
                  const count = targetCountByDesignation.get(row.id) ?? 0;
                  return (
                    <option key={row.id} value={row.id}>
                      {row.name}
                      {row.department ? ` · ${row.department.name}` : ''}
                      {count > 0 ? ` (${count} ${count === 1 ? 'target' : 'targets'})` : ''}
                    </option>
                  );
                })}
              </Select>
              {designation ? (
                <p className="mt-1 text-xs text-muted">
                  {people === 0
                    ? 'Nobody currently holds this designation.'
                    : `${people} current ${people === 1 ? 'employee holds' : 'employees hold'} this designation.`}
                </p>
              ) : null}
            </div>

            {groups.map(([category, rows]) => (
              <section key={category}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{category}</h3>
                <ul className="divide-y divide-[rgb(var(--border-base))] rounded-lg border border-base">
                  {rows.map((skill) => {
                    const target = targetBySkill.get(skill.id);
                    return (
                      <li key={skill.id} className="flex items-center gap-3 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-primary" title={skill.description ?? undefined}>
                          {skill.name}
                        </span>
                        {savingSkillId === skill.id ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : null}
                        {canEdit ? (
                          <Select
                            className="w-40"
                            value={target?.targetLevel ?? ''}
                            disabled={savingSkillId != null}
                            onChange={(e) => void change(skill, e.target.value as '' | SkillProficiencyLevel)}
                            aria-label={`Target for ${skill.name}`}
                          >
                            <option value="">No target</option>
                            {SKILL_TARGET_LEVELS.map((level) => (
                              <option key={level} value={level}>
                                {SKILL_LEVEL_LABELS[level]}
                              </option>
                            ))}
                          </Select>
                        ) : target ? (
                          <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${SKILL_LEVEL_CELL[target.targetLevel]}`}>
                            {SKILL_LEVEL_LABELS[target.targetLevel]}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">No target</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </SidePanel>
  );
}
