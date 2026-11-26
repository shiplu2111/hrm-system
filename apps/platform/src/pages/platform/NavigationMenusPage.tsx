import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CmsMenuDto, CmsMenuItemDto, CmsPageDto } from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FolderTree,
  Globe2,
  GripVertical,
  Languages,
  Link2,
  ListTree,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermission';
import {
  createCmsMenuItem,
  deleteCmsMenuItem,
  ensureDefaultCmsMenus,
  listCmsMenus,
  listCmsPages,
  reorderCmsMenuItems,
  updateCmsMenuItem,
} from '@/lib/platform-cms-api';

interface MenuItemNode extends CmsMenuItemDto {
  children: MenuItemNode[];
}

function buildMenuTree(items: CmsMenuItemDto[]): MenuItemNode[] {
  const map = new Map<string, MenuItemNode>();
  const roots: MenuItemNode[] = [];

  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const item of sorted) {
    map.set(item.id, { ...item, children: [] });
  }
  for (const item of sorted) {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

const STATIC_WEBSITE_ROUTES = [
  { labelEn: 'Home', labelBn: 'হোম', href: '/' },
  { labelEn: 'Blog', labelBn: 'ব্লগ', href: '/blog' },
  { labelEn: 'Changelog', labelBn: 'পরিবর্তন তালিকা', href: '/changelog' },
  { labelEn: 'Careers', labelBn: 'ক্যারিয়ার', href: '/careers' },
  { labelEn: 'Customer Login', labelBn: 'লগইন', href: '/login' },
  { labelEn: 'Start Free Trial', labelBn: 'ফ্রি ট্রায়াল', href: '/signup' },
];

export function NavigationMenusPage() {
  const { can, roleName } = usePermissions();
  const canViewCms = can('cms', 'view');
  const canEditCms = can('cms', 'edit');

  const [menus, setMenus] = useState<CmsMenuDto[]>([]);
  const [pages, setPages] = useState<CmsPageDto[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string>('');
  const [previewLocale, setPreviewLocale] = useState<'en' | 'bn'>('en');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Drag & drop state within sibling container
  const [dragState, setDragState] = useState<{
    id: string;
    parentId: string | null;
  } | null>(null);

  // Add / Edit Item modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CmsMenuItemDto | null>(null);
  const [formParentId, setFormParentId] = useState<string | null>(null);
  const [linkKind, setLinkKind] = useState<'internal_page' | 'external' | 'group'>('internal_page');
  const [formTargetPageId, setFormTargetPageId] = useState<string>('');
  const [pageSearch, setPageSearch] = useState('');
  const [formHref, setFormHref] = useState('');
  const [formLabelEn, setFormLabelEn] = useState('');
  const [formLabelBn, setFormLabelBn] = useState('');
  const [formDescEn, setFormDescEn] = useState('');
  const [formDescBn, setFormDescBn] = useState('');
  const [formBadgeEn, setFormBadgeEn] = useState('');
  const [formBadgeBn, setFormBadgeBn] = useState('');
  const [formOpenInNewTab, setFormOpenInNewTab] = useState(false);
  const [formIsVisible, setFormIsVisible] = useState(true);

  const loadData = useCallback(async () => {
    if (!canViewCms) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [menuList, pageList] = await Promise.all([
        listCmsMenus(),
        listCmsPages({ includeTrashed: true }),
      ]);
      setMenus(menuList);
      setPages(pageList);
      setSelectedMenuId((prev) =>
        prev && menuList.some((m) => m.id === prev) ? prev : (menuList[0]?.id ?? ''),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load navigation menus.');
    } finally {
      setLoading(false);
    }
  }, [canViewCms]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeMenu = useMemo(
    () => menus.find((m) => m.id === selectedMenuId) ?? menus[0] ?? null,
    [menus, selectedMenuId],
  );

  const tree = useMemo(
    () => (activeMenu ? buildMenuTree(activeMenu.items) : []),
    [activeMenu],
  );

  const flaggedItemsCount = useMemo(
    () =>
      menus.reduce(
        (acc, m) => acc + m.items.filter((it) => Boolean(it.targetWarning)).length,
        0,
      ),
    [menus],
  );

  const filteredPickerPages = useMemo(() => {
    const q = pageSearch.trim().toLowerCase();
    return pages.filter((p) => {
      if (!q) return true;
      return (
        p.slug.toLowerCase().includes(q) ||
        (p.titleEn || '').toLowerCase().includes(q) ||
        (p.titleBn || '').toLowerCase().includes(q)
      );
    });
  }, [pages, pageSearch]);

  const applyMenuUpdate = (updatedMenu: CmsMenuDto) => {
    setMenus((prev) => prev.map((m) => (m.id === updatedMenu.id ? updatedMenu : m)));
  };

  const handleEnsureDefaults = async () => {
    if (!canEditCms) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await ensureDefaultCmsMenus();
      setMenus(updated);
      if (!selectedMenuId && updated[0]) setSelectedMenuId(updated[0].id);
      setNotice('Initialized default Header Navigation and Footer Link Columns.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not initialize default menus.');
    } finally {
      setBusy(false);
    }
  };

  const openCreateModal = (
    parentId: string | null,
    defaultKind: 'internal_page' | 'external' | 'group' = 'internal_page',
  ) => {
    setEditingItem(null);
    setFormParentId(parentId);
    setLinkKind(defaultKind);
    setFormTargetPageId('');
    setPageSearch('');
    setFormHref(defaultKind === 'group' ? '#' : '');
    setFormLabelEn('');
    setFormLabelBn('');
    setFormDescEn('');
    setFormDescBn('');
    setFormBadgeEn('');
    setFormBadgeBn('');
    setFormOpenInNewTab(false);
    setFormIsVisible(true);
    setModalOpen(true);
  };

  const openEditModal = (item: CmsMenuItemDto) => {
    setEditingItem(item);
    setFormParentId(item.parentId ?? null);
    if (item.href === '#' && !item.targetPageId) {
      setLinkKind('group');
    } else if (item.targetPageId || (item.href.startsWith('/') && !item.href.startsWith('//'))) {
      setLinkKind('internal_page');
    } else {
      setLinkKind('external');
    }
    setFormTargetPageId(item.targetPageId ?? '');
    setPageSearch('');
    setFormHref(item.href);
    setFormLabelEn(item.labelEn);
    setFormLabelBn(item.labelBn ?? '');
    setFormDescEn(item.descriptionEn ?? '');
    setFormDescBn(item.descriptionBn ?? '');
    setFormBadgeEn(item.badgeEn ?? '');
    setFormBadgeBn(item.badgeBn ?? '');
    setFormOpenInNewTab(item.openInNewTab);
    setFormIsVisible(item.isVisible);
    setModalOpen(true);
  };

  const handlePickInternalPage = (page: CmsPageDto) => {
    setFormTargetPageId(page.id);
    const defaultHref = page.canonicalPath || (page.slug === 'home' ? '/' : `/${page.slug}`);
    setFormHref(defaultHref);
    if (!formLabelEn.trim()) setFormLabelEn(page.titleEn || `/${page.slug}`);
    if (!formLabelBn.trim() && page.titleBn) setFormLabelBn(page.titleBn);
  };

  const handleSaveItemModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMenu || !canEditCms) return;
    if (!formLabelEn.trim()) {
      setError('English label is required.');
      return;
    }

    const finalHref = linkKind === 'group' ? '#' : formHref.trim() || '/';
    setBusy(true);
    setError(null);
    try {
      const payload = {
        parentId: formParentId,
        labelEn: formLabelEn.trim(),
        labelBn: formLabelBn.trim() || null,
        descriptionEn: formDescEn.trim() || null,
        descriptionBn: formDescBn.trim() || null,
        targetPageId: linkKind === 'internal_page' ? formTargetPageId || null : null,
        href: finalHref,
        badgeEn: formBadgeEn.trim() || null,
        badgeBn: formBadgeBn.trim() || null,
        openInNewTab: linkKind === 'group' ? false : formOpenInNewTab,
        isVisible: formIsVisible,
      };

      const updated = editingItem
        ? await updateCmsMenuItem(activeMenu.id, editingItem.id, payload)
        : await createCmsMenuItem(activeMenu.id, payload);

      applyMenuUpdate(updated);
      setModalOpen(false);
      setNotice(
        editingItem
          ? `Updated "${formLabelEn.trim()}" in ${activeMenu.name}.`
          : `Added "${formLabelEn.trim()}" to ${activeMenu.name}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save menu item.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleVisible = async (item: CmsMenuItemDto) => {
    if (!activeMenu || !canEditCms) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateCmsMenuItem(activeMenu.id, item.id, {
        isVisible: !item.isVisible,
      });
      applyMenuUpdate(updated);
      setNotice(
        !item.isVisible
          ? `Shown "${item.labelEn}" on public navigation.`
          : `Hidden "${item.labelEn}" from public navigation (kept in editor).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle visibility.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteItem = async (item: CmsMenuItemDto) => {
    if (!activeMenu || !canEditCms) return;
    if (
      !window.confirm(
        `Delete "${item.labelEn}"${
          activeMenu.items.some((c) => c.parentId === item.id)
            ? ' and all nested items inside this group/column'
            : ''
        }?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await deleteCmsMenuItem(activeMenu.id, item.id);
      applyMenuUpdate(updated);
      setNotice(`Deleted "${item.labelEn}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item.');
    } finally {
      setBusy(false);
    }
  };

  const persistSiblingOrder = async (siblings: CmsMenuItemDto[], parentId: string | null) => {
    if (!activeMenu || !canEditCms) return;
    const reorderPayload = siblings.map((s, idx) => ({
      id: s.id,
      parentId,
      sortOrder: idx + 1,
    }));
    // Optimistic update
    const updatedOrderMap = new Map(reorderPayload.map((r) => [r.id, r.sortOrder]));
    setMenus((prev) =>
      prev.map((m) =>
        m.id === activeMenu.id
          ? {
              ...m,
              items: m.items.map((it) =>
                updatedOrderMap.has(it.id)
                  ? { ...it, sortOrder: updatedOrderMap.get(it.id)! }
                  : it,
              ),
            }
          : m,
      ),
    );
    try {
      const savedMenu = await reorderCmsMenuItems(activeMenu.id, { items: reorderPayload });
      applyMenuUpdate(savedMenu);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save menu order.');
      await loadData();
    }
  };

  const handleMoveSibling = (
    siblings: MenuItemNode[],
    index: number,
    delta: -1 | 1,
    parentId: string | null,
  ) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;
    const copy = [...siblings];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    void persistSiblingOrder(copy, parentId);
  };

  const handleDropSibling = (
    siblings: MenuItemNode[],
    targetItem: MenuItemNode,
    parentId: string | null,
  ) => {
    if (!dragState || dragState.parentId !== parentId || dragState.id === targetItem.id) {
      setDragState(null);
      return;
    }
    const fromIdx = siblings.findIndex((s) => s.id === dragState.id);
    const toIdx = siblings.findIndex((s) => s.id === targetItem.id);
    setDragState(null);
    if (fromIdx < 0 || toIdx < 0) return;

    const copy = [...siblings];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    void persistSiblingOrder(copy, parentId);
  };

  if (!canViewCms) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] text-center p-8 rounded-2xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-sm max-w-xl mx-auto my-8">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 mb-4">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold mb-2">CMS Navigation Restricted</h1>
        <p className="text-sm text-[rgb(var(--text-secondary))]">
          Your role ({roleName || 'Operator'}) lacks <code>cms:view</code> permission.
        </p>
      </div>
    );
  }

  const renderNodeRow = (
    node: MenuItemNode,
    siblings: MenuItemNode[],
    index: number,
    depth: 0 | 1 | 2,
  ) => {
    const parentId = node.parentId ?? null;
    const isFooterCol = activeMenu?.location === 'footer' && depth === 0;
    const isHeaderMegaGroup = activeMenu?.location === 'header' && depth === 1;
    const canAddChild =
      canEditCms &&
      ((activeMenu?.location === 'header' && depth < 2) ||
        (activeMenu?.location === 'footer' && depth === 0));

    const localizedLabel =
      previewLocale === 'bn' ? node.labelBn || node.labelEn : node.labelEn;
    const missingBnLabel = previewLocale === 'bn' && !node.labelBn;

    return (
      <div
        key={node.id}
        draggable={canEditCms}
        onDragStart={(e) => {
          e.stopPropagation();
          setDragState({ id: node.id, parentId });
        }}
        onDragOver={(e) => {
          if (dragState && dragState.parentId === parentId && dragState.id !== node.id) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleDropSibling(siblings, node, parentId);
        }}
        className={`rounded-xl border transition-all ${
          node.targetWarning
            ? 'border-amber-500/50 bg-amber-500/5'
            : !node.isVisible
              ? 'border-dashed border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-muted))]/35 opacity-75'
              : depth === 0
                ? 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]'
                : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/20'
        }`}
      >
        <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {canEditCms && (
              <span
                title="Drag to reorder"
                className="cursor-grab text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] shrink-0"
              >
                <GripVertical className="h-4 w-4" />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`text-xs font-semibold ${
                    depth === 0 ? 'text-[rgb(var(--text-primary))]' : 'text-[rgb(var(--text-secondary))]'
                  }`}
                  lang={previewLocale}
                >
                  {localizedLabel}
                </span>

                {missingBnLabel && (
                  <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-700 dark:text-orange-300 text-[10px]">
                    BN missing
                  </span>
                )}

                {isFooterCol && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[10px] font-medium">
                    Footer Column
                  </span>
                )}
                {isHeaderMegaGroup && (
                  <span className="px-1.5 py-0.5 rounded bg-primary-600/10 text-primary-700 dark:text-primary-300 text-[10px] font-medium">
                    Mega-Menu Group
                  </span>
                )}
                {node.badgeEn && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium">
                    {previewLocale === 'bn' ? node.badgeBn || node.badgeEn : node.badgeEn}
                  </span>
                )}
                {node.openInNewTab && (
                  <span
                    title="Opens in new browser tab"
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-[rgb(var(--border-base))] text-[10px] text-[rgb(var(--text-muted))]"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                    New tab
                  </span>
                )}
                {!node.isVisible && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-600 dark:text-slate-300 text-[10px] font-medium">
                    <EyeOff className="h-2.5 w-2.5" />
                    Hidden
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-[rgb(var(--text-muted))]">
                {node.href !== '#' ? (
                  <code className="font-mono text-[10px]">{node.href}</code>
                ) : (
                  <span className="italic">Container group heading</span>
                )}
                {previewLocale === 'en' && node.labelBn && (
                  <span className="truncate" lang="bn">
                    · BN: {node.labelBn}
                  </span>
                )}
                {node.targetWarning && (
                  <span className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300 font-semibold">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {node.targetWarning}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Row Actions */}
          <div className="flex flex-wrap items-center gap-1 shrink-0">
            {canAddChild && (
              <button
                type="button"
                onClick={() =>
                  openCreateModal(
                    node.id,
                    activeMenu?.location === 'header' && depth === 0 ? 'group' : 'internal_page',
                  )
                }
                className="h-7 px-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-[11px] font-medium inline-flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                {activeMenu?.location === 'header' && depth === 0
                  ? 'Add Group / Link'
                  : 'Add Link'}
              </button>
            )}

            {canEditCms && (
              <>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMoveSibling(siblings, index, -1, parentId)}
                  aria-label="Move item up"
                  className="h-7 w-7 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] inline-flex items-center justify-center disabled:opacity-35"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  disabled={index === siblings.length - 1}
                  onClick={() => handleMoveSibling(siblings, index, 1, parentId)}
                  aria-label="Move item down"
                  className="h-7 w-7 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] inline-flex items-center justify-center disabled:opacity-35"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleToggleVisible(node)}
                  title={node.isVisible ? 'Hide item without deleting' : 'Show item live'}
                  className="h-7 px-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-[11px] inline-flex items-center gap-1"
                >
                  {node.isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {node.isVisible ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(node)}
                  className="h-7 px-2 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-[11px] inline-flex items-center gap-1"
                >
                  <Edit3 className="h-3 w-3" />
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDeleteItem(node)}
                  aria-label={`Delete ${node.labelEn}`}
                  className="h-7 w-7 rounded border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 inline-flex items-center justify-center"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Nested Mega-Menu Groups / Footer Column Links */}
        {node.children.length > 0 && (
          <div className="px-4 pb-3 pl-8 space-y-2 border-t border-[rgb(var(--border-base))]/60 pt-2.5">
            {node.children.map((child, childIdx) =>
              renderNodeRow(child, node.children, childIdx, depth === 0 ? 1 : 2),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary-600 dark:text-primary-300 uppercase tracking-wider mb-1">
            <ListTree className="h-3.5 w-3.5" />
            Website CMS · Site Structure
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
            Navigation Menus
          </h1>
          <p className="text-sm text-[rgb(var(--text-secondary))] mt-0.5">
            Manage Header navigation (including Mega-Menu groups), Footer link columns, drag-and-drop ordering, and EN/BN labels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg p-0.5 bg-[rgb(var(--bg-muted))] border border-[rgb(var(--border-base))]">
            {(['en', 'bn'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setPreviewLocale(loc)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 ${
                  previewLocale === loc
                    ? 'bg-primary-600 text-white'
                    : 'text-[rgb(var(--text-secondary))]'
                }`}
              >
                <Languages className="h-3.5 w-3.5" />
                {loc === 'en' ? 'English Labels' : 'Bengali (বাংলা)'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {canEditCms && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleEnsureDefaults()}
              className="h-9 px-3 rounded-lg border border-primary-600/30 bg-primary-600/10 text-primary-700 dark:text-primary-300 hover:bg-primary-600/20 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ensure Default Menus
            </button>
          )}
        </div>
      </div>

      {flaggedItemsCount > 0 && (
        <div className="px-4 py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>{flaggedItemsCount} menu item(s)</strong> currently link to an unpublished, trashed, or missing page. Highlighted items below should be updated, hidden, or removed.
          </span>
        </div>
      )}

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

      {/* Menu Location Tabs */}
      {loading ? (
        <div className="h-48 rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] flex items-center justify-center text-xs text-[rgb(var(--text-muted))] gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading navigation menus...
        </div>
      ) : menus.length === 0 ? (
        <div className="p-10 rounded-xl border border-dashed border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))] text-center space-y-3">
          <FolderTree className="h-8 w-8 text-[rgb(var(--text-muted))] mx-auto" />
          <p className="text-sm font-semibold">No navigation menus initialized yet</p>
          {canEditCms && (
            <button
              type="button"
              onClick={() => void handleEnsureDefaults()}
              className="h-9 px-4 rounded-lg bg-primary-600 text-white text-xs font-semibold"
            >
              Initialize Default Header &amp; Footer Menus
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap rounded-xl p-1 bg-[rgb(var(--bg-muted))] border border-[rgb(var(--border-base))] gap-1">
              {menus.map((menu) => (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => setSelectedMenuId(menu.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors ${
                    activeMenu?.id === menu.id
                      ? 'bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-sm'
                      : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
                  }`}
                >
                  <Globe2 className="h-3.5 w-3.5 text-primary-600" />
                  <span>{menu.name}</span>
                  <span className="px-1.5 py-0.5 rounded bg-[rgb(var(--bg-muted))] text-[10px] uppercase">
                    {menu.location} · {menu.items.length}
                  </span>
                </button>
              ))}
            </div>

            {activeMenu && canEditCms && (
              <div className="flex items-center gap-2">
                {activeMenu.location === 'footer' ? (
                  <button
                    type="button"
                    onClick={() => openCreateModal(null, 'group')}
                    className="h-9 px-3.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Footer Column
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openCreateModal(null, 'group')}
                      className="h-9 px-3.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <FolderTree className="h-3.5 w-3.5" />
                      Add Mega-Menu Trigger
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreateModal(null, 'internal_page')}
                      className="h-9 px-3.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Menu Link
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {activeMenu && (
            <div className="space-y-2.5">
              {tree.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-[rgb(var(--border-strong))] text-center text-xs text-[rgb(var(--text-muted))]">
                  No items in {activeMenu.name} yet. Click the button above to add top-level items or columns.
                </div>
              ) : (
                tree.map((node, idx) => renderNodeRow(node, tree, idx, 0))
              )}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Menu Item Modal */}
      {modalOpen && activeMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cms-menu-item-modal-title"
        >
          <form
            onSubmit={handleSaveItemModal}
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex items-center justify-between gap-2">
              <h2 id="cms-menu-item-modal-title" className="text-sm font-bold">
                {editingItem ? `Edit Menu Item · ${editingItem.labelEn}` : `Add Item to ${activeMenu.name}`}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-8 w-8 rounded inline-flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Destination Type Selector */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'internal_page', label: 'Internal Page Picker' },
                  { key: 'external', label: 'External / Custom URL' },
                  { key: 'group', label: 'Mega-Menu Group / Column' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setLinkKind(opt.key as typeof linkKind)}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-center ${
                      linkKind === opt.key
                        ? 'border-primary-600 bg-primary-600/10 text-primary-700 dark:text-primary-200'
                        : 'border-[rgb(var(--border-base))] hover:bg-[rgb(var(--bg-hover))]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Internal Page Picker */}
              {linkKind === 'internal_page' && (
                <div className="p-3.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/30 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5 text-primary-600" />
                      Pick an Internal CMS Page
                    </span>
                    <input
                      type="search"
                      value={pageSearch}
                      onChange={(e) => setPageSearch(e.target.value)}
                      placeholder="Filter pages..."
                      className="h-7 px-2.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs w-44"
                    />
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {filteredPickerPages.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePickInternalPage(p)}
                        className={`w-full text-left px-2.5 py-1.5 rounded border flex items-center justify-between gap-2 ${
                          formTargetPageId === p.id
                            ? 'border-primary-600 bg-primary-600/10'
                            : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))]'
                        }`}
                      >
                        <span className="truncate">
                          <strong>{p.titleEn || `/${p.slug}`}</strong>{' '}
                          <code className="text-[10px] text-[rgb(var(--text-muted))]">
                            /{p.slug}
                          </code>
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                            p.status === 'published'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {p.status}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-[rgb(var(--text-muted))]">Quick routes:</span>
                    {STATIC_WEBSITE_ROUTES.map((r) => (
                      <button
                        key={r.href}
                        type="button"
                        onClick={() => {
                          setFormTargetPageId('');
                          setFormHref(r.href);
                          if (!formLabelEn.trim()) setFormLabelEn(r.labelEn);
                          if (!formLabelBn.trim()) setFormLabelBn(r.labelBn);
                        }}
                        className="px-2 py-0.5 rounded border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[10px] hover:bg-[rgb(var(--bg-hover))]"
                      >
                        {r.labelEn} ({r.href})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {linkKind !== 'group' && (
                <div>
                  <label className="block font-medium mb-1">
                    Target URL / Path <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formHref}
                    onChange={(e) => setFormHref(e.target.value)}
                    placeholder={
                      linkKind === 'external' ? 'https://docs.example.com' : '/features/payroll'
                    }
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-mono"
                  />
                </div>
              )}

              {/* Per-Locale Labels & Descriptions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Label (English) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formLabelEn}
                    onChange={(e) => setFormLabelEn(e.target.value)}
                    placeholder="e.g., Payroll Automation"
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Label (বাংলা)</label>
                  <input
                    type="text"
                    lang="bn"
                    value={formLabelBn}
                    onChange={(e) => setFormLabelBn(e.target.value)}
                    placeholder="যেমন: পেরোল অটোমেশন"
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Mega-Menu Description (EN)</label>
                  <input
                    type="text"
                    value={formDescEn}
                    onChange={(e) => setFormDescEn(e.target.value)}
                    placeholder="Short subtitle shown under mega-menu item"
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Mega-Menu Description (বাংলা)</label>
                  <input
                    type="text"
                    lang="bn"
                    value={formDescBn}
                    onChange={(e) => setFormDescBn(e.target.value)}
                    placeholder="সংক্ষিপ্ত বিবরণ"
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Badge (EN, optional)</label>
                  <input
                    type="text"
                    value={formBadgeEn}
                    onChange={(e) => setFormBadgeEn(e.target.value)}
                    placeholder="New"
                    className="w-full h-8 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Badge (BN, optional)</label>
                  <input
                    type="text"
                    lang="bn"
                    value={formBadgeBn}
                    onChange={(e) => setFormBadgeBn(e.target.value)}
                    placeholder="নতুন"
                    className="w-full h-8 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  />
                </div>
              </div>

              {/* Visibility & New Tab toggles */}
              <div className="flex flex-wrap items-center gap-6 pt-1">
                {linkKind !== 'group' && (
                  <label className="flex items-center gap-2 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formOpenInNewTab}
                      onChange={(e) => setFormOpenInNewTab(e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    Open link in new tab
                  </label>
                )}

                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsVisible}
                    onChange={(e) => setFormIsVisible(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  Visible on public site (uncheck to hide without deleting)
                </label>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-9 px-4 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="h-9 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {busy ? 'Saving...' : editingItem ? 'Save Changes' : 'Add to Menu'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
