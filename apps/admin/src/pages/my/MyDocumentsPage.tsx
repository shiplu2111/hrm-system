import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Plus,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import type {
  DocumentTypeRecord,
  EmployeeDocumentRecord,
  EmployeeDocumentStatus,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusPill, type StatusPillTone } from '@/components/ui/StatusPill';
import { MyDocumentUploadModal } from '@/components/my/documents/MyDocumentUploadModal';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { useMyEmployee } from '@/components/my/useMyEmployee';
import { saveBlob } from '@/lib/download';
import {
  downloadMyDocument,
  fetchMyDocumentFile,
  listMyDocuments,
  listMyDocumentTypes,
} from '@/lib/my-api';
import { ApiError } from '@/lib/tenant-api-client';

type StatusFilter = 'all' | EmployeeDocumentStatus;

const STATUS_FILTERS: StatusFilter[] = ['all', 'verified', 'pending', 'expiring_soon', 'expired'];

/** Semantic colors aligned with DESIGN_SYSTEM.md §5 */
const DOCUMENT_STATUS_TONE: Record<EmployeeDocumentStatus, StatusPillTone> = {
  verified: 'success',
  pending: 'warning',
  expiring_soon: 'warning',
  expired: 'error',
};

export function MyDocumentsPage() {
  const { t, i18n } = useAppTranslation();
  const { employeeId, companyId, loading: empLoading, error: empError } = useMyEmployee();
  const locale = i18n.language?.startsWith('bn') ? 'bn-BD' : 'en-GB';

  const [documents, setDocuments] = useState<EmployeeDocumentRecord[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [presetTypeId, setPresetTypeId] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<EmployeeDocumentRecord | null>(null);
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocumentRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!employeeId || !companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [docs, types] = await Promise.all([
        listMyDocuments(employeeId),
        listMyDocumentTypes(companyId),
      ]);
      setDocuments(docs);
      setDocTypes(types.filter((dt) => dt.isActive && dt.scope === 'employee'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errors.loadEmployeeData'));
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId, t]);

  useEffect(() => {
    if (!empLoading) {
      void load();
    }
  }, [empLoading, load]);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
    [locale],
  );

  const fieldLabelLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const dt of docTypes) {
      for (const f of dt.fields) {
        if (f.fieldKey) map.set(`${dt.id}:${f.fieldKey}`, f.label);
      }
    }
    return map;
  }, [docTypes]);

  const counts = useMemo(
    () => ({
      total: documents.length,
      verified: documents.filter((d) => d.status === 'verified').length,
      pending: documents.filter((d) => d.status === 'pending').length,
      expiring_soon: documents.filter((d) => d.status === 'expiring_soon').length,
      expired: documents.filter((d) => d.status === 'expired').length,
    }),
    [documents],
  );

  const filteredDocs = useMemo(
    () => (filter === 'all' ? documents : documents.filter((d) => d.status === filter)),
    [documents, filter],
  );

  function openNewUpload(typeId: string | null = null) {
    setNotice(null);
    setError(null);
    setEditingDoc(null);
    setPresetTypeId(typeId);
    setUploadOpen(true);
  }

  function openEditDocument(doc: EmployeeDocumentRecord) {
    setNotice(null);
    setError(null);
    setPresetTypeId(doc.documentTypeId);
    setEditingDoc(doc);
    setUploadOpen(true);
  }

  async function handleDownload(doc: EmployeeDocumentRecord) {
    if (!employeeId) return;
    setDownloadingId(doc.id);
    setError(null);
    try {
      await downloadMyDocument(
        employeeId,
        doc.id,
        `${doc.documentTypeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
      );
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : t('common.unknownError'));
    } finally {
      setDownloadingId(null);
    }
  }

  function expiryMeta(doc: EmployeeDocumentRecord): {
    label: string;
    tone: StatusPillTone;
  } | null {
    if (!doc.expiryDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = doc.expiryDate.slice(0, 10).split('-').map(Number);
    const expiry = new Date(y, m - 1, d);
    const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    const formatted = dateFmt.format(expiry);

    if (daysUntil < 0) {
      return { label: t('documents.expiry.expired', { date: formatted }), tone: 'error' };
    }
    if (daysUntil === 0) {
      return { label: t('documents.expiry.today'), tone: 'error' };
    }
    if (daysUntil <= 7) {
      return { label: t('documents.expiry.daysLeft', { days: daysUntil }), tone: 'error' };
    }
    if (daysUntil <= 30) {
      return { label: t('documents.expiry.daysLeft', { days: daysUntil }), tone: 'warning' };
    }
    return { label: t('documents.expiry.expiresOn', { date: formatted }), tone: 'neutral' };
  }

  return (
    <MyPageLayout
      title={t('documents.title')}
      subtitle={t('documents.subtitle')}
      loading={empLoading}
      error={empError}
    >
      {employeeId && companyId ? (
        <div className="space-y-6">
          {notice && (
            <div className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-900/30 dark:text-success-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="flex-1">{notice}</span>
              <button
                type="button"
                className="opacity-70 hover:opacity-100"
                onClick={() => setNotice(null)}
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardBody className="space-y-2">
                      <Skeleton className="h-3.5 w-20" />
                      <Skeleton className="h-6 w-12" />
                    </CardBody>
                  </Card>
                ))}
              </div>
              <Card>
                <CardBody className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </CardBody>
              </Card>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryMetric
                    label={t('documents.summary.total')}
                    value={counts.total}
                    tone="neutral"
                  />
                  <SummaryMetric
                    label={t('documents.summary.verified')}
                    value={counts.verified}
                    tone="success"
                  />
                  <SummaryMetric
                    label={t('documents.summary.pending')}
                    value={counts.pending}
                    tone="warning"
                  />
                  <SummaryMetric
                    label={
                      counts.expired > 0
                        ? t('documents.summary.expired')
                        : t('documents.summary.expiringSoon')
                    }
                    value={counts.expired > 0 ? counts.expired : counts.expiring_soon}
                    tone={counts.expired > 0 ? 'error' : 'warning'}
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  className="min-h-[44px] shrink-0"
                  disabled={docTypes.length === 0}
                  onClick={() => openNewUpload(null)}
                >
                  <Plus className="h-4 w-4" />
                  {t('documents.upload')}
                </Button>
              </div>

              {/* Company-configured employee document types */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('documents.configuredTypes')}</CardTitle>
                  <p className="mt-0.5 text-xs text-muted">{t('documents.configuredHint')}</p>
                </CardHeader>
                <CardBody>
                  {docTypes.length === 0 ? (
                    <p className="text-sm text-muted">{t('documents.noTypesConfigured')}</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {docTypes.map((dt) => {
                        const existingCount = documents.filter(
                          (d) => d.documentTypeId === dt.id,
                        ).length;
                        return (
                          <div
                            key={dt.id}
                            className="flex flex-col justify-between gap-3 rounded-lg border border-base p-3 text-sm"
                          >
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-medium text-primary">{dt.name}</span>
                                {existingCount > 0 && (
                                  <Badge tone="success">
                                    {t('documents.uploadedCount', { count: existingCount })}
                                  </Badge>
                                )}
                              </div>
                              {dt.description && (
                                <p className="text-xs text-muted">{dt.description}</p>
                              )}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {dt.requiresVerification && (
                                  <Badge tone="warning">
                                    {t('documents.expiry.requiresVerification')}
                                  </Badge>
                                )}
                                {dt.tracksExpiry && (
                                  <Badge tone="neutral">{t('documents.expiry.tracksExpiry')}</Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full"
                              onClick={() => openNewUpload(dt.id)}
                            >
                              <Upload className="h-3.5 w-3.5" />
                              {t('documents.upload')}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Uploaded documents list */}
              <Card>
                <CardHeader className="space-y-3">
                  <CardTitle>{t('documents.title')}</CardTitle>
                  {documents.length > 0 && (
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="tablist"
                      aria-label={t('documents.title')}
                    >
                      {STATUS_FILTERS.map((status) => {
                        const count =
                          status === 'all'
                            ? documents.length
                            : documents.filter((d) => d.status === status).length;
                        if (status !== 'all' && count === 0) return null;
                        const active = filter === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setFilter(status)}
                            className={`min-h-[36px] rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                              active
                                ? 'border-accent-500 bg-accent-50 text-accent-700 dark:border-accent-700 dark:bg-accent-950/50 dark:text-accent-300'
                                : 'border-base text-secondary hover:bg-[rgb(var(--bg-muted))]'
                            }`}
                          >
                            {t(`documents.status.${status}`)} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardHeader>
                <CardBody>
                  {documents.length === 0 ? (
                    <EmptyState
                      icon={FolderOpen}
                      title={t('documents.emptyTitle')}
                      description={t('documents.emptySubtitle')}
                      action={
                        docTypes.length > 0
                          ? { label: t('documents.upload'), onClick: () => openNewUpload(null) }
                          : undefined
                      }
                      compact
                    />
                  ) : filteredDocs.length === 0 ? (
                    <p className="py-2 text-sm text-muted">{t('documents.emptyFiltered')}</p>
                  ) : (
                    <ul className="divide-y divide-[rgb(var(--border-base))]">
                      {filteredDocs.map((doc) => {
                        const exp = expiryMeta(doc);
                        const entries = Object.entries(doc.fields ?? {}).filter(
                          ([, v]) => v !== undefined && v !== null && String(v) !== '',
                        );
                        return (
                          <li key={doc.id} className="py-4 first:pt-1 last:pb-1">
                            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <FileText
                                    className="h-4 w-4 shrink-0 text-accent-600"
                                    aria-hidden
                                  />
                                  <span className="font-semibold text-primary">
                                    {doc.documentTypeName}
                                  </span>
                                  <StatusPill tone={DOCUMENT_STATUS_TONE[doc.status]}>
                                    {t(`documents.status.${doc.status}`)}
                                  </StatusPill>
                                  {exp && (
                                    <StatusPill tone={exp.tone}>
                                      <CalendarClock className="h-3 w-3" aria-hidden />
                                      {exp.label}
                                    </StatusPill>
                                  )}
                                </div>

                                {entries.length > 0 && (
                                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                                    {entries.map(([key, val]) => (
                                      <span key={key}>
                                        <span className="text-muted">
                                          {fieldLabelLookup.get(`${doc.documentTypeId}:${key}`) ??
                                            key}
                                          :{' '}
                                        </span>
                                        <span className="font-medium text-primary">
                                          {typeof val === 'boolean'
                                            ? val
                                              ? t('common.yes')
                                              : t('common.no')
                                            : String(val)}
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                                  <span>
                                    {t('documents.meta.uploadedOn', {
                                      date: dateFmt.format(new Date(doc.createdAt)),
                                    })}
                                  </span>
                                  {doc.verifiedAt && (
                                    <span>
                                      {t('documents.meta.verifiedOn', {
                                        date: dateFmt.format(new Date(doc.verifiedAt)),
                                      })}
                                    </span>
                                  )}
                                  {!doc.fileKey && (
                                    <span className="text-warning-700 dark:text-warning-300">
                                      {t('documents.meta.noFile')}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                {doc.fileKey && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="min-h-[40px]"
                                      onClick={() => setPreviewDoc(doc)}
                                    >
                                      <Eye className="h-4 w-4" />
                                      {t('documents.actions.viewFile')}
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="min-h-[40px]"
                                      disabled={downloadingId === doc.id}
                                      onClick={() => void handleDownload(doc)}
                                    >
                                      <Download className="h-4 w-4" />
                                      {downloadingId === doc.id
                                        ? t('common.downloading')
                                        : t('documents.actions.download')}
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="min-h-[40px]"
                                  onClick={() => openEditDocument(doc)}
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  {t('documents.replaceOrEdit')}
                                </Button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </>
          )}

          <MyDocumentUploadModal
            open={uploadOpen}
            onClose={() => {
              setUploadOpen(false);
              setEditingDoc(null);
              setPresetTypeId(null);
            }}
            employeeId={employeeId}
            documentTypes={docTypes}
            presetDocumentTypeId={presetTypeId}
            editingDocument={editingDoc}
            onSaved={(_saved, isEdit) => {
              setNotice(isEdit ? t('documents.form.updated') : t('documents.form.uploaded'));
              void load();
            }}
          />

          {previewDoc && (
            <MyDocumentPreviewModal
              employeeId={employeeId}
              document={previewDoc}
              onClose={() => setPreviewDoc(null)}
            />
          )}
        </div>
      ) : null}
    </MyPageLayout>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: StatusPillTone;
}) {
  const toneColor =
    tone === 'success'
      ? 'text-success-700 dark:text-success-300'
      : tone === 'warning'
        ? 'text-warning-700 dark:text-warning-300'
        : tone === 'error'
          ? 'text-error-700 dark:text-error-300'
          : 'text-primary';

  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-xs text-muted">{label}</div>
        <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneColor}`}>{value}</div>
      </CardBody>
    </Card>
  );
}

function MyDocumentPreviewModal({
  employeeId,
  document,
  onClose,
}: {
  employeeId: string;
  document: EmployeeDocumentRecord;
  onClose: () => void;
}) {
  const { t } = useAppTranslation();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; blob: Blob; url: string; filename: string; mime: string }
    | { status: 'error'; message: string }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    fetchMyDocumentFile(employeeId, document.id)
      .then(({ blob, filename }) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setState({ status: 'ready', blob, url, filename, mime: blob.type });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message:
              err instanceof ApiError || err instanceof Error
                ? err.message
                : t('documents.actions.previewError'),
          });
        }
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [employeeId, document.id, t]);

  const isPdfOrImage =
    state.status === 'ready' &&
    (state.mime.includes('pdf') || state.mime.startsWith('image/'));

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={t('documents.actions.previewTitle')}
      description={document.documentTypeName}
      footer={
        <>
          <Button variant="secondary" className="min-h-[44px]" onClick={onClose}>
            {t('common.close')}
          </Button>
          {state.status === 'ready' && (
            <Button
              variant="primary"
              className="min-h-[44px]"
              onClick={() => saveBlob(state.blob, state.filename)}
            >
              <Download className="h-4 w-4" />
              {t('documents.actions.download')}
            </Button>
          )}
        </>
      }
    >
      {state.status === 'loading' ? (
        <div className="flex h-[55vh] items-center justify-center text-sm text-muted">
          {t('documents.actions.previewLoading')}
        </div>
      ) : state.status === 'error' ? (
        <div className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      ) : isPdfOrImage ? (
        state.mime.startsWith('image/') ? (
          <div className="flex max-h-[68vh] justify-center overflow-auto rounded-lg border border-base bg-[rgb(var(--bg-muted))] p-2">
            <img
              src={state.url}
              alt={document.documentTypeName}
              className="max-h-[64vh] object-contain"
            />
          </div>
        ) : (
          <iframe
            title={`${t('documents.actions.previewTitle')} — ${document.documentTypeName}`}
            src={state.url}
            className="h-[68vh] w-full rounded-lg border border-base bg-white"
          />
        )
      ) : (
        <p className="py-8 text-center text-sm text-muted">
          {t('documents.actions.previewUnsupported')}
        </p>
      )}
    </Modal>
  );
}

