import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, ShieldAlert } from 'lucide-react';
import type {
  DocumentTypeFieldSchema,
  DocumentTypeRecord,
  EmployeeDocumentRecord,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import {
  createMyDocument,
  updateMyDocument,
  uploadMyDocumentFile,
} from '@/lib/my-api';
import { ApiError } from '@/lib/tenant-api-client';

interface MyDocumentUploadModalProps {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  documentTypes: DocumentTypeRecord[];
  presetDocumentTypeId?: string | null;
  editingDocument?: EmployeeDocumentRecord | null;
  onSaved: (doc: EmployeeDocumentRecord, isEdit: boolean) => void;
}

export function MyDocumentUploadModal(props: MyDocumentUploadModalProps) {
  if (!props.open) return null;
  return <UploadModalBody {...props} />;
}

function toStringFieldMap(fields: Record<string, unknown> | undefined): Record<string, unknown> {
  return fields ? { ...fields } : {};
}

function UploadModalBody({
  onClose,
  employeeId,
  documentTypes,
  presetDocumentTypeId,
  editingDocument,
  onSaved,
}: MyDocumentUploadModalProps) {
  const { t } = useAppTranslation();
  const isEdit = Boolean(editingDocument);

  const [documentTypeId, setDocumentTypeId] = useState(
    editingDocument?.documentTypeId ?? presetDocumentTypeId ?? documentTypes[0]?.id ?? '',
  );
  const [expiryDate, setExpiryDate] = useState(editingDocument?.expiryDate ?? '');
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>(() =>
    toStringFieldMap(editingDocument?.fields),
  );
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingDocument) {
      setDocumentTypeId(editingDocument.documentTypeId);
      setExpiryDate(editingDocument.expiryDate ?? '');
      setFieldValues(toStringFieldMap(editingDocument.fields));
    } else if (presetDocumentTypeId) {
      setDocumentTypeId(presetDocumentTypeId);
    }
  }, [editingDocument, presetDocumentTypeId]);

  const selectedType = documentTypes.find((dt) => dt.id === documentTypeId);
  const activeFields = (selectedType?.fields ?? []).filter((f) => f.isActive !== false);
  const requiresFile =
    !isEdit && Boolean(selectedType?.requiresVerification) && !editingDocument?.fileKey;
  const requiresExpiry = Boolean(selectedType?.tracksExpiry);

  const missingRequired = activeFields.some((f) => {
    if (!f.required || !f.fieldKey) return false;
    const val = fieldValues[f.fieldKey];
    if (f.fieldType === 'checkbox') return val !== true;
    return val === undefined || val === null || String(val).trim() === '';
  });

  const canSave =
    !saving &&
    Boolean(documentTypeId) &&
    (!requiresExpiry || Boolean(expiryDate)) &&
    (!requiresFile || Boolean(file)) &&
    !missingRequired;

  function setField(key: string, value: unknown) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      let saved: EmployeeDocumentRecord;
      if (editingDocument) {
        saved = await updateMyDocument(employeeId, editingDocument.id, {
          fields: fieldValues,
          expiryDate: expiryDate || null,
        });
        if (file) {
          saved = await uploadMyDocumentFile(employeeId, saved.id, file);
        }
      } else {
        saved = await createMyDocument(employeeId, {
          documentTypeId,
          fields: fieldValues,
          expiryDate: expiryDate || null,
        });
        if (file) {
          saved = await uploadMyDocumentFile(employeeId, saved.id, file);
        }
      }
      onSaved(saved, isEdit);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.unknownError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={
        isEdit && selectedType
          ? t('documents.form.updateTitle', { name: selectedType.name })
          : t('documents.form.uploadTitle')
      }
      footer={
        <>
          <Button variant="secondary" className="min-h-[44px]" disabled={saving} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            className="min-h-[44px]"
            disabled={!canSave}
            onClick={() => void handleSubmit()}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving
              ? t('documents.form.saving')
              : isEdit
                ? t('documents.form.saveUpdate')
                : t('documents.form.saveUpload')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <Label htmlFor="my-doc-type">{t('documents.form.documentType')}</Label>
          <Select
            id="my-doc-type"
            value={documentTypeId}
            disabled={isEdit || Boolean(presetDocumentTypeId)}
            onChange={(e) => {
              setDocumentTypeId(e.target.value);
              setFieldValues({});
              setExpiryDate('');
            }}
          >
            <option value="">{t('documents.form.selectType')}</option>
            {documentTypes.map((dt) => (
              <option key={dt.id} value={dt.id}>
                {dt.name}
              </option>
            ))}
          </Select>
          {selectedType?.description && (
            <p className="mt-1 text-xs text-muted">{selectedType.description}</p>
          )}
          {selectedType?.requiresVerification && (
            <p className="mt-1 text-xs text-secondary">
              {isEdit ? t('documents.form.replaceHint') : t('documents.form.verificationHint')}
            </p>
          )}
        </div>

        {selectedType?.tracksExpiry && (
          <div>
            <Label htmlFor="my-doc-expiry">{t('documents.form.expiryDate')} *</Label>
            <Input
              id="my-doc-expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
        )}

        {activeFields.map((field) => (
          <DynamicDocumentField
            key={field.id ?? field.fieldKey ?? field.label}
            field={field}
            value={field.fieldKey ? fieldValues[field.fieldKey] : undefined}
            selectOptionLabel={t('documents.form.selectOption')}
            onChange={(val) => field.fieldKey && setField(field.fieldKey, val)}
          />
        ))}

        <div>
          <Label htmlFor="my-doc-file">
            {t('documents.form.attachment')}
            {requiresFile ? ' *' : ''}
          </Label>
          <Input
            id="my-doc-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {isEdit && editingDocument?.verifiedAt && (
          <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:border-warning-800 dark:bg-warning-900/30 dark:text-warning-300">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('documents.form.replaceHint')}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

function DynamicDocumentField({
  field,
  value,
  selectOptionLabel,
  onChange,
}: {
  field: DocumentTypeFieldSchema;
  value: unknown;
  selectOptionLabel: string;
  onChange: (value: unknown) => void;
}) {
  const key = field.fieldKey ?? field.label;
  const label = `${field.label}${field.required ? ' *' : ''}`;

  if (field.fieldType === 'dropdown') {
    return (
      <div>
        <Label htmlFor={`doc-field-${key}`}>{label}</Label>
        <Select
          id={`doc-field-${key}`}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{selectOptionLabel}</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      </div>
    );
  }

  if (field.fieldType === 'radio') {
    return (
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium text-secondary">{label}</legend>
        <div className="flex flex-wrap gap-3">
          {field.options.map((opt) => (
            <label key={opt} className="inline-flex items-center gap-1.5 text-sm text-primary">
              <input
                type="radio"
                name={`doc-radio-${key}`}
                value={opt}
                checked={String(value ?? '') === opt}
                onChange={() => onChange(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.fieldType === 'checkbox') {
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm text-primary">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
    );
  }

  return (
    <div>
      <Label htmlFor={`doc-field-${key}`}>{label}</Label>
      <Input
        id={`doc-field-${key}`}
        type={
          field.fieldType === 'date'
            ? 'date'
            : field.fieldType === 'number'
              ? 'number'
              : 'text'
        }
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

