import { useState } from 'react';
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
  GripVertical,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';

interface DeptNode {
  id: string;
  name: string;
  head: string;
  employees: number;
  children?: DeptNode[];
}

const initialDepts: DeptNode[] = [
  {
    id: '1', name: 'Executive', head: 'John Smith', employees: 5,
    children: [
      {
        id: '2', name: 'Engineering', head: 'Sarah Chen', employees: 420,
        children: [
          { id: '3', name: 'Frontend', head: 'Mike Ross', employees: 85 },
          { id: '4', name: 'Backend', head: 'Lisa Wang', employees: 120 },
          { id: '5', name: 'DevOps', head: 'Tom Hardy', employees: 45 },
          { id: '6', name: 'QA', head: 'Nina Garcia', employees: 60 },
        ],
      },
      {
        id: '7', name: 'Sales', head: 'Marcus Johnson', employees: 280,
        children: [
          { id: '8', name: 'Inside Sales', head: 'David Kim', employees: 150 },
          { id: '9', name: 'Field Sales', head: 'Emma Wilson', employees: 130 },
        ],
      },
      { id: '10', name: 'Marketing', head: 'Priya Patel', employees: 145 },
      { id: '11', name: 'Operations', head: 'Robert Lee', employees: 210 },
      { id: '12', name: 'Finance', head: 'Sofia Martinez', employees: 95 },
      { id: '13', name: 'HR', head: 'Alex Morgan', employees: 134 },
    ],
  },
];

function DeptRow({ node, depth, onEdit, onDelete, onAddChild }: {
  node: DeptNode;
  depth: number;
  onEdit: (n: DeptNode) => void;
  onDelete: (id: string) => void;
  onAddChild: (parent: DeptNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-2.5 hover:bg-[rgb(var(--bg-hover))] transition-colors group rounded-lg"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <GripVertical className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
        {hasChildren ? (
          <button onClick={() => setExpanded((e) => !e)} className="text-muted hover:text-primary shrink-0">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        {hasChildren ? (
          expanded ? <FolderOpen className="h-4 w-4 text-accent-500 shrink-0" /> : <Folder className="h-4 w-4 text-accent-500 shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-muted shrink-0" />
        )}
        <span className="text-sm font-medium text-primary flex-1">{node.name}</span>
        <span className="text-xs text-muted hidden sm:flex items-center gap-1">
          <Users className="h-3 w-3" /> {node.employees}
        </span>
        <span className="text-xs text-secondary hidden md:block w-28 truncate">Head: {node.head}</span>
        <Dropdown
          width="w-40"
          trigger={
            <button className="text-muted hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-muted))] transition-colors opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          }
        >
          <DropdownItem icon={<Plus className="h-4 w-4" />} onClick={() => onAddChild(node)}>Add Sub-dept</DropdownItem>
          <DropdownItem icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(node)}>Edit</DropdownItem>
          <DropdownDivider />
          <DropdownItem icon={<Trash2 className="h-4 w-4" />} onClick={() => onDelete(node.id)}>Delete</DropdownItem>
        </Dropdown>
      </div>
      {hasChildren && expanded && (
        <div className="border-l border-base ml-5">
          {node.children!.map((child) => (
            <DeptRow key={child.id} node={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} onAddChild={onAddChild} />
          ))}
        </div>
      )}
    </>
  );
}

export function DepartmentsPage() {
  const [depts, setDepts] = useState<DeptNode[]>(initialDepts);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DeptNode | null>(null);
  const [parentForAdd, setParentForAdd] = useState<DeptNode | null>(null);
  const [form, setForm] = useState({ name: '', head: '', parent: '' });

  const openAdd = (parent?: DeptNode) => {
    setEditing(null);
    setParentForAdd(parent || null);
    setForm({ name: '', head: '', parent: parent ? parent.name : '' });
    setModalOpen(true);
  };

  const openEdit = (node: DeptNode) => {
    setEditing(node);
    setParentForAdd(null);
    setForm({ name: node.name, head: node.head, parent: '' });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name) return;
    if (editing) {
      const updateNode = (nodes: DeptNode[]): DeptNode[] =>
        nodes.map((n) => {
          if (n.id === editing.id) return { ...n, name: form.name, head: form.head };
          if (n.children) return { ...n, children: updateNode(n.children) };
          return n;
        });
      setDepts((prev) => updateNode(prev));
    } else if (parentForAdd) {
      const addChild = (nodes: DeptNode[]): DeptNode[] =>
        nodes.map((n) => {
          if (n.id === parentForAdd.id) {
            return { ...n, children: [...(n.children || []), { id: Date.now().toString(), name: form.name, head: form.head, employees: 0 }] };
          }
          if (n.children) return { ...n, children: addChild(n.children) };
          return n;
        });
      setDepts((prev) => addChild(prev));
    } else {
      setDepts((prev) => [...prev, { id: Date.now().toString(), name: form.name, head: form.head, employees: 0 }]);
    }
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const removeNode = (nodes: DeptNode[]): DeptNode[] =>
      nodes
        .filter((n) => n.id !== id)
        .map((n) => (n.children ? { ...n, children: removeNode(n.children) } : n));
    setDepts((prev) => removeNode(prev));
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Departments</h1>
          <p className="text-sm text-secondary mt-0.5">Hierarchical structure of your organization's departments.</p>
        </div>
        <Button variant="primary" onClick={() => openAdd()}>
          <Plus className="h-4 w-4" /> Add Department
        </Button>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Department Tree</CardTitle>
          <Badge tone="neutral">{depts.length} root · drag to reorder</Badge>
        </CardHeader>
        <CardBody className="p-2">
          <div className="space-y-0.5">
            {depts.map((node) => (
              <DeptRow key={node.id} node={node} depth={0} onEdit={openEdit} onDelete={handleDelete} onAddChild={openAdd} />
            ))}
          </div>
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Department' : 'Add Department'}
        description={parentForAdd ? `Adding a sub-department under "${parentForAdd.name}"` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>{editing ? 'Save Changes' : 'Create Department'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Department Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Research & Development" />
          </div>
          <div>
            <Label>Department Head</Label>
            <Input value={form.head} onChange={(e) => setForm({ ...form, head: e.target.value })} placeholder="Search employee..." />
          </div>
          {!editing && !parentForAdd && (
            <div>
              <Label>Parent Department (optional)</Label>
              <Select>
                <option value="">None — Root level</option>
                <option>Executive</option>
                <option>Engineering</option>
                <option>Sales</option>
              </Select>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
