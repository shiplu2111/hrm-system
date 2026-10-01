import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Folder,
  FolderOpen,
  FolderTree,
  Layers,
  Plus,
  Users,
} from 'lucide-react';
import type { DepartmentTreeNode } from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Select } from '@/components/ui/Form';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DropdownItem } from '@/components/ui/Dropdown';
import { OrgPageState } from '@/components/org/OrgPageState';
import {
  OrgErrorBanner,
  OrgFormModal,
  OrgPageHeader,
  OrgRowActions,
  OrgSearchInput,
  OrgTableSkeleton,
} from '@/components/org/OrgScreenParts';
import { useOrgForm } from '@/hooks/useOrgForm';
import {
  collectIds,
  filterDepartmentTree,
  flattenDepartments,
  maxDepth,
  sortDepartmentTree,
  subtreeEmployeeCount,
  subtreeIds,
  type FlatDepartment,
} from '@/lib/department-tree';
import { validateOrgName } from '@/lib/org-validation';
import {
  createDepartment,
  deleteDepartment,
  getDepartmentTree,
  listDesignations,
  updateDepartment,
} from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

type DeptForm = { name: string; parentDepartmentId: string };

interface RowProps {
  node: DepartmentTreeNode;
  depth: number;
  expanded: (id: string) => boolean;
  onToggle: (id: string) => void;
  query: string;
  designationCounts: Map<string, number>;
  canCreate: boolean;
  onAddChild: (parent: DepartmentTreeNode) => void;
  onEdit: (node: DepartmentTreeNode) => void;
  onDelete: (node: DepartmentTreeNode) => void;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const index = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-warning-100 dark:bg-warning-900/50 text-inherit rounded px-0.5">
        {text.slice(index, index + q.length)}
      </mark>
      {text.slice(index + q.length)}
    </>
  );
}

function deleteBlockedReason(node: DepartmentTreeNode, designations: number): string | null {
  if (node.children.length > 0) return 'Move or delete its sub-departments first';
  if (node.employeeCount > 0) return `${node.employeeCount} employee(s) still assigned`;
  if (designations > 0) return `${designations} designation(s) belong to it`;
  return null;
}

function DepartmentRow(props: RowProps) {
  const { node, depth, expanded, onToggle, query, designationCounts, canCreate } = props;
  const hasChildren = node.children.length > 0;
  const isOpen = hasChildren && expanded(node.id);
  const total = subtreeEmployeeCount(node);
  const designations = designationCounts.get(node.id) ?? 0;
  const FolderIcon = isOpen ? FolderOpen : Folder;

  return (
    <li role="treeitem" aria-level={depth + 1} aria-expanded={hasChildren ? isOpen : undefined}>
      <div
        className="group flex items-center gap-2 pr-3 py-2 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.name}`}
            className="text-muted hover:text-primary shrink-0 rounded p-0.5"
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <FolderIcon
          className={`h-4 w-4 shrink-0 ${hasChildren ? 'text-accent-500' : 'text-muted'}`}
        />
        <span className="text-sm font-medium text-primary truncate">
          <Highlight text={node.name} query={query} />
        </span>
        {hasChildren ? (
          <span className="text-[11px] text-muted shrink-0">
            {node.children.length} sub-dept{node.children.length === 1 ? '' : 's'}
          </span>
        ) : null}
        <span className="flex-1" />
        <span
          className="text-xs text-secondary hidden sm:flex items-center gap-1 shrink-0 tabular-nums"
          title={
            hasChildren
              ? `${node.employeeCount} directly, ${total} including sub-departments`
              : `${node.employeeCount} employees`
          }
        >
          <Users className="h-3.5 w-3.5 text-muted" />
          {node.employeeCount}
          {hasChildren && total !== node.employeeCount ? (
            <span className="text-muted">/ {total}</span>
          ) : null}
        </span>
        <OrgRowActions
          label={node.name}
          onEdit={() => props.onEdit(node)}
          onDelete={() => props.onDelete(node)}
          deleteBlockedReason={deleteBlockedReason(node, designations)}
          extra={
            canCreate ? (
              <DropdownItem icon={<Plus className="h-4 w-4" />} onClick={() => props.onAddChild(node)}>
                Add sub-department
              </DropdownItem>
            ) : undefined
          }
        />
      </div>
      {isOpen ? (
        <ul role="group" className="relative">
          <span
            aria-hidden
            className="absolute top-0 bottom-2 border-l border-base"
            style={{ left: `${depth * 24 + 18}px` }}
          />
          {node.children.map((child) => (
            <DepartmentRow key={child.id} {...props} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3 py-3">
        <div className="h-9 w-9 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-lg font-semibold text-primary tabular-nums">{value}</div>
          <div className="text-xs text-secondary">{label}</div>
        </div>
      </CardBody>
    </Card>
  );
}

function DepartmentsContent({ companyId }: { companyId: string }) {
  const canCreate = usePermission('settings', 'create');
  const [tree, setTree] = useState<DepartmentTreeNode[]>([]);
  const [designationCounts, setDesignationCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentTreeNode | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<FlatDepartment | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [nodes, designations] = await Promise.all([
        getDepartmentTree(companyId),
        listDesignations(companyId),
      ]);
      setTree(sortDepartmentTree(nodes));
      const counts = new Map<string, number>();
      for (const d of designations) {
        if (d.departmentId) counts.set(d.departmentId, (counts.get(d.departmentId) ?? 0) + 1);
      }
      setDesignationCounts(counts);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const flat = useMemo(() => flattenDepartments(tree), [tree]);
  const byId = useMemo(() => new Map(flat.map((f) => [f.node.id, f])), [flat]);
  const filtered = useMemo(() => filterDepartmentTree(tree, query), [tree, query]);

  const isExpanded = useCallback(
    (id: string) => filtered.expandIds.has(id) || !collapsed.has(id),
    [filtered.expandIds, collapsed],
  );
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalEmployees = useMemo(
    () => tree.reduce((sum, n) => sum + subtreeEmployeeCount(n), 0),
    [tree],
  );

  const validate = useCallback(
    (values: DeptForm) => {
      const siblings = flat
        .filter((f) => (f.node.parentDepartmentId ?? '') === values.parentDepartmentId)
        .map((f) => f.node);
      const parent = byId.get(values.parentDepartmentId);
      return {
        name: validateOrgName(
          values.name,
          'Department name',
          siblings,
          editing?.id,
          parent ? `under ${parent.node.name}` : 'at the top level',
        ),
      };
    },
    [flat, byId, editing],
  );
  const form = useOrgForm<DeptForm>({ name: '', parentDepartmentId: '' }, validate);

  /** When editing, the department and its descendants can't become its parent. */
  const parentOptions = useMemo(() => {
    const excluded = editing ? subtreeIds(editing) : new Set<string>();
    return flat.filter((f) => !excluded.has(f.node.id));
  }, [flat, editing]);

  const openCreate = (parent?: DepartmentTreeNode) => {
    setEditing(null);
    setSaveError(null);
    form.reset({ name: '', parentDepartmentId: parent?.id ?? '' });
    setModalOpen(true);
  };

  const openEdit = (node: DepartmentTreeNode) => {
    setEditing(node);
    setSaveError(null);
    form.reset({ name: node.name, parentDepartmentId: node.parentDepartmentId ?? '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    form.touchAll();
    if (!form.isValid) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      name: form.values.name.trim(),
      parentDepartmentId: form.values.parentDepartmentId || null,
    };
    try {
      if (editing) await updateDepartment(companyId, editing.id, payload);
      else await createDepartment(companyId, payload);
      if (payload.parentDepartmentId) {
        const parentId = payload.parentDepartmentId;
        setCollapsed((prev) => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save the department');
    } finally {
      setSaving(false);
    }
  };

  const selectedParentPath = byId.get(form.values.parentDepartmentId)?.path ?? [];
  const previewPath = [...selectedParentPath, form.values.name.trim() || 'New department'];
  const movingFrom =
    editing && (editing.parentDepartmentId ?? '') !== form.values.parentDepartmentId
      ? byId.get(editing.parentDepartmentId ?? '')?.path.join(' › ') ?? 'Top level'
      : null;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
      <OrgPageHeader
        title="Departments"
        description="Nest departments as deep as your organization needs. Each department can have one parent."
        actionLabel="Add department"
        onAction={() => openCreate()}
      />

      {loadError ? <OrgErrorBanner message={loadError} onRetry={() => void load()} /> : null}

      {!loading && tree.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={Building2} label="Departments" value={flat.length} />
          <StatTile icon={FolderTree} label="Top-level" value={tree.length} />
          <StatTile icon={Layers} label="Levels deep" value={maxDepth(tree)} />
          <StatTile icon={Users} label="Employees assigned" value={totalEmployees} />
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <OrgSearchInput value={query} onChange={setQuery} placeholder="Search departments" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())} disabled={tree.length === 0}>
              <ChevronsUpDown className="h-4 w-4" /> Expand all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(new Set(collectIds(tree)))}
              disabled={tree.length === 0}
            >
              <ChevronsDownUp className="h-4 w-4" /> Collapse all
            </Button>
          </div>
        </CardHeader>
        <CardBody className="p-2">
          {loading ? (
            <OrgTableSkeleton columns={2} rows={6} />
          ) : tree.length === 0 ? (
            <EmptyState
              compact
              icon={FolderTree}
              title="No departments yet"
              description="Start with your top-level departments, then add sub-departments beneath them."
              action={canCreate ? { label: 'Add first department', onClick: () => openCreate(), icon: Plus } : undefined}
            />
          ) : filtered.nodes.length === 0 ? (
            <p className="text-sm text-muted text-center py-10">No departments match “{query}”.</p>
          ) : (
            <>
              <div className="hidden sm:flex items-center justify-between px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                <span>Department</span>
                <span className="pr-8">Employees (direct / total)</span>
              </div>
              <ul role="tree" aria-label="Department hierarchy" className="space-y-0.5">
                {filtered.nodes.map((node) => (
                  <DepartmentRow
                    key={node.id}
                    node={node}
                    depth={0}
                    expanded={isExpanded}
                    onToggle={toggle}
                    query={query}
                    designationCounts={designationCounts}
                    canCreate={canCreate}
                    onAddChild={openCreate}
                    onEdit={openEdit}
                    onDelete={(n) => setDeleting(byId.get(n.id) ?? null)}
                  />
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </Card>

      <OrgFormModal
        open={modalOpen}
        title={editing ? 'Edit department' : 'Add department'}
        submitLabel={editing ? 'Save changes' : 'Create department'}
        saving={saving}
        error={saveError}
        onClose={() => setModalOpen(false)}
        onSubmit={() => void handleSave()}
      >
        <div>
          <Label htmlFor="dept-name">Department name *</Label>
          <Input
            id="dept-name"
            autoFocus
            value={form.values.name}
            onChange={(e) => form.setField('name', e.target.value)}
            onBlur={() => form.touch('name')}
            aria-invalid={Boolean(form.showError('name'))}
            placeholder="e.g. Research & Development"
          />
          <FieldError message={form.showError('name')} />
        </div>
        <div>
          <Label htmlFor="dept-parent">Parent department</Label>
          <Select
            id="dept-parent"
            value={form.values.parentDepartmentId}
            onChange={(e) => form.setField('parentDepartmentId', e.target.value)}
          >
            <option value="">None — top level</option>
            {parentOptions.map((f) => (
              <option key={f.node.id} value={f.node.id}>
                {`${'\u00A0\u00A0\u00A0'.repeat(f.depth)}${f.depth > 0 ? '└ ' : ''}${f.node.name}`}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">
            {editing && editing.children.length > 0
              ? `Its ${editing.children.length} sub-department(s) move with it. It can't be placed under itself or its own sub-departments.`
              : 'Leave as top level for a root department.'}
          </p>
        </div>
        <div className="rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2.5 text-xs">
          <div className="text-muted mb-0.5">{movingFrom ? 'New position' : 'Position'}</div>
          <div className="text-primary font-medium break-words">{previewPath.join(' › ')}</div>
          {movingFrom ? <div className="text-muted mt-1">Moving from: {movingFrom}</div> : null}
        </div>
      </OrgFormModal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete department?"
        confirmLabel="Delete department"
        description={
          deleting ? (
            <>
              <span className="font-medium text-primary">{deleting.path.join(' › ')}</span> will be
              permanently removed.
            </>
          ) : null
        }
        onConfirm={async () => {
          if (!deleting) return;
          await deleteDepartment(companyId, deleting.node.id);
          await load();
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

export function DepartmentsPage() {
  return (
    <OrgPageState>{(companyId) => <DepartmentsContent companyId={companyId} />}</OrgPageState>
  );
}
