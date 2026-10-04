import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  Maximize2,
  Minimize2,
  Upload,
} from 'lucide-react';
import type { ExpenseClaimReceiptRecord } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { saveBlob } from '@/lib/download';
import { fetchExpenseReceipt, formatReceiptSize, uploadExpenseReceipt } from '@/lib/expenses-api';
import { isPreviewableImage } from '@/lib/expense-display';
import { formatDate } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

type FileState =
  | { status: 'loading' }
  | { status: 'ready'; blob: Blob; url: string }
  | { status: 'error'; message: string };

interface ExpenseReceiptViewerProps {
  claimId: string;
  receipts: ExpenseClaimReceiptRecord[];
  /** Shows "Add receipt" when the claim still accepts receipts. */
  canUpload: boolean;
  receiptRequired: boolean;
  onUploaded: () => void | Promise<void>;
}

export function ExpenseReceiptViewer({
  claimId,
  receipts,
  canUpload,
  receiptRequired,
  onUploaded,
}: ExpenseReceiptViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(receipts[0]?.id ?? null);
  const [file, setFile] = useState<FileState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [actualSize, setActualSize] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = receipts.find((r) => r.id === selectedId) ?? receipts[0] ?? null;
  const receiptId = selected?.id ?? null;
  const receiptName = selected?.originalName ?? '';
  const receiptType = selected?.contentType ?? '';

  useEffect(() => {
    if (!receiptId) return;
    let cancelled = false;
    let url: string | null = null;
    setFile({ status: 'loading' });
    setActualSize(false);
    fetchExpenseReceipt(claimId, { id: receiptId, originalName: receiptName })
      .then(({ blob }) => {
        if (cancelled) return;
        const typed = blob.type ? blob : new Blob([blob], { type: receiptType });
        url = URL.createObjectURL(typed);
        setFile({ status: 'ready', blob: typed, url });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFile({
            status: 'error',
            message: err instanceof ApiError || err instanceof Error ? err.message : 'Could not load the receipt',
          });
        }
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [claimId, receiptId, receiptName, receiptType, attempt]);

  const upload = async (picked: File) => {
    if (picked.size > 10 * 1024 * 1024) {
      setUploadError('Receipts must be 10 MB or smaller.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const receipt = await uploadExpenseReceipt(claimId, picked);
      setSelectedId(receipt.id);
      await onUploaded();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const uploadButton = canUpload ? (
    <>
      <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        Add receipt
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = '';
          if (picked) void upload(picked);
        }}
      />
    </>
  ) : null;

  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-base px-6 py-14 text-center">
        <FileText className="h-8 w-8 text-muted" />
        <div>
          <p className="text-sm font-medium text-primary">No receipt attached</p>
          <p className="mt-1 text-sm text-secondary">
            {receiptRequired
              ? 'This category requires a receipt before the claim can be submitted.'
              : 'Receipts are optional for this category.'}
          </p>
        </div>
        {uploadButton}
        {uploadError ? <p className="text-sm text-error-600">{uploadError}</p> : null}
      </div>
    );
  }

  const isImage = isPreviewableImage(selected.contentType);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[14rem] flex-1">
          <p className="truncate text-sm font-medium text-primary" title={selected.originalName}>
            {selected.originalName}
          </p>
          <p className="text-xs text-muted">
            {formatReceiptSize(selected.sizeBytes)} · uploaded {formatDate(selected.uploadedAt)}
          </p>
        </div>
        {isImage && file.status === 'ready' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActualSize((v) => !v)}
            title={actualSize ? 'Fit to frame' : 'Actual size'}
          >
            {actualSize ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {actualSize ? 'Fit' : 'Actual size'}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          disabled={file.status !== 'ready'}
          onClick={() => file.status === 'ready' && window.open(file.url, '_blank', 'noopener')}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={file.status !== 'ready'}
          onClick={() => file.status === 'ready' && saveBlob(file.blob, selected.originalName)}
        >
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
        {uploadButton}
      </div>
      {uploadError ? <p className="text-sm text-error-600">{uploadError}</p> : null}

      <div className="overflow-hidden rounded-lg border border-base bg-[rgb(var(--bg-muted))]">
        {file.status === 'loading' ? (
          <div className="h-[520px] space-y-3 p-6" aria-busy="true" aria-label="Loading receipt">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : file.status === 'error' ? (
          <div className="flex h-[260px] flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle className="h-6 w-6 text-error-600" />
            <p className="max-w-md text-sm text-secondary">{file.message}</p>
            <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </Button>
          </div>
        ) : isImage ? (
          <div className={`h-[520px] ${actualSize ? 'overflow-auto' : 'flex items-center justify-center p-3'}`}>
            <img
              src={file.url}
              alt={`Receipt ${selected.originalName}`}
              className={actualSize ? 'max-w-none' : 'max-h-full max-w-full object-contain shadow-sm'}
            />
          </div>
        ) : (
          <iframe title={`Receipt ${selected.originalName}`} src={file.url} className="h-[520px] w-full bg-white" />
        )}
      </div>

      {receipts.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {receipts.map((receipt, index) => {
            const active = receipt.id === selected.id;
            const Icon = isPreviewableImage(receipt.contentType) ? ImageIcon : FileText;
            return (
              <button
                key={receipt.id}
                type="button"
                onClick={() => setSelectedId(receipt.id)}
                className={`flex min-w-[160px] max-w-[220px] items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  active
                    ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/30'
                    : 'border-base hover:bg-[rgb(var(--bg-hover))]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-accent-600" />
                <span className="min-w-0">
                  <span className="block truncate text-primary">{receipt.originalName}</span>
                  <span className="text-muted">
                    {index + 1} of {receipts.length} · {formatReceiptSize(receipt.sizeBytes)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
