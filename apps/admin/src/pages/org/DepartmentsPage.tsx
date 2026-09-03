import { useCallback, useEffect, useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Folder,
  FolderOpen,
  Users,
  Loader2,
} from 'lucide-react';
import type { DepartmentTreeNode } from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { useCompany } from '@/context/CompanyContext';
import {
  createDepartment,
  deleteDepartment,
  getDepartmentTree,
  updateDepartment,
} from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

function DeptRow({
  node,
  depth,
  onEdit,
  onDelete,
  onAddChild,
}: {
  node: DepartmentTreeNode;
  depth: number;
  onEdit: (n: DepartmentTreeNode) => void;
  onDelete: (id: string) => void;
  onAddChild: (parent: DepartmentTreeNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-2.5 hover:bg-[rgb(var(--bg-hover))] transition-colors group rounded-lg"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-muted hover:text-primary shrink-0"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        {hasChildren ? (
          expanded ? (
            <FolderOpen className="h-4 w-4 text-accent-500 shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-accent-500 shrink-0" />
          )
        ) : (
          <Folder className="h-4 w-4 text-muted shrink-0" />
        )}
        <span className="text-sm font-medium text-primary flex-1">
          {node.name}
        </span>
        <span className="text-xs text-muted hidden sm:flex items-center gap-1">
          <Users className="h-3 w-3" /> {node.employeeCount}
        </span>
        <Dropdown
          width="w-40"
          trigger={
            <button
              type="button"
              className="text-muted hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-muted))] transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          }
        >
          <DropdownItem
            icon={<Plus className="h-4 w-4" />}
            onClick={() => onAddChild(node)}
          >
            Add Sub-dept
          </DropdownItem>
          <DropdownItem
            icon={<Pencil className="h-4 w-4" />}
            onClick={() => onEdit(node)}
          >
            Edit
          </DropdownItem>
          <DropdownDivider />
          <DropdownItem
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => onDelete(node.id)}
          >
            Delete
          </DropdownItem>
        </Dropdown>
      </div>
      {hasChildren && expanded && (
        <div className="border-l border-base ml-5">
          {node.children.map((child) => (
            <DeptRow
              key={child.id}
              node={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </>
  );
}

function DepartmentsContent({ companyId }: { companyId: string }) {
  const { companyId: ctxCompanyId } = useCompany();
  const activeCompanyId = companyId || ctxCompanyId!;
  const [tree, setTree] = useState<DepartmentTreeNode[]>([]);
  const [flatParents, setFlatParents] = useState<DepartmentTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentTreeNode | null>(null);
  const [parentForAdd, setParentForAdd] = useState<DepartmentTreeNode | null>(
    null,
  );
  const [form, setForm] = useState({ name: '', parentDepartmentId: '' });
  const [saving, setSaving] = useState(false);

  const flatten = useCallback((nodes: DepartmentTreeNode[]): DepartmentTreeNode[] => {
    const out: DepartmentTreeNode[] = [];
    for (const n of nodes) {
      out.push(n);
      out.push(...flatten(n.children));
    }
    return out;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDepartmentTree(activeCompanyId);
      setTree(data);
      setFlatParents(flatten(data));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, flatten]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = (parent?: DepartmentTreeNode) => {
    setEditing(null);
    setParentForAdd(parent ?? null);
    setForm({
      name: '',
      parentDepartmentId: parent?.id ?? '',
    });
    setModalOpen(true);
  };

  const openEdit = (node: DepartmentTreeNode) => {
    setEditing(node);
    setParentForAdd(null);
    setForm({
      name: node.name,
      parentDepartmentId: node.parentDepartmentId ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const parentId = parentForAdd
        ? parentForAdd.id
        : form.parentDepartmentId || null;

      if (editing) {
        await updateDepartment(activeCompanyId, editing.id, {
          name: form.name.trim(),
          parentDepartmentId: form.parentDepartmentId || null,
        });
      } else {
        await createDepartment(activeCompanyId, {
          name: form.name.trim(),
          parentDepartmentId: parentId,
        });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this department?')) return;
    setError(null);
    try {
      await deleteDepartment(activeCompanyId, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Departments</h1>
          <p className="text-sm text-secondary mt-0.5">
            Hierarchical structure of your organization&apos;s departments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <Button variant="primary" onClick={() => openAdd()}>
            <Plus className="h-4 w-4" /> Add Department
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Department Tree</CardTitle>
          <Badge tone="neutral">{tree.length} root departments</Badge>
        </CardHeader>
        <CardBody className="p-2">
          {loading ? (
            <div className="py-8 flex justify-center text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : tree.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">
              No departments yet. Create your first department.
            </p>
          ) : (
            <div className="space-y-0.5">
              {tree.map((node) => (
                <DeptRow
                  key={node.id}
                  node={node}
                  depth={0}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onAddChild={openAdd}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Department' : 'Add Department'}
        description={
          parentForAdd
            ? `Adding a sub-department under "${parentForAdd.name}"`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Department'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Department Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Research & Development"
            />
          </div>
          {!editing && !parentForAdd && (
            <div>
              <Label>Parent Department (optional)</Label>
              <Select
                value={form.parentDepartmentId}
                onChange={(e) =>
                  setForm({ ...form, parentDepartmentId: e.target.value })
                }
              >
                <option value="">None — Root level</option>
                {flatParents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export function DepartmentsPage() {
  return (
    <OrgPageState>{(companyId) => <DepartmentsContent companyId={companyId} />}</OrgPageState>
  );
}
