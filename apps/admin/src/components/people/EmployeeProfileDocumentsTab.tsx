import { useCallback, useEffect, useState } from 'react';
import { Upload, FileText, Trash2, Check, AlertCircle } from 'lucide-react';
import type { DocumentTypeRecord, EmployeeDocumentRecord } from '@hrm/shared-types';
import { PermissionGate, usePermission } from '@hrm/portal-ui';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  DataTable,
  DataTableBody,
  DataTableHead,
} from '@/components/ui/DataTable';
import { EmployeeDocumentUploadModal } from '@/components/people/EmployeeDocumentUploadModal';
import { listDocumentTypes } from '@/lib/documents-api';
import {
  deleteEmployeeDocument,
  listEmployeeDocuments,
  verifyEmployeeDocument,
} from '@/lib/employee-documents-api';
import {
  documentExpiryBadge,
  employeeDocumentStatusBadge,
} from '@/lib/document-status';
import { ApiError } from '@/lib/tenant-api-client';

interface EmployeeProfileDocumentsTabProps {
  employeeId: string;
  companyId: string;
}

export function EmployeeProfileDocumentsTab({
  employeeId,
  companyId,
}: EmployeeProfileDocumentsTabProps) {
  const [documents, setDocuments] = useState<EmployeeDocumentRecord[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeDocumentRecord | null>(null);

  const canCreate = usePermission('employee', 'create');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docs, types] = await Promise.all([
        listEmployeeDocuments(employeeId),
        listDocumentTypes(companyId),
      ]);
      setDocuments(docs);
      setDocTypes(types.filter((t) => t.isActive && t.scope === 'employee'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [employeeId, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleVerify = async (documentId: string) => {
    setError(null);
    try {
      await verifyEmployeeDocument(employeeId, documentId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardBody className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-secondary">
          {documents.length} document{documents.length === 1 ? '' : 's'} on file
        </p>
        <PermissionGate module="employee" action="create">
          <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
            <Upload className="h-4 w-4" /> Upload document
          </Button>
        </PermissionGate>
      </div>

      {error ? (
        <div className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : null}

      <Card>
        <CardBody className="p-0">
          {documents.length === 0 ? (
            <EmptyState
              compact
              icon={FileText}
              title="No documents yet"
              description="Upload employee documents such as ID, contracts, or certifications."
              action={
                canCreate
                  ? {
                      label: 'Upload document',
                      onClick: () => setModalOpen(true),
                      icon: Upload,
                    }
                  : undefined
              }
            />
          ) : (
            <div className="max-h-[480px] overflow-y-auto scrollbar-thin">
              <DataTable>
                <DataTableHead>
                  <tr>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">
                      Document
                    </th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase hidden sm:table-cell">
                      Expiry
                    </th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">
                      Status
                    </th>
                    <th className="w-28 px-5 py-2.5" />
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {documents.map((doc) => {
                    const status = employeeDocumentStatusBadge(doc.status);
                    const expiry = doc.tracksExpiry
                      ? documentExpiryBadge(doc.expiryDate)
                      : null;
                    return (
                      <tr key={doc.id} className="hover:bg-[rgb(var(--bg-hover))]">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center shrink-0">
                              <FileText className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-primary">
                                {doc.documentTypeName}
                              </div>
                              <div className="text-xs text-muted">
                                {doc.fileKey ? 'File attached' : 'No file'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 hidden sm:table-cell">
                          {expiry ? (
                            <Badge tone={expiry.tone}>{expiry.label}</Badge>
                          ) : doc.expiryDate ? (
                            <span className="text-sm text-secondary">{doc.expiryDate}</span>
                          ) : (
                            <span className="text-sm text-muted">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={status.tone} dot>
                            {status.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {doc.requiresVerification && !doc.verifiedAt ? (
                              <PermissionGate module="employee" action="approve">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => void handleVerify(doc.id)}
                                >
                                  <Check className="h-3.5 w-3.5" /> Verify
                                </Button>
                              </PermissionGate>
                            ) : null}
                            <PermissionGate module="employee" action="delete">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(doc)}
                                aria-label="Delete document"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete document"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.documentTypeName}? This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteEmployeeDocument(employeeId, deleteTarget.id);
          await load();
        }}
        onClose={() => setDeleteTarget(null)}
      />

      <EmployeeDocumentUploadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        employeeId={employeeId}
        documentTypes={docTypes}
        onUploaded={() => load()}
      />
    </div>
  );
}
