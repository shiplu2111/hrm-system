import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import type { DocumentScope, DocumentTypeRecord } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';
import { OrgErrorBanner } from '@/components/org/OrgScreenParts';
import { createDocumentType, replaceDocumentTypeFields, updateDocumentType } from '@/lib/documents-api';
import { customFieldsCopy } from '@/lib/custom-fields-copy';
import {
  draftFromField,
  draftsToFieldInput,
  fieldInputsEqual,
  hasFieldErrors,
  validateFieldDrafts,
  type FieldDraft,
} from '@/lib/custom-field-schema';
import { ApiError } from '@/lib/tenant-api-client';
import { ExpiryPreviewRow, FormPreview } from './FieldPreview';
import { FieldSchemaEditor } from './FieldSchemaEditor';

interface DocumentTypeDetails {
  name: string;
  description: string;
  scope: DocumentScope;
  requiresVerification: boolean;
  tracksExpiry: boolean;
  isActive: boolean;
}

const SCOPES: DocumentScope[] = ['employee', 'company'];

function detailsFrom(record: DocumentTypeRecord | null): DocumentTypeDetails {
  return {
    name: record?.name ?? '',
    description: record?.description ?? '',
    scope: record?.scope ?? 'employee',
    requiresVerification: record?.requiresVerification ?? false,
    tracksExpiry: record?.tracksExpiry ?? false,
    isActive: record?.isActive ?? true,
  };
}

function detailsPayload(details: DocumentTypeDetails) {
  return {
    name: details.name.trim(),
    description: details.description.trim() || null,
    scope: details.scope,
    requiresVerification: details.requiresVerification,
    tracksExpiry: details.tracksExpiry,
  };
}

interface DocumentTypeEditorProps {
  companyId: string;
  /** `null` creates a new type. */
  record: DocumentTypeRecord | null;
  onClose: () => void;
  onSaved: (record: DocumentTypeRecord) => void;
}

export function DocumentTypeEditor({ companyId, record, onClose, onSaved }: DocumentTypeEditorProps) {
  const copy = customFieldsCopy.documentTypes;
  const isEdit = record !== null;
  const hasStoredValues = (record?.documentCount ?? 0) > 0;

  const [savedDetails, setSavedDetails] = useState(() => detailsFrom(record));
  const [savedFields, setSavedFields] = useState<FieldDraft[]>(() => (record?.fields ?? []).map(draftFromField));
  const [details, setDetails] = useState(savedDetails);
  const [fields, setFields] = useState<FieldDraft[]>(savedFields);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removedKeys = useMemo(() => {
    const kept = new Set(fields.map((f) => f.fieldKey).filter(Boolean));
    return new Set(savedFields.flatMap((f) => (f.fieldKey && !kept.has(f.fieldKey) ? [f.fieldKey] : [])));
  }, [fields, savedFields]);
  const fieldErrors = useMemo(() => validateFieldDrafts(fields, removedKeys), [fields, removedKeys]);
  const nameError = details.name.trim() ? undefined : customFieldsCopy.validation.nameRequired;
  const visibleFieldErrors = attempted ? fieldErrors : {};

  const patchDetails = (patch: Partial<DocumentTypeDetails>) => setDetails((d) => ({ ...d, ...patch }));

  const save = async () => {
    setAttempted(true);
    if (nameError || hasFieldErrors(fieldErrors)) {
      setError(customFieldsCopy.validation.fixErrors);
      return;
    }
    setSaving(true);
    setError(null);

    if (!isEdit) {
      try {
        const created = await createDocumentType(companyId, {
          ...detailsPayload(details),
          fields: draftsToFieldInput(fields),
        });
        onSaved(created);
        onClose();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : copy.saveError);
      } finally {
        setSaving(false);
      }
      return;
    }

    let latest: DocumentTypeRecord | null = null;
    const detailsChanged = JSON.stringify(details) !== JSON.stringify(savedDetails);
    try {
      if (detailsChanged) {
        latest = await updateDocumentType(companyId, record.id, {
          ...detailsPayload(details),
          isActive: details.isActive,
        });
        setSavedDetails(details);
        onSaved(latest);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.saveError);
      setSaving(false);
      return;
    }

    try {
      if (!fieldInputsEqual(fields, savedFields)) {
        latest = await replaceDocumentTypeFields(companyId, record.id, draftsToFieldInput(fields));
        const nextFields = latest.fields.map(draftFromField);
        setSavedFields(nextFields);
        setFields(nextFields);
        onSaved(latest);
      }
      onClose();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : copy.saveError;
      setError(detailsChanged ? `${copy.partialSaveError} ${message}` : message);
    } finally {
      setSaving(false);
    }
  };

  const toggles: { key: 'requiresVerification' | 'tracksExpiry' | 'isActive'; label: string; hint: string }[] = [
    { key: 'requiresVerification', label: copy.verification, hint: copy.verificationHint },
    { key: 'tracksExpiry', label: copy.expiry, hint: copy.expiryHint },
    ...(isEdit ? [{ key: 'isActive' as const, label: copy.active, hint: copy.activeHint }] : []),
  ];

  return (
    <Modal
      open
      size="xl"
      onClose={saving ? () => undefined : onClose}
      title={isEdit ? copy.editTitle(record.name) : copy.createTitle}
      description={copy.editorDescription}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {copy.cancel}
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? copy.saving : isEdit ? copy.save : copy.create}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          {error && <OrgErrorBanner message={error} />}

          <section className="space-y-4" aria-labelledby="doc-type-details">
            <h3 id="doc-type-details" className="text-xs font-semibold uppercase tracking-wide text-muted">
              {copy.detailsSection}
            </h3>
            <div>
              <Label htmlFor="doc-type-name">{copy.name}</Label>
              <Input
                id="doc-type-name"
                value={details.name}
                maxLength={120}
                disabled={saving}
                onChange={(e) => patchDetails({ name: e.target.value })}
                placeholder={copy.namePlaceholder}
                aria-invalid={attempted && nameError ? true : undefined}
                className={attempted && nameError ? 'border-error-500 focus:ring-error-500/30' : ''}
              />
              <FieldError message={attempted ? nameError : undefined} />
            </div>
            <div>
              <Label htmlFor="doc-type-description">{copy.descriptionLabel}</Label>
              <Textarea
                id="doc-type-description"
                rows={2}
                value={details.description}
                disabled={saving}
                onChange={(e) => patchDetails({ description: e.target.value })}
                placeholder={copy.descriptionPlaceholder}
              />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-secondary">{copy.scope}</div>
              <div role="radiogroup" aria-label={copy.scope} className="grid gap-2 sm:grid-cols-2">
                {SCOPES.map((scope) => {
                  const selected = details.scope === scope;
                  return (
                    <button
                      key={scope}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={saving}
                      onClick={() => patchDetails({ scope })}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        selected
                          ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/40'
                          : 'border-base hover:bg-[rgb(var(--bg-hover))]'
                      }`}
                    >
                      <div className={`text-sm font-medium ${selected ? 'text-accent-700 dark:text-accent-300' : 'text-primary'}`}>
                        {copy.scopes[scope].label}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">{copy.scopes[scope].description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              {toggles.map((toggle) => (
                <div
                  key={toggle.key}
                  className="flex items-center justify-between gap-4 rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2.5"
                >
                  <div>
                    <div className="text-sm text-primary">{toggle.label}</div>
                    <div className="text-xs text-muted">{toggle.hint}</div>
                  </div>
                  <Toggle
                    checked={details[toggle.key]}
                    disabled={saving}
                    label={toggle.label}
                    onChange={(value) => patchDetails({ [toggle.key]: value })}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="doc-type-fields">
            <h3 id="doc-type-fields" className="text-xs font-semibold uppercase tracking-wide text-muted">
              {copy.fieldsSection}
            </h3>
            {hasStoredValues && (
              <p className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:border-warning-800/60 dark:bg-warning-950/40 dark:text-warning-200">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {copy.inUseNotice(record?.documentCount ?? 0)}
              </p>
            )}
            <FieldSchemaEditor
              fields={fields}
              onChange={setFields}
              errors={visibleFieldErrors}
              hasStoredValues={hasStoredValues}
              disabled={saving}
            />
          </section>
        </div>

        <div className="lg:sticky lg:top-0 lg:self-start">
          <FormPreview
            fields={fields.map((f) => ({ ...f, key: f.uid }))}
            extra={details.tracksExpiry ? <ExpiryPreviewRow /> : undefined}
          />
        </div>
      </div>
    </Modal>
  );
}
