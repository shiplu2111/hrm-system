import { useRef, useState } from 'react';
import { Download, ExternalLink, Loader2, Paperclip, Trash2, Upload } from 'lucide-react';
import type { EmployeeCertificationRecord } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { errorMessage } from '@/components/performance/performance-ui';
import { saveBlob } from '@/lib/download';
import {
  CERTIFICATE_FILE_ACCEPT,
  CERTIFICATE_FILE_MAX_BYTES,
  fetchCertificationFile,
  removeCertificationFile,
  uploadCertificationFile,
} from '@/lib/training-api';
import { formatDateOnly } from '@/lib/currency-display';
import { formatFileSize } from './training-ui';

export function CertificateFileRow({
  row,
  canEdit,
  onChanged,
}: {
  row: EmployeeCertificationRecord;
  canEdit: boolean;
  onChanged: (record: EmployeeCertificationRecord, message: string) => void;
}) {
  const [busy, setBusy] = useState<'upload' | 'open' | 'download' | 'remove' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { file } = row;

  const upload = async (picked: File) => {
    if (picked.size > CERTIFICATE_FILE_MAX_BYTES) {
      setError('The file must be 10 MB or smaller.');
      return;
    }
    setBusy('upload');
    setError(null);
    try {
      const saved = await uploadCertificationFile(row.id, picked);
      onChanged(saved, file ? `Certificate file replaced for ${row.name}.` : `Certificate file attached to ${row.name}.`);
    } catch (err) {
      setError(errorMessage(err, 'Upload failed'));
    } finally {
      setBusy(null);
    }
  };

  const open = async () => {
    // Opened before the fetch so the browser treats it as a user action, not a pop-up.
    const viewer = window.open('', '_blank');
    setBusy('open');
    setError(null);
    try {
      const { blob } = await fetchCertificationFile(row);
      const typed = blob.type ? blob : new Blob([blob], { type: file?.contentType });
      const url = URL.createObjectURL(typed);
      if (viewer) viewer.location.href = url;
      else window.open(url, '_blank');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      viewer?.close();
      setError(errorMessage(err, 'Couldn’t open the file'));
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy('download');
    setError(null);
    try {
      const { blob, filename } = await fetchCertificationFile(row);
      saveBlob(blob, file?.name ?? filename);
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t download the file'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    setError(null);
    try {
      onChanged(await removeCertificationFile(row.id), `Certificate file removed from ${row.name}.`);
      setConfirmRemove(false);
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t remove the file'));
    } finally {
      setBusy(null);
    }
  };

  if (!file && !canEdit) return null;

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept={CERTIFICATE_FILE_ACCEPT}
      className="hidden"
      onChange={(e) => {
        const picked = e.target.files?.[0];
        e.target.value = '';
        if (picked) void upload(picked);
      }}
    />
  );

  return (
    <div className="mt-2 rounded-md bg-[rgb(var(--bg-muted))] px-2.5 py-2">
      {file ? (
        <div className="flex flex-wrap items-center gap-2">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-primary" title={file.name}>
              {file.name}
            </p>
            <p className="text-[11px] text-muted">
              {formatFileSize(file.sizeBytes)} · uploaded {formatDateOnly(file.uploadedAt.slice(0, 10))}
            </p>
          </div>
          {confirmRemove ? (
            <>
              <span className="text-xs text-secondary">Remove the file?</span>
              <Button size="sm" variant="danger" onClick={() => void remove()} disabled={busy != null}>
                {busy === 'remove' ? 'Removing…' : 'Remove'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)} disabled={busy != null}>
                Keep
              </Button>
            </>
          ) : (
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" onClick={() => void open()} disabled={busy != null}>
                {busy === 'open' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}{' '}
                View
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void download()} disabled={busy != null} aria-label="Download file">
                {busy === 'download' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              </Button>
              {canEdit ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => inputRef.current?.click()}
                    disabled={busy != null}
                    aria-label="Replace file"
                    title="Replace file"
                  >
                    {busy === 'upload' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmRemove(true)}
                    disabled={busy != null}
                    aria-label="Remove file"
                    title="Remove file"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy != null}
          className="flex w-full items-center gap-2 text-left text-xs text-secondary hover:text-accent-700"
        >
          {busy === 'upload' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {busy === 'upload' ? 'Uploading…' : 'Attach the certificate (PDF, JPG or PNG, up to 10 MB)'}
        </button>
      )}
      {canEdit ? picker : null}
      {error ? <p className="mt-1 text-xs text-error-600">{error}</p> : null}
    </div>
  );
}
