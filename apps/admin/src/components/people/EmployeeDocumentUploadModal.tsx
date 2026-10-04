import { useEffect, useState } from 'react';
import type { DocumentTypeRecord, EmployeeDocumentRecord } from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import {
  createEmployeeDocument,
  uploadEmployeeDocumentFile,
} from '@/lib/employee-documents-api';
import { ApiError } from '@/lib/tenant-api-client';

interface EmployeeDocumentUploadModalProps {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  documentTypes: DocumentTypeRecord[];
  /** Pre-selects and locks the document type, e.g. when uploading for a checklist task. */
  presetDocumentTypeId?: string | null;
  onUploaded: (document: EmployeeDocumentRecord) => void | Promise<void>;
}

const EMPTY_FORM = {
  documentTypeId: '',
  expiryDate: '',
  fieldValues: {} as Record<string, string>,
  file: null as File | null,
};

export function EmployeeDocumentUploadModal({
  open,
  onClose,
  employeeId,
  documentTypes,
  presetDocumentTypeId,
  onUploaded,
}: EmployeeDocumentUploadModalProps) {
  const canEdit = usePermission('employee', 'edit');
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_FORM, documentTypeId: presetDocumentTypeId ?? '' });
    setError(null);
  }, [open, presetDocumentTypeId]);

  const selectedType = documentTypes.find((t) => t.id === form.documentTypeId);
  const needsFile = Boolean(selectedType?.requiresVerification) && canEdit;

  const setField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, fieldValues: { ...prev.fieldValues, [key]: value } }));

  const handleSave = async () => {
    if (!form.documentTypeId) return;
    setUploading(true);
    setError(null);
    try {
      let saved = await createEmployeeDocument(employeeId, {
        documentTypeId: form.documentTypeId,
        fields: form.fieldValues,
        expiryDate: form.expiryDate || null,
      });
      if (form.file && canEdit) {
        saved = await uploadEmployeeDocumentFile(employeeId, saved.id, form.file);
      }
      await onUploaded(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={selectedType && presetDocumentTypeId ? `Upload ${selectedType.name}` : 'Upload document'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            disabled={uploading || !form.documentTypeId || (needsFile && !form.file)}
          >
            {uploading ? 'Uploading…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
            {error}
          </div>
        ) : null}
        <div>
          <Label>Document type</Label>
          <Select
            value={form.documentTypeId}
            disabled={Boolean(presetDocumentTypeId)}
            onChange={(e) =>
              setForm({ ...form, documentTypeId: e.target.value, fieldValues: {} })
            }
          >
            <option value="">Select type…</option>
            {documentTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          {selectedType?.requiresVerification ? (
            <p className="text-xs text-muted mt-1">
              This document must be verified by HR after upload.
            </p>
          ) : null}
        </div>
        {selectedType?.tracksExpiry ? (
          <div>
            <Label>Expiry date *</Label>
            <Input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
            />
          </div>
        ) : null}
        {selectedType?.fields.map((field) => {
          const key = field.fieldKey ?? '';
          return (
            <div key={field.id ?? field.fieldKey}>
              <Label>
                {field.label}
                {field.required ? ' *' : ''}
              </Label>
              {field.fieldType === 'dropdown' ? (
                <Select
                  value={form.fieldValues[key] ?? ''}
                  onChange={(e) => setField(key, e.target.value)}
                >
                  <option value="">Select…</option>
                  {field.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  type={
                    field.fieldType === 'date'
                      ? 'date'
                      : field.fieldType === 'number'
                        ? 'number'
                        : 'text'
                  }
                  value={form.fieldValues[key] ?? ''}
                  onChange={(e) => setField(key, e.target.value)}
                />
              )}
            </div>
          );
        })}
        {canEdit ? (
          <div>
            <Label>Attachment (PDF, JPG, PNG — max 10MB){needsFile ? ' *' : ''}</Label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
