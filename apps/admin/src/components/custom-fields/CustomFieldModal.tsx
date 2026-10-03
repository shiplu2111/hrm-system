import { useMemo, useState } from 'react';
import type { CustomFieldDefinitionRecord } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { OrgErrorBanner } from '@/components/org/OrgScreenParts';
import { createCustomField, updateCustomField } from '@/lib/documents-api';
import { customFieldsCopy, type BuilderEntityType } from '@/lib/custom-fields-copy';
import {
  draftFromField,
  draftsToFieldInput,
  hasFieldErrors,
  newFieldDraft,
  validateFieldDrafts,
  type FieldDraft,
} from '@/lib/custom-field-schema';
import { ApiError } from '@/lib/tenant-api-client';
import { FieldDefinitionForm } from './FieldDefinitionForm';
import { FormPreview } from './FieldPreview';

interface CustomFieldModalProps {
  companyId: string;
  entityType: BuilderEntityType;
  /** `null` creates a new field. */
  record: CustomFieldDefinitionRecord | null;
  /** Keys used by the entity's other fields. */
  takenKeys: ReadonlySet<string>;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (record: CustomFieldDefinitionRecord) => void;
}

export function CustomFieldModal({
  companyId,
  entityType,
  record,
  takenKeys,
  nextSortOrder,
  onClose,
  onSaved,
}: CustomFieldModalProps) {
  const copy = customFieldsCopy.customFields;
  const entityLabel = copy.entities[entityType].label;
  const [draft, setDraft] = useState<FieldDraft>(() => (record ? draftFromField(record) : newFieldDraft()));
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = useMemo(() => validateFieldDrafts([draft], takenKeys), [draft, takenKeys]);

  const save = async () => {
    setAttempted(true);
    if (hasFieldErrors(errors)) return;
    setSaving(true);
    setError(null);
    const [input] = draftsToFieldInput([draft]);
    try {
      const saved = record
        ? await updateCustomField(companyId, record.id, {
            label: input.label,
            fieldType: input.fieldType,
            required: input.required,
            options: input.options,
            isActive: draft.isActive,
          })
        : await createCustomField(companyId, {
            entityType,
            label: input.label,
            fieldType: input.fieldType,
            required: input.required,
            options: input.options,
            sortOrder: nextSortOrder,
          });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      onClose={saving ? () => undefined : onClose}
      title={record ? copy.editTitle(record.label) : copy.createTitle(entityLabel)}
      description={copy.modalDescription}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {copy.cancel}
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? copy.saving : record ? copy.save : copy.create}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="space-y-4">
          {error && <OrgErrorBanner message={error} />}
          <FieldDefinitionForm
            idPrefix="custom-field"
            draft={draft}
            errors={attempted ? errors[draft.uid] : undefined}
            disabled={saving}
            showActive={record !== null}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          />
        </div>
        <div className="md:self-start">
          <FormPreview fields={[{ ...draft, isActive: true, key: draft.uid }]} />
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
