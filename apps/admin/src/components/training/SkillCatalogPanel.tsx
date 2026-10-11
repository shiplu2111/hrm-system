import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import type { SkillRecord } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Label, Textarea } from '@/components/ui/Form';
import { SidePanel } from '@/components/ui/SidePanel';
import { Banner, errorMessage } from '@/components/performance/performance-ui';
import { createSkill, deleteSkill, updateSkill } from '@/lib/training-api';

const UNCATEGORISED = 'Uncategorised';

function SkillForm({
  skill,
  categories,
  onCancel,
  onSubmit,
}: {
  skill: SkillRecord | null;
  categories: string[];
  onCancel: () => void;
  onSubmit: (input: { name: string; category: string; description: string }) => Promise<void>;
}) {
  const [name, setName] = useState(skill?.name ?? '');
  const [category, setCategory] = useState(skill?.category ?? '');
  const [description, setDescription] = useState(skill?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idPrefix = skill ? `skill-${skill.id}` : 'skill-new';

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), category: category.trim(), description: description.trim() });
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t save the skill'));
      setSaving(false);
    }
  };

  return (
    <form
      className="space-y-3 rounded-lg border border-accent-300 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {error ? (
        <Banner icon={AlertCircle} tone="error">
          {error}
        </Banner>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-name`}>Skill</Label>
          <Input
            id={`${idPrefix}-name`}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Project management"
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-category`}>Category</Label>
          <Input
            id={`${idPrefix}-category`}
            list="skill-category-options"
            value={category}
            maxLength={60}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Management"
          />
          <datalist id="skill-category-options">
            {categories.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          rows={2}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!name.trim() || saving}>
          {saving ? 'Saving…' : skill ? 'Save skill' : 'Add skill'}
        </Button>
      </div>
    </form>
  );
}

export function SkillCatalogPanel({
  open,
  companyId,
  skills,
  canCreate,
  canEdit,
  onClose,
  onChanged,
}: {
  open: boolean;
  companyId: string;
  skills: SkillRecord[];
  canCreate: boolean;
  canEdit: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [deleting, setDeleting] = useState<SkillRecord | null>(null);

  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);

  const categories = useMemo(
    () => [...new Set(skills.map((row) => row.category).filter((v): v is string => !!v))].sort(),
    [skills],
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

  return (
    <>
    <SidePanel
      open={open}
      onClose={onClose}
      title="Skill catalog"
      description="The skills that make up the matrix columns."
      footer={
        canCreate && editing !== 'new' ? (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-3.5 w-3.5" /> Add skill
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {editing === 'new' ? (
          <SkillForm
            skill={null}
            categories={categories}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              const row = await createSkill(companyId, {
                name: input.name,
                category: input.category || undefined,
                description: input.description || undefined,
              });
              setEditing(null);
              onChanged(`${row.name} added to the skill catalog.`);
            }}
          />
        ) : null}

        {skills.length === 0 && editing !== 'new' ? (
          <p className="rounded-lg border border-dashed border-base px-4 py-8 text-center text-sm text-secondary">
            No skills yet. Add the skills you want to track across the team.
          </p>
        ) : null}

        {groups.map(([category, rows]) => (
          <section key={category}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{category}</h3>
            <ul className="space-y-2">
              {rows.map((skill) =>
                editing === skill.id ? (
                  <li key={skill.id}>
                    <SkillForm
                      skill={skill}
                      categories={categories}
                      onCancel={() => setEditing(null)}
                      onSubmit={async (input) => {
                        const row = await updateSkill(skill.id, {
                          name: input.name,
                          category: input.category || null,
                          description: input.description || null,
                        });
                        setEditing(null);
                        onChanged(`${row.name} updated.`);
                      }}
                    />
                  </li>
                ) : (
                  <li key={skill.id} className="flex items-start gap-3 rounded-lg border border-base px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-primary">{skill.name}</p>
                      {skill.description ? <p className="text-xs text-secondary">{skill.description}</p> : null}
                      <p className="mt-0.5 text-xs text-muted">
                        {skill.assignmentCount === 0
                          ? 'Nobody rated yet'
                          : `${skill.assignmentCount} ${skill.assignmentCount === 1 ? 'employee' : 'employees'} rated`}
                      </p>
                    </div>
                    {canEdit ? (
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(skill.id)} aria-label={`Edit ${skill.name}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleting(skill)} aria-label={`Delete ${skill.name}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ),
              )}
            </ul>
          </section>
        ))}
      </div>
    </SidePanel>

      <ConfirmDialog
        open={deleting != null}
        title="Delete skill?"
        description={
          deleting
            ? deleting.assignmentCount > 0
              ? `${deleting.name} and its ${deleting.assignmentCount} employee ${
                  deleting.assignmentCount === 1 ? 'rating' : 'ratings'
                } will be removed from the matrix. This can’t be undone.`
              : `${deleting.name} will be removed from the catalog.`
            : undefined
        }
        confirmLabel="Delete skill"
        onConfirm={async () => {
          if (!deleting) return;
          const { removedRatings } = await deleteSkill(deleting.id);
          onChanged(
            removedRatings > 0
              ? `${deleting.name} deleted with ${removedRatings} ${removedRatings === 1 ? 'rating' : 'ratings'}.`
              : `${deleting.name} deleted.`,
          );
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
