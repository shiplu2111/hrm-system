import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CmsMediaDto,
  CmsMediaUsageDto,
  CmsMediaVariantKey,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermission';
import {
  CmsApiError,
  deleteCmsMedia,
  getCmsMediaUsage,
  listCmsMedia,
  updateCmsMedia,
  uploadCmsMedia,
} from '@/lib/platform-cms-api';

const FOLDERS = [
  'all',
  'general',
  'pages',
  'blog',
  'downloads',
  'changelog',
  'careers',
  'seo',
] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith('image/')) return Promise.resolve({});
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const dims = {
        width: img.naturalWidth || undefined,
        height: img.naturalHeight || undefined,
      };
      URL.revokeObjectURL(objectUrl);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({});
    };
    img.src = objectUrl;
  });
}

export function MediaLibraryPage() {
  const { can, roleName } = usePermissions();
  const canViewCms = can('cms', 'view');
  const canCreateCms = can('cms', 'create');
  const canEditCms = can('cms', 'edit');
  const canDeleteCms = can('cms', 'delete');

  const [items, setItems] = useState<CmsMediaDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [mimeGroup, setMimeGroup] = useState<'all' | 'images' | 'pdfs'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload drawer state
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFolder, setUploadFolder] = useState<string>('pages');
  const [uploadTagsInput, setUploadTagsInput] = useState('');
  const [uploadAltEn, setUploadAltEn] = useState('');
  const [uploadAltBn, setUploadAltBn] = useState('');
  const [uploadCaptionEn, setUploadCaptionEn] = useState('');
  const [uploading, setUploading] = useState(false);

  // Selected asset inspector + usage
  const [selected, setSelected] = useState<CmsMediaDto | null>(null);
  const [activeVariantPreview, setActiveVariantPreview] = useState<'original' | CmsMediaVariantKey>('original');
  const [usage, setUsage] = useState<CmsMediaUsageDto | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Metadata edit form for selected asset
  const [editAltEn, setEditAltEn] = useState('');
  const [editAltBn, setEditAltBn] = useState('');
  const [editCaptionEn, setEditCaptionEn] = useState('');
  const [editCaptionBn, setEditCaptionBn] = useState('');
  const [editFolder, setEditFolder] = useState('general');
  const [editTagsInput, setEditTagsInput] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  // Delete workflow state
  const [deleting, setDeleting] = useState(false);
  const [draftWarningConfirm, setDraftWarningConfirm] = useState(false);

  const loadMedia = useCallback(async () => {
    if (!canViewCms) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await listCmsMedia({
        folder: folderFilter,
        tag: tagFilter,
        mimeGroup,
        search: searchQuery,
        limit: 80,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Media Library assets.');
    } finally {
      setLoading(false);
    }
  }, [canViewCms, folderFilter, tagFilter, mimeGroup, searchQuery]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const allAvailableTags = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      for (const t of item.tags ?? []) set.add(t);
    }
    if (tagFilter !== 'all') set.add(tagFilter);
    return Array.from(set).sort();
  }, [items, tagFilter]);

  const selectAsset = async (asset: CmsMediaDto) => {
    setSelected(asset);
    setActiveVariantPreview('original');
    setEditAltEn(asset.altEn ?? '');
    setEditAltBn(asset.altBn ?? '');
    setEditCaptionEn(asset.captionEn ?? '');
    setEditCaptionBn(asset.captionBn ?? '');
    setEditFolder(asset.folder || 'general');
    setEditTagsInput((asset.tags ?? []).join(', '));
    setDraftWarningConfirm(false);
    setUsage(null);
    setLoadingUsage(true);
    try {
      const u = await getCmsMediaUsage(asset.id);
      setUsage(u);
    } catch {
      setUsage(null);
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setError('Select an image (PNG, JPEG, WebP, GIF, sanitized SVG) or PDF download.');
      return;
    }
    const isPdf =
      uploadFile.type === 'application/pdf' ||
      uploadFile.name.toLowerCase().endsWith('.pdf');
    if (!isPdf && !uploadAltEn.trim() && !uploadAltBn.trim()) {
      setError('Alt text (English or Bengali) is required for images.');
      return;
    }

    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const dims = await readImageDimensions(uploadFile);
      const tags = uploadTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const created = await uploadCmsMedia({
        file: uploadFile,
        folder: isPdf && uploadFolder === 'pages' ? 'downloads' : uploadFolder,
        tags,
        altEn: uploadAltEn.trim() || undefined,
        altBn: uploadAltBn.trim() || undefined,
        captionEn: uploadCaptionEn.trim() || undefined,
        width: dims.width,
        height: dims.height,
      });

      setItems((prev) => [created, ...prev]);
      setTotal((t) => t + 1);
      setUploadFile(null);
      setUploadTagsInput('');
      setUploadAltEn('');
      setUploadAltBn('');
      setUploadCaptionEn('');
      setShowUploadPanel(false);
      setNotice(
        `Uploaded "${created.originalName}"${
          created.variants
            ? ` with ${Object.keys(created.variants).length} WebP/AVIF variants & EXIF stripped`
            : ''
        }.`,
      );
      await selectAsset(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Media upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !canEditCms) return;
    if (selected.mimeType.startsWith('image/') && !editAltEn.trim() && !editAltBn.trim()) {
      setError('Alt text (English or Bengali) is required for images.');
      return;
    }

    setSavingMeta(true);
    setError(null);
    setNotice(null);
    try {
      const tags = editTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const updated = await updateCmsMedia(selected.id, {
        altEn: editAltEn.trim() || null,
        altBn: editAltBn.trim() || null,
        captionEn: editCaptionEn.trim() || null,
        captionBn: editCaptionBn.trim() || null,
        folder: editFolder,
        tags,
      });
      setSelected(updated);
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
      setNotice(`Saved metadata and tags for "${updated.originalName}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update asset metadata.');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleDeleteAsset = async (force = false) => {
    if (!selected || !canDeleteCms) return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      await deleteCmsMedia(selected.id, force);
      setItems((prev) => prev.filter((it) => it.id !== selected.id));
      setTotal((t) => Math.max(0, t - 1));
      setNotice(`Deleted "${selected.originalName}" and its storage variants.`);
      setSelected(null);
      setUsage(null);
      setDraftWarningConfirm(false);
    } catch (err) {
      if (err instanceof CmsApiError && err.code === 'CMS_MEDIA_IN_USE_WARNING') {
        setDraftWarningConfirm(true);
      } else {
        setError(err instanceof Error ? err.message : 'Could not delete asset.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setNotice(`Copied asset URL: ${url}`);
    } catch {
      setNotice(`Asset URL: ${url}`);
    }
  };

  if (!canViewCms) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] text-center p-8 rounded-2xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-sm max-w-xl mx-auto my-8">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 mb-4">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold mb-2">CMS Media Library Restricted</h1>
        <p className="text-sm text-[rgb(var(--text-secondary))]">
          Your role ({roleName || 'Operator'}) lacks <code>cms:view</code> permission.
        </p>
      </div>
    );
  }

  const selectedIsPdf = selected?.mimeType === 'application/pdf';
  const selectedVariantObj =
    selected && activeVariantPreview !== 'original'
      ? selected.variants?.[activeVariantPreview]
      : undefined;
  const activePreviewUrl = selectedVariantObj?.publicUrl || selected?.publicUrl || '';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary-600 dark:text-primary-300 uppercase tracking-wider mb-1">
            <ImageIcon className="h-3.5 w-3.5" />
            Website CMS · Assets &amp; Downloads
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
            Media Library
          </h1>
          <p className="text-sm text-[rgb(var(--text-secondary))] mt-0.5">
            Validated uploads via FileStorage driver (magic-byte check, EXIF stripping, WebP/AVIF variants, sanitized SVGs, and PDF downloads).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadMedia()}
            disabled={loading}
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canCreateCms && (
            <button
              type="button"
              onClick={() => setShowUploadPanel((p) => !p)}
              className="h-9 px-3.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
            >
              <Upload className="h-3.5 w-3.5" />
              {showUploadPanel ? 'Hide Upload' : 'Upload File'}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Upload Form Card */}
      {showUploadPanel && canCreateCms && (
        <form
          onSubmit={handleUploadSubmit}
          className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-5 shadow-sm space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Upload Verified Image or PDF Download</h2>
            <span className="text-[11px] text-[rgb(var(--text-muted))]">
              Images ≤ 5 MB (EXIF stripped + thumb/medium/WebP/AVIF generated) · Sanitized SVG ≤ 1 MB · PDF ≤ 15 MB
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                File (PNG, JPEG, WebP, GIF, safe SVG, or PDF) <span className="text-rose-500">*</span>
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf,.pdf,.svg"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setUploadFile(f);
                  if (f && (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) {
                    setUploadFolder('downloads');
                  }
                }}
                className="block w-full text-xs text-[rgb(var(--text-secondary))] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[rgb(var(--border-base))] file:bg-[rgb(var(--bg-muted))] file:text-xs file:font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Folder</label>
              <select
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              >
                {FOLDERS.filter((f) => f !== 'all').map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={uploadTagsInput}
                onChange={(e) => setUploadTagsInput(e.target.value)}
                placeholder="hero, payroll, brochure, 2026"
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Alt Text (English){' '}
                {uploadFile?.type !== 'application/pdf' && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="text"
                value={uploadAltEn}
                onChange={(e) => setUploadAltEn(e.target.value)}
                placeholder="Required accessible description for images"
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Alt Text (বাংলা)</label>
              <input
                type="text"
                lang="bn"
                value={uploadAltBn}
                onChange={(e) => setUploadAltBn(e.target.value)}
                placeholder="ছবির বাংলা বর্ণনা"
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Caption / Download Title</label>
              <input
                type="text"
                value={uploadCaptionEn}
                onChange={(e) => setUploadCaptionEn(e.target.value)}
                placeholder="Optional label or brochure title"
                className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowUploadPanel(false)}
              className="h-9 px-3.5 rounded-lg border border-[rgb(var(--border-base))] text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="h-9 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload &amp; Process
            </button>
          </div>
        </form>
      )}

      {/* Search & Filters */}
      <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-3.5 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-3.5 w-3.5 text-[rgb(var(--text-muted))] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search filename, alt text, caption, or tag..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
          />
        </div>

        <select
          aria-label="Filter by folder"
          value={folderFilter}
          onChange={(e) => setFolderFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium"
        >
          {FOLDERS.map((f) => (
            <option key={f} value={f}>
              Folder: {f === 'all' ? 'All Folders' : f}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by file kind"
          value={mimeGroup}
          onChange={(e) => setMimeGroup(e.target.value as 'all' | 'images' | 'pdfs')}
          className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium"
        >
          <option value="all">Type: All ({total})</option>
          <option value="images">Images Only</option>
          <option value="pdfs">PDF Downloads</option>
        </select>

        <select
          aria-label="Filter by tag"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium"
        >
          <option value="all">Tag: All Tags</option>
          {allAvailableTags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
      </div>

      {/* Main Split: Grid + Asset Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Asset Grid */}
        <div className={selected ? 'lg:col-span-7' : 'lg:col-span-12'}>
          {loading ? (
            <div className="h-64 rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] flex items-center justify-center text-xs text-[rgb(var(--text-muted))] gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Media Library assets...
            </div>
          ) : items.length === 0 ? (
            <div className="h-64 rounded-xl border border-dashed border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))] flex flex-col items-center justify-center text-center p-6">
              <FolderOpen className="h-8 w-8 text-[rgb(var(--text-muted))] mb-2" />
              <p className="text-sm font-medium">No assets match your current filters</p>
              <p className="text-xs text-[rgb(var(--text-muted))] mt-1">
                Upload images (with required alt text) or PDF downloads using the button above.
              </p>
            </div>
          ) : (
            <div
              className={`grid gap-3 ${
                selected
                  ? 'grid-cols-2 sm:grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5'
              }`}
            >
              {items.map((item) => {
                const isSelected = selected?.id === item.id;
                const isPdf = item.mimeType === 'application/pdf';
                const previewSrc = item.variants?.thumb?.publicUrl || item.publicUrl;
                const variantCount = item.variants ? Object.keys(item.variants).length : 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void selectAsset(item)}
                    className={`text-left rounded-xl border overflow-hidden transition-all bg-[rgb(var(--bg-surface))] ${
                      isSelected
                        ? 'border-primary-600 ring-2 ring-primary-600/30'
                        : 'border-[rgb(var(--border-base))] hover:border-[rgb(var(--border-strong))]'
                    }`}
                  >
                    <div className="aspect-[4/3] bg-[rgb(var(--bg-muted))] relative flex items-center justify-center overflow-hidden">
                      {isPdf ? (
                        <div className="flex flex-col items-center gap-1.5 text-rose-600 dark:text-rose-300">
                          <FileText className="h-10 w-10" />
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/15">
                            PDF
                          </span>
                        </div>
                      ) : (
                        <img
                          src={previewSrc}
                          alt={item.altEn || item.altBn || item.originalName}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}

                      <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1">
                        {item.exifStripped && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[9px] font-medium">
                            EXIF clean
                          </span>
                        )}
                        {variantCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-600/85 text-white text-[9px] font-medium">
                            +{variantCount} fmt
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5 space-y-1">
                      <p className="text-xs font-semibold truncate">{item.originalName}</p>
                      <p className="text-[11px] text-[rgb(var(--text-muted))] truncate">
                        {item.folder} · {formatBytes(item.sizeBytes)}
                        {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                      </p>
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {item.tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded bg-[rgb(var(--bg-muted))] text-[10px] text-[rgb(var(--text-secondary))]"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Inspector & Usage Panel */}
        {selected && (
          <aside className="lg:col-span-5 rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold truncate">{selected.originalName}</h2>
                <p className="text-[11px] text-[rgb(var(--text-muted))]">
                  {selected.mimeType} · {formatBytes(selected.sizeBytes)}
                  {selected.width && selected.height ? ` · ${selected.width}×${selected.height}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setUsage(null);
                }}
                aria-label="Close inspector"
                className="h-7 w-7 rounded inline-flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              {/* Preview + Variant Switcher */}
              {selectedIsPdf ? (
                <div className="p-4 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-rose-600 shrink-0" />
                    <div>
                      <p className="font-semibold">PDF Download Asset</p>
                      <p className="text-[11px] text-[rgb(var(--text-muted))]">
                        Ready for landing page links and rich-text downloads
                      </p>
                    </div>
                  </div>
                  <a
                    href={`${selected.publicUrl}?download=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 px-3 rounded-lg bg-primary-600 text-white font-semibold inline-flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] overflow-hidden max-h-56 flex items-center justify-center">
                    <img
                      src={activePreviewUrl}
                      alt={selected.altEn || selected.altBn || selected.originalName}
                      className="max-h-56 object-contain"
                    />
                  </div>

                  {selected.variants && Object.keys(selected.variants).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveVariantPreview('original')}
                        className={`px-2 py-1 rounded border text-[11px] font-medium ${
                          activeVariantPreview === 'original'
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]'
                        }`}
                      >
                        Original ({formatBytes(selected.sizeBytes)})
                      </button>
                      {(['thumb', 'medium', 'webp', 'avif'] as const).map((key) => {
                        const v = selected.variants?.[key];
                        if (!v) return null;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setActiveVariantPreview(key)}
                            className={`px-2 py-1 rounded border text-[11px] font-medium uppercase ${
                              activeVariantPreview === key
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]'
                            }`}
                          >
                            {key} ({formatBytes(v.sizeBytes)})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Copy URL & Storage Key Info */}
              <div className="p-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/30 flex items-center justify-between gap-2">
                <code className="text-[10px] truncate text-[rgb(var(--text-secondary))]">
                  {activePreviewUrl}
                </code>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleCopyUrl(activePreviewUrl)}
                    className="h-7 px-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] inline-flex items-center gap-1 text-[11px]"
                  >
                    <Copy className="h-3 w-3" />
                    Copy URL
                  </button>
                  <a
                    href={activePreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-7 w-7 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] inline-flex items-center justify-center"
                    aria-label="Open file in new tab"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* Where Used Section */}
              <div className="p-3 rounded-lg border border-[rgb(var(--border-base))] space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-primary-600" />
                    Where This File Is Used
                  </span>
                  {usage && (
                    <span className="px-2 py-0.5 rounded bg-[rgb(var(--bg-muted))] text-[10px]">
                      {usage.totalReferences} reference(s)
                    </span>
                  )}
                </div>

                {loadingUsage ? (
                  <p className="text-[11px] text-[rgb(var(--text-muted))]">Scanning CMS pages, posts, authors, and settings...</p>
                ) : !usage || usage.totalReferences === 0 ? (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    Unused — not referenced in any active page, post, author, or setting.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {usage.warningMessage && (
                      <div
                        className={`p-2 rounded border text-[11px] flex items-start gap-1.5 ${
                          usage.deletionBlocked
                            ? 'border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200'
                            : 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                        }`}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{usage.warningMessage}</span>
                      </div>
                    )}

                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {usage.pages.map((p, i) => (
                        <li
                          key={`${p.pageId}-${p.locale}-${i}`}
                          className="px-2.5 py-1.5 rounded border border-[rgb(var(--border-base))] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="font-medium truncate block">
                              Page: {p.title} (/{p.slug} · {p.locale.toUpperCase()})
                            </span>
                            <span className="text-[10px] text-[rgb(var(--text-muted))]">
                              {p.location}
                            </span>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              p.isPublished
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {p.isPublished ? 'Published' : p.status}
                          </span>
                        </li>
                      ))}
                      {usage.posts.map((post) => (
                        <li
                          key={post.postId}
                          className="px-2.5 py-1.5 rounded border border-[rgb(var(--border-base))] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="font-medium truncate block">
                              Post: {post.title} (/blog/{post.slug})
                            </span>
                            <span className="text-[10px] text-[rgb(var(--text-muted))]">
                              {post.location}
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-[rgb(var(--bg-muted))]">
                            {post.status}
                          </span>
                        </li>
                      ))}
                      {usage.authors.map((a) => (
                        <li
                          key={a.authorId}
                          className="px-2.5 py-1.5 rounded border border-[rgb(var(--border-base))]"
                        >
                          Author Avatar: <strong>{a.displayName}</strong>
                        </li>
                      ))}
                      {usage.settings.map((s) => (
                        <li
                          key={s.key}
                          className="px-2.5 py-1.5 rounded border border-[rgb(var(--border-base))]"
                        >
                          Site Setting: <code>{s.key}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Metadata & Tags Editor */}
              {canEditCms && (
                <form onSubmit={handleSaveMetadata} className="space-y-2.5 pt-1 border-t border-[rgb(var(--border-base))]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium mb-1">
                        Alt Text (EN) {!selectedIsPdf && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="text"
                        value={editAltEn}
                        onChange={(e) => setEditAltEn(e.target.value)}
                        className="w-full h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium mb-1">Alt Text (BN)</label>
                      <input
                        type="text"
                        lang="bn"
                        value={editAltBn}
                        onChange={(e) => setEditAltBn(e.target.value)}
                        className="w-full h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium mb-1">Folder</label>
                      <select
                        value={editFolder}
                        onChange={(e) => setEditFolder(e.target.value)}
                        className="w-full h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                      >
                        {FOLDERS.filter((f) => f !== 'all').map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium mb-1 flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        Tags
                      </label>
                      <input
                        type="text"
                        value={editTagsInput}
                        onChange={(e) => setEditTagsInput(e.target.value)}
                        placeholder="tag1, tag2"
                        className="w-full h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium mb-1">Caption / Title</label>
                    <input
                      type="text"
                      value={editCaptionEn}
                      onChange={(e) => setEditCaptionEn(e.target.value)}
                      className="w-full h-8 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={savingMeta}
                      className="h-8 px-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {savingMeta ? 'Saving...' : 'Save Metadata'}
                    </button>

                    {canDeleteCms && (
                      <div className="flex items-center gap-2">
                        {draftWarningConfirm ? (
                          <button
                            type="button"
                            disabled={deleting || Boolean(usage?.deletionBlocked)}
                            onClick={() => void handleDeleteAsset(true)}
                            className="h-8 px-3 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Confirm Delete (Draft Links Exist)
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={deleting || loadingUsage || Boolean(usage?.deletionBlocked)}
                            title={
                              usage?.deletionBlocked
                                ? 'Blocked: remove this asset from published pages/posts first'
                                : 'Delete media asset and all variants'
                            }
                            onClick={() => void handleDeleteAsset(false)}
                            className="h-8 px-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </form>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
