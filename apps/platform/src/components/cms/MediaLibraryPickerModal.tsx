import { useEffect, useState } from 'react';
import type { CmsMediaDto } from '@hrm/shared-types';
import {
  AlertCircle,
  Check,
  Image as ImageIcon,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {
  listCmsMedia,
  updateCmsMedia,
  uploadCmsMedia,
} from '@/lib/platform-cms-api';

export interface SelectedMediaInsertion {
  media: CmsMediaDto;
  src: string;
  alt: string;
  title?: string;
  width?: number;
  height?: number;
}

interface MediaLibraryPickerModalProps {
  isOpen: boolean;
  locale?: 'en' | 'bn';
  defaultFolder?: string;
  onClose: () => void;
  onSelect: (selection: SelectedMediaInsertion) => void;
}

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

function readImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith('image/')) return Promise.resolve({});
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const result = {
        width: img.naturalWidth || undefined,
        height: img.naturalHeight || undefined,
      };
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({});
    };
    img.src = objectUrl;
  });
}

export function MediaLibraryPickerModal({
  isOpen,
  locale = 'en',
  defaultFolder = 'pages',
  onClose,
  onSelect,
}: MediaLibraryPickerModalProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<CmsMediaDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedMedia, setSelectedMedia] = useState<CmsMediaDto | null>(null);
  const [insertAlt, setInsertAlt] = useState('');
  const [insertTitle, setInsertTitle] = useState('');
  const [savingAlt, setSavingAlt] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFolder, setUploadFolder] = useState<string>(defaultFolder);
  const [uploadTags, setUploadTags] = useState('');
  const [uploadAltEn, setUploadAltEn] = useState('');
  const [uploadAltBn, setUploadAltBn] = useState('');
  const [uploadCaptionEn, setUploadCaptionEn] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fetchMedia = async (folderVal = folderFilter, searchVal = searchQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCmsMedia({
        folder: folderVal,
        mimeGroup: 'images',
        search: searchVal,
        limit: 48,
      });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Media Library assets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMedia(null);
    setInsertAlt('');
    setInsertTitle('');
    setError(null);
    void fetchMedia(folderFilter, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, folderFilter]);

  if (!isOpen) return null;

  const handleChooseCard = (item: CmsMediaDto) => {
    setSelectedMedia(item);
    const localizedAlt =
      locale === 'bn' ? item.altBn || item.altEn || '' : item.altEn || item.altBn || '';
    const localizedTitle =
      locale === 'bn'
        ? item.captionBn || item.captionEn || ''
        : item.captionEn || item.captionBn || '';
    setInsertAlt(localizedAlt);
    setInsertTitle(localizedTitle);
    setError(null);
  };

  const handleInsertSelected = () => {
    if (!selectedMedia) return;
    if (!insertAlt.trim()) {
      setError('Alt text is required for accessibility before inserting an image.');
      return;
    }
    onSelect({
      media: selectedMedia,
      src: selectedMedia.publicUrl,
      alt: insertAlt.trim(),
      title: insertTitle.trim() || undefined,
      width: selectedMedia.width ?? undefined,
      height: selectedMedia.height ?? undefined,
    });
    onClose();
  };

  const handleSaveAltToLibrary = async () => {
    if (!selectedMedia) return;
    setSavingAlt(true);
    setError(null);
    try {
      const updated = await updateCmsMedia(selectedMedia.id, {
        ...(locale === 'bn' ? { altBn: insertAlt.trim() || null } : { altEn: insertAlt.trim() || null }),
        ...(locale === 'bn'
          ? { captionBn: insertTitle.trim() || null }
          : { captionEn: insertTitle.trim() || null }),
      });
      setSelectedMedia(updated);
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update media metadata.');
    } finally {
      setSavingAlt(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setError('Choose a PNG, JPEG, WebP, or GIF image file to upload.');
      return;
    }
    if (!uploadAltEn.trim() && !uploadAltBn.trim()) {
      setError('Provide alt text before uploading so CMS images remain accessible.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const dims = await readImageDimensions(uploadFile);
      const created = await uploadCmsMedia({
        file: uploadFile,
        folder: uploadFolder,
        tags: uploadTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        altEn: uploadAltEn.trim() || undefined,
        altBn: uploadAltBn.trim() || undefined,
        captionEn: uploadCaptionEn.trim() || undefined,
        width: dims.width,
        height: dims.height,
      });
      setItems((prev) => [created, ...prev]);
      handleChooseCard(created);
      setUploadFile(null);
      setUploadTags('');
      setUploadAltEn('');
      setUploadAltBn('');
      setUploadCaptionEn('');
      setActiveTab('library');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cms-media-library-title"
    >
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary-600/10 text-primary-600 flex items-center justify-center">
              <ImageIcon className="h-4 w-4" />
            </div>
            <div>
              <h2 id="cms-media-library-title" className="text-sm font-semibold">
                CMS Media Library
              </h2>
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Insert a verified asset or upload a new image with required alt text
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            aria-label="Close Media Library"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]">
          <div className="inline-flex rounded-lg p-0.5 bg-[rgb(var(--bg-muted))] border border-[rgb(var(--border-base))]">
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'library'
                  ? 'bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-sm'
                  : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
              }`}
            >
              Browse Library
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                activeTab === 'upload'
                  ? 'bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-sm'
                  : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload New
            </button>
          </div>

          {activeTab === 'library' && (
            <div className="flex items-center gap-2">
              <select
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                aria-label="Filter media folder"
                className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              >
                {FOLDERS.map((f) => (
                  <option key={f} value={f}>
                    {f === 'all' ? 'All Folders' : f}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="h-3.5 w-3.5 text-[rgb(var(--text-muted))] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void fetchMedia(folderFilter, searchQuery);
                    }
                  }}
                  placeholder="Search filename or alt..."
                  className="h-8 pl-8 pr-2.5 w-48 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                />
              </div>

              <button
                type="button"
                onClick={() => void fetchMedia(folderFilter, searchQuery)}
                className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                Search
              </button>
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'library' ? (
            loading ? (
              <div className="h-48 flex items-center justify-center text-xs text-[rgb(var(--text-muted))] gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading CMS media assets...
              </div>
            ) : items.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center border border-dashed border-[rgb(var(--border-strong))] rounded-xl p-6">
                <ImageIcon className="h-8 w-8 text-[rgb(var(--text-muted))] mb-2" />
                <p className="text-sm font-medium">No media assets match your filter</p>
                <p className="text-xs text-[rgb(var(--text-muted))] mt-1">
                  Switch to &ldquo;Upload New&rdquo; to add PNG, JPEG, WebP, or GIF images.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {items.map((item) => {
                  const isSelected = selectedMedia?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleChooseCard(item)}
                      className={`group text-left rounded-lg border overflow-hidden transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
                        isSelected
                          ? 'border-primary-600 ring-2 ring-primary-600/30 bg-primary-600/5'
                          : 'border-[rgb(var(--border-base))] hover:border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))]'
                      }`}
                    >
                      <div className="aspect-[4/3] bg-[rgb(var(--bg-muted))] relative overflow-hidden flex items-center justify-center">
                        <img
                          src={item.publicUrl}
                          alt={item.altEn || item.altBn || item.originalName}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <span className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary-600 text-white flex items-center justify-center shadow">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium truncate">{item.originalName}</p>
                        <p className="text-[11px] text-[rgb(var(--text-muted))] truncate mt-0.5">
                          {item.folder} · {Math.max(1, Math.round(item.sizeBytes / 1024))} KB
                          {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <form onSubmit={handleUploadSubmit} className="max-w-xl mx-auto space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Image File (PNG, JPEG, WebP, GIF, or sanitized SVG · max 5 MB · EXIF stripped)
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-[rgb(var(--text-secondary))] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-[rgb(var(--border-base))] file:bg-[rgb(var(--bg-muted))] file:text-xs file:font-medium hover:file:bg-[rgb(var(--bg-hover))]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="hero, illustration, 2026"
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <label className="block text-xs font-medium mb-1">Caption / Title (optional)</label>
                  <input
                    type="text"
                    value={uploadCaptionEn}
                    onChange={(e) => setUploadCaptionEn(e.target.value)}
                    placeholder="Short descriptive caption"
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Alt Text (English) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={uploadAltEn}
                    onChange={(e) => setUploadAltEn(e.target.value)}
                    placeholder="Describe what the image shows"
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Alt Text (বাংলা / optional)
                  </label>
                  <input
                    type="text"
                    lang="bn"
                    value={uploadAltBn}
                    onChange={(e) => setUploadAltBn(e.target.value)}
                    placeholder="ছবির সংক্ষিপ্ত বর্ণনা লিখুন"
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploading}
                  className="h-9 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Upload to Media Library
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer with Selected Image Alt Text confirmation */}
        <div className="px-5 py-3.5 border-t border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {selectedMedia ? (
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-[rgb(var(--text-secondary))] mb-1">
                  Alt Text (Required) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  lang={locale}
                  value={insertAlt}
                  onChange={(e) => setInsertAlt(e.target.value)}
                  placeholder="Describe this image for screen readers"
                  className="w-full h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[rgb(var(--text-secondary))] mb-1">
                  Optional Title / Caption
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    lang={locale}
                    value={insertTitle}
                    onChange={(e) => setInsertTitle(e.target.value)}
                    placeholder="Caption or hover title"
                    className="flex-1 h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleSaveAltToLibrary}
                    disabled={savingAlt}
                    title="Save alt/caption back to Media Library"
                    className="h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-[11px] font-medium"
                  >
                    {savingAlt ? 'Saving...' : 'Update Asset'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Select an image from the grid to configure alt text and insert it.
            </p>
          )}

          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedMedia || !insertAlt.trim()}
              onClick={handleInsertSelected}
              className="h-9 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-40"
            >
              Insert Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
