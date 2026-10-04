import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarClock,
  Copy,
  Info,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  User,
} from 'lucide-react';
import {
  ASSET_CATEGORY_LABELS,
  ONBOARDING_TASK_CATEGORIES,
  ONBOARDING_TASK_CATEGORY_LABELS,
  ONBOARDING_TASK_TYPES,
  ONBOARDING_TASK_TYPE_LABELS,
  onboardingTaskTypeNeedsDocumentType,
  type AssetCategory,
  type DocumentTypeRecord,
  type OnboardingChecklistTemplateItemRecord,
  type OnboardingChecklistTemplateRecord,
  type OnboardingTaskCategory,
  type OnboardingTaskType,
} from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { CompanySelector } from '@/components/org/CompanySelector';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { listDocumentTypes } from '@/lib/documents-api';
import {
  addOnboardingTemplateItem,
  createOnboardingTemplate,
  deleteOnboardingTemplate,
  deleteOnboardingTemplateItem,
  duplicateOnboardingTemplate,
  getOnboardingTemplate,
  listOnboardingTemplates,
  reorderOnboardingTemplateItems,
  updateOnboardingTemplate,
  updateOnboardingTemplateItem,
  type OnboardingTemplateItemInput,
} from '@/lib/onboarding-api';
import {
  ASSIGNEE_SUGGESTIONS,
  DEFAULT_TASK_TYPE_FOR_CATEGORY,
  ONBOARDING_CATEGORY_ICONS,
  ONBOARDING_TASK_TYPE_HELP,
  dueOffsetLabel,
} from '@/lib/onboarding-display';
import { ApiError } from '@/lib/tenant-api-client';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

interface TemplateForm {
  name: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
}

interface ItemForm {
  title: string;
  description: string;
  category: OnboardingTaskCategory;
  taskType: OnboardingTaskType;
  documentTypeId: string;
  assetCategory: AssetCategory | '';
  policyDocumentUrl: string;
  assigneeLabel: string;
  dueDaysOffset: string;
  isRequired: boolean;
}

const EMPTY_ITEM: ItemForm = {
  title: '',
  description: '',
  category: 'document_collection',
  taskType: 'document_collection',
  documentTypeId: '',
  assetCategory: '',
  policyDocumentUrl: '',
  assigneeLabel: 'HR',
  dueDaysOffset: '0',
  isRequired: true,
};

function itemToForm(item: OnboardingChecklistTemplateItemRecord): ItemForm {
  return {
    title: item.title,
    description: item.description ?? '',
    category: item.category,
    taskType: item.taskType,
    documentTypeId: item.documentTypeId ?? '',
    assetCategory: item.assetCategory ?? '',
    policyDocumentUrl: item.policyDocumentUrl ?? '',
    assigneeLabel: item.assigneeLabel ?? '',
    dueDaysOffset: item.dueDaysOffset == null ? '' : String(item.dueDaysOffset),
    isRequired: item.isRequired,
  };
}

function validateItem(form: ItemForm): Partial<Record<keyof ItemForm, string>> {
  const errors: Partial<Record<keyof ItemForm, string>> = {};
  if (!form.title.trim()) errors.title = 'Give the item a title';
  if (onboardingTaskTypeNeedsDocumentType(form.taskType) && !form.documentTypeId) {
    errors.documentTypeId = 'Choose the document to collect';
  }
  if (form.dueDaysOffset.trim()) {
    const n = Number(form.dueDaysOffset);
    if (!Number.isInteger(n) || n < 0 || n > 365) {
      errors.dueDaysOffset = 'Use a whole number of days between 0 and 365';
    }
  }
  return errors;
}

function formToItemInput(form: ItemForm): OnboardingTemplateItemInput {
  const needsDoc = onboardingTaskTypeNeedsDocumentType(form.taskType);
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    category: form.category,
    taskType: form.taskType,
    documentTypeId: needsDoc ? form.documentTypeId || null : null,
    assetCategory: form.taskType === 'provisioning' ? form.assetCategory || null : null,
    policyDocumentUrl:
      form.taskType === 'policy_acceptance' ? form.policyDocumentUrl.trim() || null : null,
    assigneeLabel: form.assigneeLabel.trim() || null,
    dueDaysOffset: form.dueDaysOffset.trim() ? Number(form.dueDaysOffset) : null,
    isRequired: form.isRequired,
  };
}

export function OnboardingTemplatesPage() {
  const { companyId } = useCompany();
  const { navigate } = useNav();
  const canEdit = usePermission('employee', 'edit');

  const [templates, setTemplates] = useState<OnboardingChecklistTemplateRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OnboardingChecklistTemplateRecord | null>(null);
  const [docTypes, setDocTypes] = useState<DocumentTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [templateModal, setTemplateModal] = useState<'create' | 'edit' | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateForm>({
    name: '',
    description: '',
    isDefault: false,
    isActive: true,
  });
  const [templateFormError, setTemplateFormError] = useState<string | null>(null);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OnboardingChecklistTemplateItemRecord | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_ITEM);
  const [itemErrors, setItemErrors] = useState<Partial<Record<keyof ItemForm, string>>>({});
  const [itemSaveError, setItemSaveError] = useState<string | null>(null);

  const [deleteTemplateOpen, setDeleteTemplateOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<OnboardingChecklistTemplateItemRecord | null>(null);

  const loadTemplates = useCallback(
    async (preferId?: string) => {
      if (!companyId) return;
      setLoading(true);
      setError(null);
      try {
        const [rows, types] = await Promise.all([
          listOnboardingTemplates(companyId),
          listDocumentTypes(companyId),
        ]);
        setTemplates(rows);
        setDocTypes(types.filter((t) => t.isActive && t.scope === 'employee'));
        setSelectedId((prev) => {
          const want = preferId ?? prev;
          if (want && rows.some((row) => row.id === want)) return want;
          return rows[0]?.id ?? null;
        });
      } catch (err) {
        setError(errorMessage(err, 'Failed to load checklist templates'));
      } finally {
        setLoading(false);
      }
    },
    [companyId],
  );

  const loadDetail = useCallback(async (templateId: string) => {
    setDetailLoading(true);
    try {
      setDetail(await getOnboardingTemplate(templateId));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load template'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const refreshAll = async (preferId?: string) => {
    await loadTemplates(preferId);
    const id = preferId ?? selectedId;
    if (id) await loadDetail(id);
  };

  const items = useMemo(() => detail?.items ?? [], [detail?.items]);
  const stats = useMemo(
    () => ({
      required: items.filter((i) => i.isRequired).length,
      documents: items.filter((i) => i.documentTypeId).length,
      verification: items.filter((i) => i.documentRequiresVerification).length,
    }),
    [items],
  );

  const openCreateTemplate = () => {
    setTemplateForm({ name: '', description: '', isDefault: templates.length === 0, isActive: true });
    setTemplateFormError(null);
    setTemplateModal('create');
  };

  const openEditTemplate = () => {
    if (!detail) return;
    setTemplateForm({
      name: detail.name,
      description: detail.description ?? '',
      isDefault: detail.isDefault,
      isActive: detail.isActive,
    });
    setTemplateFormError(null);
    setTemplateModal('edit');
  };

  const saveTemplate = async () => {
    if (!companyId) return;
    if (!templateForm.name.trim()) {
      setTemplateFormError('Give the template a name');
      return;
    }
    setBusy(true);
    setTemplateFormError(null);
    try {
      const payload = {
        name: templateForm.name.trim(),
        description: templateForm.description.trim() || undefined,
        isDefault: templateForm.isActive && templateForm.isDefault,
        isActive: templateForm.isActive,
      };
      const saved =
        templateModal === 'create'
          ? await createOnboardingTemplate(companyId, payload)
          : await updateOnboardingTemplate(detail!.id, {
              ...payload,
              description: templateForm.description.trim() || null,
            });
      setTemplateModal(null);
      await refreshAll(saved.id);
    } catch (err) {
      setTemplateFormError(errorMessage(err, 'Failed to save template'));
    } finally {
      setBusy(false);
    }
  };

  const runTemplateAction = async (action: () => Promise<OnboardingChecklistTemplateRecord>) => {
    setBusy(true);
    setError(null);
    try {
      const saved = await action();
      await refreshAll(saved.id);
    } catch (err) {
      setError(errorMessage(err, 'Action failed'));
    } finally {
      setBusy(false);
    }
  };

  const openAddItem = () => {
    setEditingItem(null);
    setItemForm(EMPTY_ITEM);
    setItemErrors({});
    setItemSaveError(null);
    setItemModalOpen(true);
  };

  const openEditItem = (item: OnboardingChecklistTemplateItemRecord) => {
    setEditingItem(item);
    setItemForm(itemToForm(item));
    setItemErrors({});
    setItemSaveError(null);
    setItemModalOpen(true);
  };

  const changeCategory = (category: OnboardingTaskCategory) => {
    setItemForm((prev) => ({
      ...prev,
      category,
      taskType:
        prev.taskType === DEFAULT_TASK_TYPE_FOR_CATEGORY[prev.category]
          ? DEFAULT_TASK_TYPE_FOR_CATEGORY[category]
          : prev.taskType,
    }));
  };

  const saveItem = async () => {
    if (!detail) return;
    const errors = validateItem(itemForm);
    setItemErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    setItemSaveError(null);
    try {
      const input = formToItemInput(itemForm);
      if (editingItem) await updateOnboardingTemplateItem(editingItem.id, input);
      else await addOnboardingTemplateItem(detail.id, input);
      setItemModalOpen(false);
      await refreshAll(detail.id);
    } catch (err) {
      setItemSaveError(errorMessage(err, 'Failed to save item'));
    } finally {
      setBusy(false);
    }
  };

  const moveItem = async (index: number, delta: -1 | 1) => {
    if (!detail) return;
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((i) => i.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const reordered = ids.map((id) => items.find((i) => i.id === id)!);
    setDetail({ ...detail, items: reordered });
    try {
      setDetail(await reorderOnboardingTemplateItems(detail.id, ids));
    } catch (err) {
      setError(errorMessage(err, 'Failed to reorder items'));
      await loadDetail(detail.id);
    }
  };

  const selectedDocType = docTypes.find((t) => t.id === itemForm.documentTypeId);

  if (!companyId) {
    return (
      <div className="p-4 lg:p-6">
        <CompanySelector />
        <div className="mt-6 rounded-xl border border-dashed border-strong px-6 py-12 text-center text-sm text-secondary">
          Select a company to configure onboarding checklists.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1300px] mx-auto">
      <button
        type="button"
        onClick={() => navigate('onboarding')}
        className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to onboarding
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-primary">Onboarding Checklist Templates</h1>
          <p className="text-sm text-secondary mt-0.5 max-w-2xl">
            Configure the checklist new employees work through. The default template is
            applied automatically when a candidate is converted to an employee.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          {canEdit ? (
            <Button onClick={openCreateTemplate}>
              <Plus className="h-4 w-4" /> New template
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
        </div>
      ) : null}

      {loading && templates.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-secondary">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading templates…
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={ListChecks}
              title="No checklist templates yet"
              description="Create a template with the documents, policies, equipment and access every new hire needs."
              action={
                canEdit
                  ? { label: 'New template', onClick: openCreateTemplate, icon: Plus }
                  : undefined
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
          <Card>
            <CardHeader>
              <CardTitle>Templates</CardTitle>
            </CardHeader>
            <CardBody className="p-2">
              <ul className="space-y-1">
                {templates.map((template) => {
                  const active = template.id === selectedId;
                  return (
                    <li key={template.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(template.id)}
                        className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                          active
                            ? 'bg-accent-50 dark:bg-accent-950/40 ring-1 ring-accent-200 dark:ring-accent-800'
                            : 'hover:bg-[rgb(var(--bg-hover))]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium truncate ${
                              template.isActive ? 'text-primary' : 'text-muted'
                            }`}
                          >
                            {template.name}
                          </span>
                          {template.isDefault ? (
                            <Badge tone="accent" className="shrink-0">
                              Default
                            </Badge>
                          ) : null}
                          {!template.isActive ? (
                            <Badge tone="neutral" className="shrink-0">
                              Inactive
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          {template.itemCount} item{template.itemCount === 1 ? '' : 's'}
                          {' · '}
                          used by {template.onboardingCount}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>

          {detail ? (
            <div className="space-y-4">
              <Card>
                <CardBody className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-semibold text-primary">{detail.name}</h2>
                        {detail.isDefault ? (
                          <Badge tone="accent" dot>
                            Default for new hires
                          </Badge>
                        ) : null}
                        <Badge tone={detail.isActive ? 'success' : 'neutral'} dot>
                          {detail.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-secondary mt-1">
                        {detail.description || 'No description'}
                      </p>
                    </div>
                    {canEdit ? (
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {!detail.isDefault && detail.isActive ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void runTemplateAction(() =>
                                updateOnboardingTemplate(detail.id, { isDefault: true }),
                              )
                            }
                          >
                            <Star className="h-3.5 w-3.5" /> Make default
                          </Button>
                        ) : null}
                        <Button variant="secondary" size="sm" onClick={openEditTemplate}>
                          <Pencil className="h-3.5 w-3.5" /> Edit details
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void runTemplateAction(() => duplicateOnboardingTemplate(detail.id))
                          }
                        >
                          <Copy className="h-3.5 w-3.5" /> Duplicate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={detail.onboardingCount > 0}
                          title={
                            detail.onboardingCount > 0
                              ? 'In use by onboardings — deactivate it instead'
                              : 'Delete template'
                          }
                          onClick={() => setDeleteTemplateOpen(true)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Checklist items', value: items.length },
                      { label: 'Required', value: stats.required },
                      { label: 'Documents collected', value: stats.documents },
                      { label: 'Need verification', value: stats.verification },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg border border-base px-3 py-2 bg-[rgb(var(--bg-muted))]/40"
                      >
                        <div className="text-lg font-semibold text-primary">{stat.value}</div>
                        <div className="text-xs text-muted">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2 text-xs text-secondary">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Changes apply to onboardings started afterwards. Employees already
                      onboarding keep the checklist they started with
                      {detail.onboardingCount > 0
                        ? ` (${detail.onboardingCount} so far).`
                        : '.'}
                    </span>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>Checklist items</CardTitle>
                  {canEdit ? (
                    <Button size="sm" onClick={openAddItem}>
                      <Plus className="h-3.5 w-3.5" /> Add item
                    </Button>
                  ) : null}
                </CardHeader>
                <CardBody className="p-0">
                  {detailLoading && items.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-secondary text-sm">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading items…
                    </div>
                  ) : items.length === 0 ? (
                    <EmptyState
                      compact
                      icon={ListChecks}
                      title="No items in this checklist"
                      description="Add the documents to collect, policies to accept, and equipment or access to provision."
                      action={
                        canEdit ? { label: 'Add item', onClick: openAddItem, icon: Plus } : undefined
                      }
                    />
                  ) : (
                    <ol className="divide-y divide-[rgb(var(--border-base))]">
                      {items.map((item, index) => {
                        const Icon = ONBOARDING_CATEGORY_ICONS[item.category];
                        return (
                          <li key={item.id} className="flex items-start gap-3 px-5 py-3.5">
                            {canEdit ? (
                              <div className="flex flex-col shrink-0 -my-1">
                                <button
                                  type="button"
                                  aria-label="Move up"
                                  disabled={index === 0}
                                  onClick={() => void moveItem(index, -1)}
                                  className="p-0.5 text-muted hover:text-primary disabled:opacity-30"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Move down"
                                  disabled={index === items.length - 1}
                                  onClick={() => void moveItem(index, 1)}
                                  className="p-0.5 text-muted hover:text-primary disabled:opacity-30"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : null}
                            <div className="h-8 w-8 rounded-lg bg-[rgb(var(--bg-muted))] text-secondary flex items-center justify-center shrink-0">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-primary">
                                  {index + 1}. {item.title}
                                </span>
                                {!item.isRequired ? <Badge tone="neutral">Optional</Badge> : null}
                              </div>
                              {item.description ? (
                                <p className="text-xs text-secondary mt-0.5">{item.description}</p>
                              ) : null}
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <Badge tone="info">{ONBOARDING_TASK_TYPE_LABELS[item.taskType]}</Badge>
                                <Badge tone="neutral">
                                  {ONBOARDING_TASK_CATEGORY_LABELS[item.category]}
                                </Badge>
                                {item.documentTypeName ? (
                                  <Badge tone="neutral">{item.documentTypeName}</Badge>
                                ) : null}
                                {item.documentRequiresVerification ? (
                                  <Badge tone="warning">
                                    <ShieldCheck className="h-3 w-3" /> Verification required
                                  </Badge>
                                ) : null}
                                {item.assetCategory ? (
                                  <Badge tone="neutral">
                                    Asset: {ASSET_CATEGORY_LABELS[item.assetCategory]}
                                  </Badge>
                                ) : null}
                                <span className="inline-flex items-center gap-1 text-xs text-muted ml-1">
                                  <User className="h-3 w-3" /> {item.assigneeLabel ?? 'Unassigned'}
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs text-muted ml-1">
                                  <CalendarClock className="h-3 w-3" />
                                  {dueOffsetLabel(item.dueDaysOffset)}
                                </span>
                              </div>
                            </div>
                            {canEdit ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label="Edit item"
                                  onClick={() => openEditItem(item)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label="Delete item"
                                  onClick={() => setDeleteItem(item)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </CardBody>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center py-16 text-secondary">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading template…
            </div>
          )}
        </div>
      )}

      <Modal
        open={templateModal !== null}
        onClose={() => setTemplateModal(null)}
        title={templateModal === 'create' ? 'New checklist template' : 'Edit template'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTemplateModal(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void saveTemplate()} disabled={busy}>
              {busy ? 'Saving…' : templateModal === 'create' ? 'Create template' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {templateFormError ? (
            <div className="text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
              {templateFormError}
            </div>
          ) : null}
          <div>
            <Label>Name *</Label>
            <Input
              value={templateForm.name}
              maxLength={120}
              placeholder="e.g. Engineering new hire"
              onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={templateForm.description}
              maxLength={1000}
              placeholder="Who this checklist is for"
              onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
            />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-primary">Active</div>
              <p className="text-xs text-muted">
                Inactive templates cannot be used for new onboardings.
              </p>
            </div>
            <Toggle
              checked={templateForm.isActive}
              label="Active"
              onChange={(isActive) =>
                setTemplateForm({
                  ...templateForm,
                  isActive,
                  isDefault: isActive ? templateForm.isDefault : false,
                })
              }
            />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-primary">Default for new hires</div>
              <p className="text-xs text-muted">
                Used automatically when a candidate is converted to an employee. Only one
                template can be the default.
              </p>
            </div>
            <Toggle
              checked={templateForm.isDefault}
              label="Default for new hires"
              disabled={!templateForm.isActive}
              onChange={(isDefault) => setTemplateForm({ ...templateForm, isDefault })}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title={editingItem ? 'Edit checklist item' : 'Add checklist item'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setItemModalOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void saveItem()} disabled={busy}>
              {busy ? 'Saving…' : editingItem ? 'Save item' : 'Add item'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {itemSaveError ? (
            <div className="text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
              {itemSaveError}
            </div>
          ) : null}
          <div>
            <Label>Title *</Label>
            <Input
              value={itemForm.title}
              maxLength={200}
              placeholder="e.g. Collect passport copy"
              onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
            />
            <FieldError message={itemErrors.title} />
          </div>
          <div>
            <Label>Instructions</Label>
            <Textarea
              rows={2}
              value={itemForm.description}
              maxLength={1000}
              placeholder="What needs to happen, shown on the employee’s tracker"
              onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Section</Label>
              <Select
                value={itemForm.category}
                onChange={(e) => changeCategory(e.target.value as OnboardingTaskCategory)}
              >
                {ONBOARDING_TASK_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {ONBOARDING_TASK_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>How it is completed</Label>
              <Select
                value={itemForm.taskType}
                onChange={(e) =>
                  setItemForm({ ...itemForm, taskType: e.target.value as OnboardingTaskType })
                }
              >
                {ONBOARDING_TASK_TYPES.map((taskType) => (
                  <option key={taskType} value={taskType}>
                    {ONBOARDING_TASK_TYPE_LABELS[taskType]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-xs text-secondary -mt-2 flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {ONBOARDING_TASK_TYPE_HELP[itemForm.taskType]}
          </p>

          {onboardingTaskTypeNeedsDocumentType(itemForm.taskType) ? (
            <div>
              <Label>Document type *</Label>
              <Select
                value={itemForm.documentTypeId}
                onChange={(e) => setItemForm({ ...itemForm, documentTypeId: e.target.value })}
              >
                <option value="">Select a document type…</option>
                {docTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                    {type.requiresVerification ? ' (verification required)' : ''}
                  </option>
                ))}
              </Select>
              <FieldError message={itemErrors.documentTypeId} />
              {selectedDocType?.requiresVerification ? (
                <p className="text-xs text-muted mt-1">
                  HR must verify the uploaded {selectedDocType.name} before this item is done.
                </p>
              ) : null}
              {docTypes.length === 0 ? (
                <p className="text-xs text-muted mt-1">
                  No employee document types yet.{' '}
                  <button
                    type="button"
                    className="text-accent-600 hover:underline"
                    onClick={() => navigate('doc-types')}
                  >
                    Create one in Document Types
                  </button>
                  .
                </p>
              ) : null}
            </div>
          ) : null}

          {itemForm.taskType === 'policy_acceptance' ? (
            <div>
              <Label>Policy link</Label>
              <Input
                value={itemForm.policyDocumentUrl}
                maxLength={2000}
                placeholder="https://intranet.example.com/handbook.pdf"
                onChange={(e) => setItemForm({ ...itemForm, policyDocumentUrl: e.target.value })}
              />
            </div>
          ) : null}

          {itemForm.taskType === 'provisioning' ? (
            <div>
              <Label>Asset category</Label>
              <Select
                value={itemForm.assetCategory}
                onChange={(e) =>
                  setItemForm({ ...itemForm, assetCategory: e.target.value as AssetCategory | '' })
                }
              >
                <option value="">None — mark done by hand</option>
                {(Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[]).map((category) => (
                  <option key={category} value={category}>
                    {ASSET_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Owner</Label>
              <Input
                value={itemForm.assigneeLabel}
                list="onboarding-assignee-suggestions"
                maxLength={120}
                placeholder="e.g. HR, IT, Manager"
                onChange={(e) => setItemForm({ ...itemForm, assigneeLabel: e.target.value })}
              />
              <datalist id="onboarding-assignee-suggestions">
                {ASSIGNEE_SUGGESTIONS.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>Due (days after start date)</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={itemForm.dueDaysOffset}
                placeholder="Leave empty for no due date"
                onChange={(e) => setItemForm({ ...itemForm, dueDaysOffset: e.target.value })}
              />
              <FieldError message={itemErrors.dueDaysOffset} />
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-primary">Required</div>
              <p className="text-xs text-muted">
                Onboarding completes once every required item is done or skipped.
              </p>
            </div>
            <Toggle
              checked={itemForm.isRequired}
              label="Required"
              onChange={(isRequired) => setItemForm({ ...itemForm, isRequired })}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTemplateOpen}
        title="Delete template"
        description={
          detail
            ? `Delete "${detail.name}" and its ${items.length} item${items.length === 1 ? '' : 's'}? This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete template"
        onConfirm={async () => {
          if (!detail) return;
          await deleteOnboardingTemplate(detail.id);
          setSelectedId(null);
          await loadTemplates();
        }}
        onClose={() => setDeleteTemplateOpen(false)}
      />

      <ConfirmDialog
        open={deleteItem !== null}
        title="Remove checklist item"
        description={
          deleteItem
            ? `Remove "${deleteItem.title}" from this template? Onboardings already started keep it.`
            : undefined
        }
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!deleteItem || !detail) return;
          await deleteOnboardingTemplateItem(deleteItem.id);
          await refreshAll(detail.id);
        }}
        onClose={() => setDeleteItem(null)}
      />
    </div>
  );
}
