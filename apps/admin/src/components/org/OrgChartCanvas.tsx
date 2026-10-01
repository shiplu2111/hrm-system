import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { isVacancy, type ChartTreeNode } from '@/lib/org-chart';
import { OrgChartNodeCard } from '@/components/org/OrgChartNodeCard';

const MIN_SCALE = 0.2;
const MAX_SCALE = 1.6;
const PADDING = 24;

export interface OrgChartCanvasHandle {
  /** Centres the node once it is rendered (call after expanding its ancestors). */
  focusNode: (id: string) => void;
  fit: () => void;
}

interface View {
  x: number;
  y: number;
  scale: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const OrgChartCanvas = forwardRef<
  OrgChartCanvasHandle,
  {
    roots: ChartTreeNode[];
    selectedId: string | null;
    highlightId: string | null;
    collapsed: Set<string>;
    isDimmed: (entry: ChartTreeNode) => boolean;
    onSelect: (id: string) => void;
    onToggle: (id: string) => void;
    /** Changing this re-fits the chart (e.g. new company or re-rooted view). */
    layoutKey: string;
  }
>(function OrgChartCanvas(
  { roots, selectedId, highlightId, collapsed, isDimmed, onSelect, onToggle, layoutKey },
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: PADDING, y: PADDING, scale: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const fit = useCallback((minScale = MIN_SCALE) => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const cw = content.offsetWidth;
    const ch = content.offsetHeight;
    const scale = clamp(Math.min((vw - PADDING * 2) / cw, (vh - PADDING * 2) / ch, 1), minScale, MAX_SCALE);
    setView({ scale, x: (vw - cw * scale) / 2, y: PADDING });
  }, []);

  const focusNode = useCallback((id: string) => {
    const run = () => {
      const viewport = viewportRef.current;
      const content = contentRef.current;
      const el = content?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
      if (!viewport || !content || !el) return;
      const { scale: current } = viewRef.current;
      const scale = Math.max(current, 0.8);
      const contentRect = content.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const cx = (rect.left - contentRect.left + rect.width / 2) / current;
      const cy = (rect.top - contentRect.top + rect.height / 2) / current;
      setView({
        scale,
        x: viewport.clientWidth / 2 - cx * scale,
        y: viewport.clientHeight / 3 - cy * scale,
      });
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, []);

  useImperativeHandle(ref, () => ({ focusNode, fit: () => fit() }), [focusNode, fit]);

  useEffect(() => {
    const id = requestAnimationFrame(() => fit(0.6));
    return () => cancelAnimationFrame(id);
  }, [layoutKey, fit]);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setView((v) => {
      const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      const px = cx ?? viewport.clientWidth / 2;
      const py = cy ?? viewport.clientHeight / 2;
      const ratio = scale / v.scale;
      return { scale, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = viewport.getBoundingClientRect();
        zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
      } else {
        setView((v) => ({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }));
      }
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    d.x = event.clientX;
    d.y = event.clientY;
    d.moved = true;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === event.pointerId) {
      drag.current = null;
      setDragging(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const step = 60;
    const actions: Record<string, () => void> = {
      '+': () => zoomAt(1.2),
      '=': () => zoomAt(1.2),
      '-': () => zoomAt(1 / 1.2),
      '0': () => fit(),
      ArrowLeft: () => setView((v) => ({ ...v, x: v.x + step })),
      ArrowRight: () => setView((v) => ({ ...v, x: v.x - step })),
      ArrowUp: () => setView((v) => ({ ...v, y: v.y + step })),
      ArrowDown: () => setView((v) => ({ ...v, y: v.y - step })),
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  const renderEntry = (entry: ChartTreeNode) => {
    const isCollapsed = collapsed.has(entry.node.id);
    return (
      <li key={entry.node.id} className={isVacancy(entry.node) ? 'is-vacancy' : undefined}>
        <OrgChartNodeCard
          entry={entry}
          selected={selectedId === entry.node.id}
          highlighted={highlightId === entry.node.id}
          dimmed={isDimmed(entry)}
          collapsed={isCollapsed}
          onSelect={() => onSelect(entry.node.id)}
          onToggle={() => onToggle(entry.node.id)}
        />
        {entry.children.length > 0 && !isCollapsed ? <ul>{entry.children.map(renderEntry)}</ul> : null}
      </li>
    );
  };

  return (
    <div className="relative h-full">
      <div
        ref={viewportRef}
        tabIndex={0}
        role="region"
        aria-label="Organization chart. Drag or use arrow keys to pan, Ctrl + scroll or plus and minus to zoom, 0 to fit."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className={`absolute inset-0 overflow-hidden rounded-b-lg bg-[rgb(var(--bg-base))] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-600 ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          backgroundImage: 'radial-gradient(rgb(var(--border-base)) 1px, transparent 1px)',
          backgroundSize: `${20 * view.scale}px ${20 * view.scale}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        <div
          ref={contentRef}
          className="org-tree absolute left-0 top-0 w-max select-none"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: '0 0',
          }}
        >
          <ul aria-label="Reporting structure">
            {roots.map(renderEntry)}
          </ul>
        </div>
      </div>

      <div className="absolute right-3 top-3 flex items-center surface border border-base rounded-lg shadow-card overflow-hidden">
        <button
          type="button"
          onClick={() => zoomAt(1 / 1.2)}
          aria-label="Zoom out"
          className="p-2 text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary transition-colors"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-12 text-center font-mono text-xs text-secondary tabular-nums" aria-live="polite">
          {Math.round(view.scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => zoomAt(1.2)}
          aria-label="Zoom in"
          className="p-2 text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
        <span className="h-5 w-px bg-[rgb(var(--border-base))]" />
        <button
          type="button"
          onClick={() => fit()}
          aria-label="Fit chart to screen"
          title="Fit to screen (0)"
          className="p-2 text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary transition-colors"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute left-3 bottom-3 flex flex-wrap items-center gap-3 surface border border-base rounded-lg shadow-card px-3 py-1.5 text-2xs text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm border border-base bg-[rgb(var(--bg-surface))]" /> Filled
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm border border-dashed border-warning-500 bg-warning-50" /> Vacated seat
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm border border-dashed border-accent-400 bg-accent-50" /> Open requisition
        </span>
        <span className="hidden md:inline text-muted">Drag to pan · Ctrl + scroll to zoom</span>
      </div>
    </div>
  );
});
