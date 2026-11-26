import { useState } from 'react';
import type { CmsPageDto } from '@hrm/shared-types';
import { AlertCircle, Loader2, ShieldAlert, Trash2, X } from 'lucide-react';
import { permanentDeleteCmsPage } from '@/lib/platform-cms-api';

interface PermanentDeletePageModalProps {
  page: CmsPageDto;
  onClose: () => void;
  onDeleted: () => Promise<void> | void;
}

export function PermanentDeletePageModal({
  page,
  onClose,
  onDeleted,
}: PermanentDeletePageModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedSlug = page.slug;
  const expectedTitle = page.titleEn || '';
  const trimmed = confirmText.trim().toLowerCase();
  const isConfirmed =
    Boolean(trimmed) &&
    (trimmed === expectedSlug.toLowerCase() ||
      (expectedTitle.trim() && trimmed === expectedTitle.trim().toLowerCase()));

  const handleConfirm = async () => {
    if (!isConfirmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await permanentDeleteCmsPage(page.id, {
        confirmText: confirmText.trim(),
        reason: reason.trim() || undefined,
      });
      await onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permanent deletion failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cms-perm-delete-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-rose-500/40 bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[rgb(var(--border-base))] bg-rose-600/15 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="h-9 w-9 rounded-lg bg-rose-700 text-white flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <div>
              <h2 id="cms-perm-delete-title" className="text-sm font-bold text-rose-900 dark:text-rose-100">
                Delete Permanently · /{page.slug}
              </h2>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                Content Publisher action · Cannot be undone · Fully audit logged
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close permanent delete confirmation"
            className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="px-3.5 py-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200 space-y-1.5">
            <p className="font-semibold">
              This will permanently erase &ldquo;{page.titleEn || `/${page.slug}`}&rdquo;:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              <li>Removes the custom page record and frees slug <code>/{page.slug}</code></li>
              <li>Permanently destroys all immutable EN and BN version history snapshots</li>
              <li>Records an immutable <code>cms.page_permanently_deleted</code> audit entry</li>
            </ul>
          </div>

          <div>
            <label htmlFor="cms-perm-confirm-input" className="block font-semibold mb-1.5">
              Type <code className="px-1.5 py-0.5 rounded bg-[rgb(var(--bg-muted))]">{expectedSlug}</code>
              {expectedTitle ? (
                <>
                  {' '}or <code className="px-1.5 py-0.5 rounded bg-[rgb(var(--bg-muted))]">{expectedTitle}</code>
                </>
              ) : null}{' '}
              to confirm permanent deletion:
            </label>
            <input
              id="cms-perm-confirm-input"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expectedSlug}
              className="w-full h-9 px-3 rounded-lg border border-rose-500/40 bg-[rgb(var(--bg-surface))] text-xs font-mono"
            />
          </div>

          <div>
            <label htmlFor="cms-perm-reason-input" className="block font-medium mb-1">
              Audit Reason (optional)
            </label>
            <input
              id="cms-perm-reason-input"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Duplicate campaign slug cleanup"
              className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isConfirmed || submitting}
            onClick={() => void handleConfirm()}
            className="h-9 px-4 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}
