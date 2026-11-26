import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CmsActiveEditorDto,
  CmsLocale,
  CmsPageDetailDto,
  CmsPageVersionDto,
} from '@hrm/shared-types';
import {
  CmsApiError,
  fetchCmsPageDetail,
  heartbeatCmsPagePresence,
  releaseCmsPagePresence,
  saveCmsPageVersion,
} from '@/lib/platform-cms-api';
import type { SystemPageLocaleDraft } from '@/components/cms/system-page-editor-utils';

export interface CmsVersionConflictState {
  message: string;
  latestVersion: CmsPageVersionDto;
}

const AUTOSAVE_INTERVAL_MS = 30_000;
const PRESENCE_HEARTBEAT_MS = 15_000;

function draftFingerprint(draft: SystemPageLocaleDraft): string {
  return JSON.stringify({
    title: draft.title,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    ogImageUrl: draft.ogImageUrl,
    noIndex: draft.noIndex,
    translationStatus: draft.translationStatus,
    blocks: draft.blocks,
  });
}

export function getActiveLocaleBaseVersion(
  detail: CmsPageDetailDto | null,
  locale: CmsLocale,
): CmsPageVersionDto | null {
  if (!detail) return null;
  const versionsForLocale = detail.versions.filter((v) => v.locale === locale);
  if (versionsForLocale.length === 0) return null;
  return versionsForLocale.reduce((acc, cur) =>
    cur.versionNumber > acc.versionNumber ? cur : acc,
  );
}

/**
 * Manages immutable version tracking, 30s background draft autosave,
 * unsaved-changes leave warnings, multi-editor presence alerts, and save conflict protection.
 */
export function useCmsEditorCollaboration(params: {
  pageId: string | null | undefined;
  activeLocale: CmsLocale;
  detail: CmsPageDetailDto | null;
  currentDraft: SystemPageLocaleDraft;
  canEdit: boolean;
  onDraftSyncedFromServer: (refreshedDetail: CmsPageDetailDto, locale: CmsLocale) => void;
  onAutosaved?: (version: CmsPageVersionDto) => void;
}) {
  const {
    pageId,
    activeLocale,
    detail,
    currentDraft,
    canEdit,
    onDraftSyncedFromServer,
    onAutosaved,
  } = params;

  const sessionIdRef = useRef<string>(
    `cms-ed-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`,
  );

  // Baseline saved draft per locale (used for dirty detection + 3-way merge)
  const baselineDraftByLocaleRef = useRef<Record<CmsLocale, SystemPageLocaleDraft | null>>({
    en: null,
    bn: null,
  });
  const savedFingerprintByLocaleRef = useRef<Record<CmsLocale, string>>({
    en: '',
    bn: '',
  });

  const [lastAutosavedAt, setLastAutosavedAt] = useState<string | null>(null);
  const [autosaving, setAutosaving] = useState(false);
  const [otherEditors, setOtherEditors] = useState<CmsActiveEditorDto[]>([]);
  const [conflict, setConflict] = useState<CmsVersionConflictState | null>(null);

  const activeBaseVersion = useMemo(
    () => getActiveLocaleBaseVersion(detail, activeLocale),
    [detail, activeLocale],
  );

  // Mark clean whenever a fresh version snapshot is saved/loaded for the active locale
  const markLocaleSaved = useCallback(
    (locale: CmsLocale, snapshot: SystemPageLocaleDraft) => {
      baselineDraftByLocaleRef.current[locale] = JSON.parse(
        JSON.stringify(snapshot),
      ) as SystemPageLocaleDraft;
      savedFingerprintByLocaleRef.current[locale] = draftFingerprint(snapshot);
    },
    [],
  );

  // Initialize baseline fingerprint once per locale if not yet recorded
  useEffect(() => {
    if (!pageId) return;
    if (!savedFingerprintByLocaleRef.current[activeLocale]) {
      markLocaleSaved(activeLocale, currentDraft);
    }
  }, [pageId, activeLocale, currentDraft, markLocaleSaved]);

  const currentFingerprint = useMemo(
    () => draftFingerprint(currentDraft),
    [currentDraft],
  );
  const hasUnsavedChanges = Boolean(
    pageId &&
      savedFingerprintByLocaleRef.current[activeLocale] &&
      currentFingerprint !== savedFingerprintByLocaleRef.current[activeLocale],
  );

  // Warn before browser refresh / tab close when unsaved changes exist
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Presence heartbeat every 15s + detect concurrent edits
  useEffect(() => {
    if (!pageId || !canEdit) {
      setOtherEditors([]);
      return;
    }

    let cancelled = false;
    const mySid = sessionIdRef.current;

    const sendHeartbeat = async () => {
      try {
        const res = await heartbeatCmsPagePresence(pageId, {
          locale: activeLocale,
          sessionId: mySid,
          baseVersionNumber: activeBaseVersion?.versionNumber,
        });
        if (cancelled) return;
        setOtherEditors(res.activeEditors.filter((e) => e.sessionId !== mySid));

        const serverLatest = res.latestVersions?.[activeLocale];
        const expectedNum = activeBaseVersion?.versionNumber ?? 0;
        if (serverLatest && serverLatest.versionNumber > expectedNum && !conflict) {
          // Fetch full latest version snapshot to surface conflict cleanly before user overwrites
          const freshDetail = await fetchCmsPageDetail(pageId).catch(() => null);
          const freshVer = freshDetail?.versions.find((v) => v.id === serverLatest.versionId);
          if (freshVer && !cancelled) {
            setConflict({
              message: `${
                freshVer.authorName || 'Another editor'
              } saved ${activeLocale.toUpperCase()} v${freshVer.versionNumber} while you were editing.`,
              latestVersion: freshVer,
            });
          }
        }
      } catch {
        // Ignore transient network hiccups on heartbeat
      }
    };

    void sendHeartbeat();
    const timer = window.setInterval(() => {
      void sendHeartbeat();
    }, PRESENCE_HEARTBEAT_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      void releaseCmsPagePresence(pageId, mySid).catch(() => undefined);
    };
  }, [pageId, canEdit, activeLocale, activeBaseVersion?.versionNumber, conflict]);

  // 30-second background draft autosave
  const latestDraftRef = useRef(currentDraft);
  latestDraftRef.current = currentDraft;
  const hasUnsavedRef = useRef(hasUnsavedChanges);
  hasUnsavedRef.current = hasUnsavedChanges;
  const baseVersionRef = useRef(activeBaseVersion);
  baseVersionRef.current = activeBaseVersion;
  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;

  useEffect(() => {
    if (!pageId || !canEdit) return;

    const timer = window.setInterval(() => {
      if (!hasUnsavedRef.current || conflictRef.current) return;
      const draft = latestDraftRef.current;
      if (!draft.title.trim()) return;

      const base = baseVersionRef.current;
      setAutosaving(true);
      void saveCmsPageVersion(pageId, {
        locale: activeLocale,
        title: draft.title.trim(),
        seoTitle: draft.seoTitle.trim() || null,
        seoDescription: draft.seoDescription.trim() || null,
        canonicalPath: draft.canonicalPath.trim() || null,
        ogImageUrl: draft.ogImageUrl.trim() || null,
        noIndex: draft.noIndex,
        blocks: draft.blocks,
        isTranslated:
          activeLocale === 'en' ? true : draft.translationStatus === 'translated',
        translationStatus:
          activeLocale === 'en' ? 'translated' : draft.translationStatus,
        changeNote: 'Autosaved draft',
        publishImmediately: false,
        baseVersionId: base?.id,
        expectedVersionNumber: base?.versionNumber ?? 0,
        isAutosave: true,
      })
        .then(async (savedVersion) => {
          setLastAutosavedAt(savedVersion.createdAt);
          markLocaleSaved(activeLocale, draft);
          onAutosaved?.(savedVersion);
          const freshDetail = await fetchCmsPageDetail(pageId);
          onDraftSyncedFromServer(freshDetail, activeLocale);
        })
        .catch((err) => {
          if (err instanceof CmsApiError && err.statusCode === 409) {
            const latestVer = err.details?.currentLatestVersion as
              | CmsPageVersionDto
              | undefined;
            if (latestVer) {
              setConflict({
                message: err.message,
                latestVersion: latestVer,
              });
            }
          }
        })
        .finally(() => {
          setAutosaving(false);
        });
    }, AUTOSAVE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [pageId, canEdit, activeLocale, markLocaleSaved, onDraftSyncedFromServer, onAutosaved]);

  const confirmLeaveIfDirty = useCallback((): boolean => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(
      'You have unsaved draft changes that have not been saved to version history yet. Leave without saving?',
    );
  }, [hasUnsavedChanges]);

  const handleSaveErrorConflict = useCallback((err: unknown): boolean => {
    if (err instanceof CmsApiError && err.statusCode === 409) {
      const latestVer = err.details?.currentLatestVersion as CmsPageVersionDto | undefined;
      if (latestVer) {
        setConflict({
          message: err.message,
          latestVersion: latestVer,
        });
        return true;
      }
    }
    return false;
  }, []);

  return {
    sessionId: sessionIdRef.current,
    hasUnsavedChanges,
    autosaving,
    lastAutosavedAt,
    otherEditors,
    conflict,
    setConflict,
    activeBaseVersion,
    baselineDraft: baselineDraftByLocaleRef.current[activeLocale],
    markLocaleSaved,
    confirmLeaveIfDirty,
    handleSaveErrorConflict,
  };
}
