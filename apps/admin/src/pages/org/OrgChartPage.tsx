import { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, UserPlus, Mail, Phone, MoreVertical } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface OrgNode {
  id: string;
  name: string;
  title: string;
  department: string;
  avatar?: string;
  vacant?: boolean;
  children?: OrgNode[];
}

const orgData: OrgNode = {
  id: '1',
  name: 'John Smith',
  title: 'CEO',
  department: 'Executive',
  children: [
    {
      id: '2', name: 'Sarah Chen', title: 'VP Engineering', department: 'Engineering',
      children: [
        { id: '5', name: 'Mike Ross', title: 'Eng Director', department: 'Frontend' },
        { id: '6', name: 'Lisa Wang', title: 'Eng Director', department: 'Backend' },
        { id: '7', name: '', title: 'Eng Director', department: 'DevOps', vacant: true },
      ],
    },
    {
      id: '3', name: 'Marcus Johnson', title: 'VP Sales', department: 'Sales',
      children: [
        { id: '8', name: 'David Kim', title: 'Sales Director', department: 'Inside Sales' },
        { id: '9', name: 'Emma Wilson', title: 'Sales Director', department: 'Field Sales' },
      ],
    },
    {
      id: '4', name: 'Priya Patel', title: 'VP Marketing', department: 'Marketing',
      children: [
        { id: '10', name: 'Tom Anderson', title: 'Marketing Lead', department: 'Digital' },
        { id: '11', name: '', title: 'Brand Manager', department: 'Brand', vacant: true },
      ],
    },
  ],
};

function NodeCard({ node, onHover }: { node: OrgNode; onHover?: (n: OrgNode | null) => void }) {
  const initials = node.name ? node.name.split(' ').map((n) => n[0]).join('') : '?';
  return (
    <div
      onMouseEnter={() => onHover?.(node)}
      onMouseLeave={() => onHover?.(null)}
      className={`relative w-44 rounded-xl border p-3 transition-all hover:shadow-elevated hover:-translate-y-0.5 cursor-pointer ${
        node.vacant
          ? 'border-2 border-dashed border-strong bg-transparent'
          : 'surface border-base shadow-card'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {node.vacant ? (
          <div className="h-9 w-9 rounded-full border-2 border-dashed border-strong flex items-center justify-center text-muted">
            <UserPlus className="h-4 w-4" />
          </div>
        ) : (
          <div className="h-9 w-9 rounded-full bg-accent-100 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300 flex items-center justify-center text-sm font-semibold shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <div className={`text-sm font-medium truncate ${node.vacant ? 'text-muted italic' : 'text-primary'}`}>
            {node.vacant ? 'Vacant Position' : node.name}
          </div>
          <div className="text-xs text-secondary truncate">{node.title}</div>
        </div>
      </div>
      {!node.vacant && (
        <div className="mt-2 flex items-center gap-1">
          <Badge tone="neutral" className="text-[10px]">{node.department}</Badge>
        </div>
      )}
      {node.vacant && (
        <div className="mt-2">
          <Badge tone="warning" className="text-[10px]">Open Role</Badge>
        </div>
      )}
    </div>
  );
}

function OrgTree({ node, depth = 0, onHover }: { node: OrgNode; depth?: number; onHover?: (n: OrgNode | null) => void }) {
  const hasChildren = node.children && node.children.length > 0;
  return (
    <div className="flex flex-col items-center">
      <NodeCard node={node} onHover={onHover} />
      {hasChildren && (
        <>
          {/* Vertical line down */}
          <div className="w-px h-6 bg-[rgb(var(--border-strong))]" />
          {/* Horizontal connector */}
          <div className="relative flex">
            {/* Horizontal line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-[rgb(var(--border-strong))]" style={{ width: `${node.children!.length * 190}px` }} />
            {node.children!.map((child) => (
              <div key={child.id} className="flex flex-col items-center px-1" style={{ width: 190 }}>
                {/* Vertical line up to horizontal */}
                <div className="w-px h-6 bg-[rgb(var(--border-strong))]" />
                <OrgTree node={child} depth={depth + 1} onHover={onHover} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function OrgChartPage() {
  const [zoom, setZoom] = useState(100);
  const [hovered, setHovered] = useState<OrgNode | null>(null);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Organization Chart</h1>
          <p className="text-sm text-secondary mt-0.5">Visual reporting structure — vacant positions shown with dashed borders.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center surface border border-base rounded-lg overflow-hidden">
            <button onClick={() => setZoom((z) => Math.max(50, z - 10))} className="p-2 text-secondary hover:bg-[rgb(var(--bg-hover))] transition-colors">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs text-secondary font-mono w-12 text-center">{zoom}%</span>
            <button onClick={() => setZoom((z) => Math.min(150, z + 10))} className="p-2 text-secondary hover:bg-[rgb(var(--bg-hover))] transition-colors">
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
          <Button variant="secondary" size="md" onClick={() => setZoom(100)}>
            <Maximize className="h-4 w-4" /> Reset
          </Button>
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="overflow-auto scrollbar-thin" style={{ maxHeight: '70vh' }}>
            <div className="flex justify-center min-w-fit p-8" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
              <OrgTree node={orgData} onHover={setHovered} />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Hover detail panel */}
      {hovered && !hovered.vacant && (
        <div className="fixed bottom-6 right-6 surface rounded-xl border shadow-elevated p-4 w-72 animate-fade-in z-40">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-full bg-accent-100 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300 flex items-center justify-center text-base font-semibold shrink-0">
              {hovered.name.split(' ').map((n) => n[0]).join('')}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-primary">{hovered.name}</div>
              <div className="text-xs text-secondary">{hovered.title}</div>
              <div className="mt-1"><Badge tone="neutral">{hovered.department}</Badge></div>
            </div>
            <button className="text-muted hover:text-primary p-1">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1">
              <Mail className="h-3.5 w-3.5" /> Message
            </Button>
            <Button variant="secondary" size="sm" className="flex-1">
              <Phone className="h-3.5 w-3.5" /> Call
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
