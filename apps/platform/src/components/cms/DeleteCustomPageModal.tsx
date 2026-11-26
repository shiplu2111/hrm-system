import { useEffect, useState } from 'react';
import type { CmsPageDeletionImpactDto, CmsPageDto } from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Link2,
  Loader2,
  Menu as MenuIcon,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { deleteCmsPage, getCmsPageDeletionImpact } from '@/lib/platform-cms-api';

const WEBSITE_BASE_URL =
  import.meta.env.VITE_WEBSITE_URL || 'http://localhost:3000';

interface DeleteCustomPageModalProps {
  page: CmsPageDto;
  onClose: () => void;
  onDeleted: (trashedPage: CmsPageDto) => Promise<void> | void;
}

export function DeleteCustomPageModal({
  page,
  onClose,
  onDeleted,
}: DeleteCustomPageModalProps) {
  const [impact, setImpact] = useState<CmsPageDeletionImpactDto | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [removeMenuReferences, setRemoveMenuReferences] = useState(false);
  const [publishedMode, setPublishedMode] = useState<'unpublish' | 'confirm_title'>('unpublish');
  const [confirmPublishedTitle, setConfirmPublishedTitle] = useState('');
  const [redirectChoice, setRedirectChoice] = useState<string>('');
  const [customRedirectPath, setCustomRedirectPath] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingImpact(true);
    setError(null);
    void getCmsPageDeletionImpact(page.id)
      .then((res) => {
        if (!cancelled) setImpact(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to inspect page deletion impact.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingImpact(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page.id]);

  const effectiveRedirectPath =
    redirectChoice === '__custom__' ? customRedirectPath.trim() : redirectChoice.trim();

  const hasBlockingMenuRefs = Boolean(
    impact && impact.menuReferences.length > 0 && !removeMenuReferences,
  );

  const expectedTitle = impact?.title || page.titleEn || `/${page.slug}`;
  const isPublishedConfirmationSatisfied =
    impact?.status !== 'published' ||
    publishedMode === 'unpublish' ||
    confirmPublishedTitle.trim().toLowerCase() === expectedTitle.trim().toLowerCase();

  const canSubmit =
    !loadingImpact &&
    Boolean(impact) &&
    !hasBlockingMenuRefs &&
    isPublishedConfirmationSatisfied &&
    !submitting;

  const handleConfirmTrash = async () => {
    if (!canSubmit || !impact) return;
    setSubmitting(true);
    setError(null);
    try {
      const trashed = await deleteCmsPage(page.id, {
        removeMenuReferences,
        unpublishFirst: impact.status === 'published' && publishedMode === 'unpublish',
        confirmPublishedTitle:
          impact.status === 'published' && publishedMode === 'confirm_title'
            ? confirmPublishedTitle.trim()
            : undefined,
        redirectToPath: effectiveRedirectPath || undefined,
        reason: reason.trim() || undefined,
      });
      await onDeleted(trashed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move page to Trash.');
    } finally {
      setSubmitting(false);
    }
  };

  const liveUrl = `${WEBSITE_BASE_URL.replace(/\/+$/, '')}${
    impact?.liveUrlPath || `/${page.slug}`
  }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cms-delete-custom-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[rgb(var(--border-base))] bg-rose-500/10 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="h-9 w-9 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Trash2 className="h-4 w-4" />
            </span>
            <div>
              <h2 id="cms-delete-custom-title" className="text-sm font-bold">
                Move Custom Page to Trash · /{page.slug}
              </h2>
              <p className="text-xs text-[rgb(var(--text-secondary))] mt-0.5">
                {page.titleEn || `/${page.slug}`} · Kept recoverable in Trash for{' '}
                {impact?.trashRetentionDays ?? 30} days before automatic permanent purge.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close delete confirmation"
            className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {loadingImpact ? (
            <div className="py-12 flex flex-col items-center justify-center text-[rgb(var(--text-muted))] gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              <span>Checking live URLs, navigation menus, and page links...</span>
            </div>
          ) : (
            <>
              {error && (
                <div className="px-3.5 py-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {impact && (
                <>
                  {/* 1. Live URL Impact */}
                  <div
                    className={`p-3.5 rounded-lg border ${
                      impact.willStopWorking
                        ? 'border-amber-500/35 bg-amber-500/10'
                        : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5 text-amber-600" />
                        Live URL that will stop working
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))] uppercase text-[10px]">
                        {impact.status}
                      </span>
                    </div>
                    <div className="mt-1.5 font-mono text-[11px] break-all text-[rgb(var(--text-primary))]">
                      {liveUrl}
                    </div>
                    <p className="mt-1 text-[11px] text-[rgb(var(--text-secondary))]">
                      {impact.willStopWorking
                        ? 'This page is currently live or scheduled. Moving it to Trash immediately takes this URL offline unless you configure a redirect below.'
                        : 'Moving this draft/unpublished page to Trash prevents it from being published until restored.'}
                    </p>
                  </div>

                  {/* 2. Menu References (Blocking unless removed) */}
                  {impact.menuReferences.length > 0 ? (
                    <div className="p-3.5 rounded-lg border border-rose-500/40 bg-rose-500/10 space-y-2.5">
                      <div className="flex items-center gap-1.5 font-semibold text-rose-800 dark:text-rose-200">
                        <MenuIcon className="h-4 w-4 shrink-0" />
                        Navigation Menus Linking to This Page ({impact.menuReferences.length})
                      </div>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300">
                        Deletion is blocked while navigation menus link to this page. Either remove or update these links in Navigation first, or confirm automatic removal below.
                      </p>
                      <ul className="space-y-1.5">
                        {impact.menuReferences.map((ref) => (
                          <li
                            key={ref.menuItemId}
                            className="px-2.5 py-1.5 rounded border border-rose-500/25 bg-[rgb(var(--bg-surface))] flex flex-wrap items-center justify-between gap-2"
                          >
                            <span>
                              <strong>{ref.menuName}</strong> ({ref.menuLocation}) · Item:{' '}
                              <span className="font-medium">&ldquo;{ref.labelEn}&rdquo;</span>
                            </span>
                            <code className="text-[10px] text-[rgb(var(--text-muted))]">
                              {ref.href}
                            </code>
                          </li>
                        ))}
                      </ul>
                      <label className="flex items-center gap-2 pt-1 font-semibold text-rose-900 dark:text-rose-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={removeMenuReferences}
                          onChange={(e) => setRemoveMenuReferences(e.target.checked)}
                          className="h-4 w-4 rounded border-rose-400"
                        />
                        Remove these {impact.menuReferences.length} menu link(s) when moving page to Trash
                      </label>
                    </div>
                  ) : (
                    <div className="px-3.5 py-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/30 text-[rgb(var(--text-secondary))] flex items-center gap-2">
                      <MenuIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>No Header or Footer navigation menus currently link to this page.</span>
                    </div>
                  )}

                  {/* 3. Other Pages Linking to It (Warning) */}
                  {impact.referencingPages.length > 0 && (
                    <div className="p-3.5 rounded-lg border border-amber-500/40 bg-amber-500/10 space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                        Other Pages Linking to /{impact.slug} ({impact.referencingPages.length})
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300">
                        These links inside other CMS pages will become broken unless you update them or add a redirect target below:
                      </p>
                      <ul className="space-y-1">
                        {impact.referencingPages.map((p, idx) => (
                          <li
                            key={`${p.pageId}-${p.locale}-${idx}`}
                            className="px-2.5 py-1.5 rounded border border-amber-500/25 bg-[rgb(var(--bg-surface))] flex items-center justify-between gap-2"
                          >
                            <span>
                              <strong>{p.title}</strong>{' '}
                              <span className="font-mono text-[10px]">/{p.slug}</span> (
                              {p.locale.toUpperCase()} · {p.status})
                            </span>
                            <code className="text-[10px] text-[rgb(var(--text-muted))]">
                              {p.href}
                            </code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 4. Optional Redirect Target */}
                  <div className="p-3.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/30 space-y-2">
                    <label
                      htmlFor="cms-delete-redirect-select"
                      className="font-semibold flex items-center gap-1.5"
                    >
                      <ArrowRight className="h-3.5 w-3.5 text-primary-600" />
                      Optional Redirect Target (308 Permanent Redirect)
                    </label>
                    <p className="text-[11px] text-[rgb(var(--text-secondary))]">
                      Automatically send visitors of <code>/{impact.slug}</code> to another page instead of showing a 404.
                    </p>
                    <select
                      id="cms-delete-redirect-select"
                      value={redirectChoice}
                      onChange={(e) => setRedirectChoice(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                    >
                      <option value="">No redirect (show 404 Not Found)</option>
                      {impact.redirectTargets.map((opt) => (
                        <option key={`${opt.slug}-${opt.path}`} value={opt.path}>
                          {opt.title} ({opt.path})
                        </option>
                      ))}
                      <option value="__custom__">Custom internal path or external URL...</option>
                    </select>
                    {redirectChoice === '__custom__' && (
                      <div className="flex items-center gap-2 pt-1">
                        <Link2 className="h-3.5 w-3.5 text-[rgb(var(--text-muted))] shrink-0" />
                        <input
                          type="text"
                          value={customRedirectPath}
                          onChange={(e) => setCustomRedirectPath(e.target.value)}
                          placeholder="/pricing or https://example.com"
                          className="w-full h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-mono"
                        />
                      </div>
                    )}
                  </div>

                  {/* 5. Published Page Protection */}
                  {impact.status === 'published' && (
                    <div className="p-3.5 rounded-lg border border-rose-500/35 bg-rose-500/10 space-y-2.5">
                      <div className="flex items-center gap-1.5 font-semibold text-rose-800 dark:text-rose-200">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        Published Page Safeguard
                      </div>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300">
                        A live published page must either be unpublished first or explicitly confirmed with its exact page title.
                      </p>
                      <div className="space-y-2">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="published-delete-mode"
                            checked={publishedMode === 'unpublish'}
                            onChange={() => setPublishedMode('unpublish')}
                            className="mt-0.5"
                          />
                          <span>
                            <strong>Unpublish &amp; move to Trash</strong> (safely takes page offline and records unpublish in Trash audit entry)
                          </span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="published-delete-mode"
                            checked={publishedMode === 'confirm_title'}
                            onChange={() => setPublishedMode('confirm_title')}
                            className="mt-0.5"
                          />
                          <span>
                            <strong>Confirm immediately by typing exact page title</strong>:{' '}
                            <code className="px-1 py-0.5 rounded bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))]">
                              {expectedTitle}
                            </code>
                          </span>
                        </label>
                      </div>
                      {publishedMode === 'confirm_title' && (
                        <input
                          type="text"
                          value={confirmPublishedTitle}
                          onChange={(e) => setConfirmPublishedTitle(e.target.value)}
                          placeholder={`Type "${expectedTitle}" to confirm`}
                          aria-label="Confirm published page title"
                          className="w-full h-9 px-3 rounded-lg border border-rose-500/40 bg-[rgb(var(--bg-surface))] text-xs"
                        />
                      )}
                    </div>
                  )}

                  <div>
                    <label htmlFor="cms-delete-reason" className="block font-medium mb-1">
                      Deletion Reason / Audit Note (optional)
                    </label>
                    <input
                      id="cms-delete-reason"
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g., Seasonal campaign ended"
                      className="w-full h-8 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex items-center justify-between gap-2">
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
            disabled={!canSubmit}
            onClick={() => void handleConfirmTrash()}
            className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Move to Trash
          </button>
        </div>
      </div>
    </div>
  );
}
