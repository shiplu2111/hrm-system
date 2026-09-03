import { useCallback, useEffect, useState } from 'react';
import { Upload, FileText, Loader2, Trash2, Check } from 'lucide-react';
import type { DocumentTypeRecord, EmployeeDocumentRecord } from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { useNav } from '@/context/NavContext';
import { useCompany } from '@/context/CompanyContext';
import { getEmployee } from '@/lib/employees-api';
import { listDocumentTypes } from '@/lib/documents-api';
import {
  createEmployeeDocument,
  deleteEmployeeDocument,
  listEmployeeDocuments,
  uploadEmployeeDocumentFile,
  verifyEmployeeDocument,
} from '@/lib/employee-documents-api';
import { ApiError } from '@/lib/tenant-api-client';

const statusTone: Record<EmployeeDocumentRecord['status'], 'success' | 'warning' | 'error'> = {
  verified: 'success',
  pending: 'warning',
  expiring_soon: 'error',
};

export function EmployeeDocumentsPage() {
  const { selectedEmployeeId, navigate } = useNav();
  const { companyId } = useCompany();
  const [empName, setEmpName] = useState('');
  const [documents, setDocuments] = useState<EmployeeDocumentRecord[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    documentTypeId: '',
    expiryDate: '',
    fieldValues: {} as Record<string, string>,
    file: null as File | null,
  });

  const selectedType = docTypes.find((t) => t.id === form.documentTypeId);

  const load = useCallback(async () => {
    if (!selectedEmployeeId || !companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [emp, docs, types] = await Promise.all([
        getEmployee(selectedEmployeeId),
        listEmployeeDocuments(selectedEmployeeId),
        listDocumentTypes(companyId),
      ]);
      setEmpName(emp.fullName);
      setDocuments(docs);
      setDocTypes(types.filter((t) => t.isActive && t.scope === 'employee'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeId, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async () => {
    if (!selectedEmployeeId || !form.documentTypeId) return;
    setError(null);
    try {
      const created = await createEmployeeDocument(selectedEmployeeId, {
        documentTypeId: form.documentTypeId,
        fields: form.fieldValues,
        expiryDate: form.expiryDate || null,
      });
      if (form.file) {
        await uploadEmployeeDocumentFile(selectedEmployeeId, created.id, form.file);
      }
      setModalOpen(false);
      setForm({ documentTypeId: '', expiryDate: '', fieldValues: {}, file: null });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    }
  };

  if (!selectedEmployeeId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        Select an employee from the directory first.
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('emp-directory')}>Go to Directory</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Employee Documents</h1>
          <p className="text-sm text-secondary mt-0.5">{empName} — uploaded documents</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Upload className="h-4 w-4" /> Upload Document
        </Button>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 rounded-lg px-4 py-2">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <Card key={doc.id}>
            <CardBody>
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-lg bg-accent-50 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-accent-600" />
                </div>
                <Badge tone={statusTone[doc.status]} dot>{doc.status.replace('_', ' ')}</Badge>
              </div>
              <div className="mt-3 text-sm font-medium text-primary">{doc.documentTypeName}</div>
              {doc.expiryDate && (
                <div className="text-xs text-muted mt-1">Expires {doc.expiryDate}</div>
              )}
              {doc.fileKey && (
                <div className="text-xs text-muted mt-1 truncate">File attached</div>
              )}
              <div className="mt-3 flex gap-2">
                {doc.requiresVerification && !doc.verifiedAt && (
                  <Button variant="secondary" size="sm" onClick={() => void verifyEmployeeDocument(selectedEmployeeId, doc.id).then(load)}>
                    <Check className="h-3.5 w-3.5" /> Verify
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => void deleteEmployeeDocument(selectedEmployeeId, doc.id).then(load)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Upload Document"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleUpload()}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Document Type</Label>
            <Select
              value={form.documentTypeId}
              onChange={(e) => setForm({ ...form, documentTypeId: e.target.value, fieldValues: {} })}
            >
              <option value="">Select type…</option>
              {docTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>
          {selectedType?.tracksExpiry && (
            <div>
              <Label>Expiry Date</Label>
              <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </div>
          )}
          {selectedType?.fields.map((field) => (
            <div key={field.id ?? field.fieldKey}>
              <Label>{field.label}{field.required ? ' *' : ''}</Label>
              {field.fieldType === 'dropdown' ? (
                <Select
                  value={form.fieldValues[field.fieldKey ?? ''] ?? ''}
                  onChange={(e) => setForm({
                    ...form,
                    fieldValues: { ...form.fieldValues, [field.fieldKey ?? '']: e.target.value },
                  })}
                >
                  <option value="">Select…</option>
                  {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              ) : field.fieldType === 'date' ? (
                <Input
                  type="date"
                  value={form.fieldValues[field.fieldKey ?? ''] ?? ''}
                  onChange={(e) => setForm({
                    ...form,
                    fieldValues: { ...form.fieldValues, [field.fieldKey ?? '']: e.target.value },
                  })}
                />
              ) : field.fieldType === 'checkbox' ? (
                <Select
                  value={form.fieldValues[field.fieldKey ?? ''] ?? 'false'}
                  onChange={(e) => setForm({
                    ...form,
                    fieldValues: { ...form.fieldValues, [field.fieldKey ?? '']: e.target.value },
                  })}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </Select>
              ) : (
                <Input
                  type={field.fieldType === 'number' ? 'number' : 'text'}
                  value={form.fieldValues[field.fieldKey ?? ''] ?? ''}
                  onChange={(e) => setForm({
                    ...form,
                    fieldValues: { ...form.fieldValues, [field.fieldKey ?? '']: e.target.value },
                  })}
                />
              )}
            </div>
          ))}
          <div>
            <Label>Attachment (PDF, JPG, PNG — max 10MB)</Label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(e) => setForm({
                ...form,
                file: e.target.files?.[0] ?? null,
              })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
