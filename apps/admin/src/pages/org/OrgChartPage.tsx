import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  GitBranch,
  LayoutList,
  Network,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import type { OrgChartData } from '@hrm/shared-types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Form';
import { Skeleton } from '@/components/ui/Skeleton';
import { OrgPageState } from '@/components/org/OrgPageState';
import { OrgErrorBanner, OrgPageHeader } from '@/components/org/OrgScreenParts';
import { OrgChartCanvas, type OrgChartCanvasHandle } from '@/components/org/OrgChartCanvas';
import { OrgChartDetails } from '@/components/org/OrgChartDetails';
import { OrgVacancyList } from '@/components/org/OrgVacancyList';
import { useNav } from '@/context/NavContext';
import { flattenDepartments } from '@/lib/department-tree';
import {
  ancestorIds,
  collapsedBeyond,
  departmentScope,
  indexChart,
  nodeLabel,
  searchChart,
  type ChartTreeNode,
} from '@/lib/org-chart';
import { getDepartmentTree, getOrgChart } from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

type ViewMode = 'chart' | 'vacancies';
const LEVEL_OPTIONS = [2, 3, 4, 0] as const;

function StatTile({
  icon,
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'warning';
}) {
  return (
    <div className="surface rounded-lg border border-base px-4 py-3 shadow-card">
      <div className="flex items-center gap-2 text-xs text-secondary">
        <span className={tone === 'warning' ? 'text-warning-600' : 'text-muted'}>{icon}</span>
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === 'warning' ? 'text-warning-700 dark:text-warning-400' : 'text-primary'
        }`}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-2xs text-muted truncate" title={hint}>{hint}</div> : null}
    </div>
  );
}

function OrgChartContent({ companyId }: { companyId: string }) {
  const { openEmployee, navigate } = useNav();
  const canvasRef = useRef<OrgChartCanvasHandle>(null);

  const [data, setData] = useState<OrgChartData | null>(null);
  const [departments, setDepartments] = useState<Array<{ id: string; parentDepartmentId: string | null }>>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<ViewMode>('chart');
  const [showRequisitions, setShowRequisitions] = useState(true);
  const [departmentId, setDepartmentId] = useState('');
  const [levels, setLevels] = useState<number>(3);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [rootId, setRootId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeHit, setActiveHit] = useState(0);

  const load = useCallback(
    async (initial: boolean) => {
      if (initial) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const [chart, deptTree] = await Promise.all([
          getOrgChart(companyId),
          getDepartmentTree(companyId),
        ]);
        const flat = flattenDepartments(deptTree);
        setData(chart);
        setDepartments(flat.map(({ node }) => ({ id: node.id, parentDepartmentId: node.parentDepartmentId })));
        setDepartmentOptions(
          flat.map(({ node, depth }) => ({
            id: node.id,
            label: `${'\u00A0\u00A0'.repeat(depth)}${depth ? '└ ' : ''}${node.name}`,
          })),
        );
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load the org chart');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId],
  );

  useEffect(() => {
    setRootId(null);
    setSelectedId(null);
    void load(true);
  }, [load]);

  const index = useMemo(() => {
    const nodes = data?.nodes ?? [];
    return indexChart(showRequisitions ? nodes : nodes.filter((n) => n.kind !== 'requisition'));
  }, [data, showRequisitions]);

  useEffect(() => {
    if (!data) return;
    setCollapsed(collapsedBeyond(indexChart(data.nodes), 3));
    setLevels(3);
  }, [data]);

  const rootEntry = rootId ? index.byId.get(rootId) : undefined;
  const displayRoots = useMemo(
    () => (rootEntry ? [rootEntry] : index.roots),
    [rootEntry, index.roots],
  );

  const scope = useMemo(
    () => (departmentId ? departmentScope(departmentId, departments) : null),
    [departmentId, departments],
  );
  const isDimmed = useCallback(
    (entry: ChartTreeNode) => Boolean(scope && !(entry.node.departmentId && scope.has(entry.node.departmentId))),
    [scope],
  );

  const hits = useMemo(() => searchChart(index, query), [index, query]);
  const vacancyNodeCount = useMemo(
    () => [...index.byId.values()].filter((e) => e.node.kind !== 'employee').length,
    [index],
  );
  const selected = selectedId ? index.byId.get(selectedId) : undefined;

  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  const applyLevels = (value: number) => {
    setLevels(value);
    if (value === 0) {
      setCollapsed(new Set());
      return;
    }
    const base = rootEntry?.depth ?? 0;
    const next = new Set<string>();
    for (const entry of index.byId.values()) {
      if (entry.children.length > 0 && entry.depth - base >= value - 1) next.add(entry.node.id);
    }
    setCollapsed(next);
  };

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const locate = useCallback(
    (id: string) => {
      if (!index.byId.has(id)) return;
      const ancestors = ancestorIds(index, id);
      setMode('chart');
      if (rootId && rootId !== id && !ancestors.includes(rootId)) setRootId(null);
      setCollapsed((prev) => {
        const next = new Set(prev);
        for (const a of ancestors) next.delete(a);
        return next;
      });
      setSelectedId(id);
      setHighlightId(id);
      canvasRef.current?.focusNode(id);
    },
    [index, rootId],
  );

  const pickHit = (id: string) => {
    setQuery('');
    setSearchOpen(false);
    locate(id);
  };

  const focusTeam = (id: string) => {
    setRootId(id);
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <Skeleton className="h-12 w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-[60vh]" />
      </div>
    );
  }

  const summary = data?.summary;
  const vacancyTotal = summary ? summary.vacatedPositions + summary.openSeats + summary.pendingSeats : 0;
  const vacancyHint = summary
    ? [
        `${summary.vacatedPositions} vacated`,
        data?.includesRequisitions ? `${summary.openSeats} hiring` : null,
        data?.includesRequisitions && summary.pendingSeats ? `${summary.pendingSeats} pending approval` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;
  const breadcrumb = rootId ? [...ancestorIds(index, rootId), rootId] : [];

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <OrgPageHeader
        title="Org Chart"
        description="Live reporting structure from each employee's manager, with vacated seats and open requisitions."
        actions={
          <Button variant="secondary" onClick={() => void load(false)} disabled={refreshing} aria-label="Refresh org chart">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      {error ? <OrgErrorBanner message={error} onRetry={() => void load(!data)} /> : null}

      {summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            icon={<Users className="h-4 w-4" />}
            label="Headcount"
            value={summary.headcount}
            hint={summary.topLevel > 1 ? `${summary.topLevel} people have no manager assigned` : 'Everyone rolls up to one leader'}
          />
          <StatTile
            icon={<UserX className="h-4 w-4" />}
            label="Vacant positions"
            value={vacancyTotal}
            hint={vacancyHint}
            tone={vacancyTotal > 0 ? 'warning' : 'neutral'}
          />
          <StatTile
            icon={<GitBranch className="h-4 w-4" />}
            label="Reporting levels"
            value={summary.maxDepth}
          />
          <StatTile
            icon={<Network className="h-4 w-4" />}
            label="Avg. span of control"
            value={summary.averageSpan || '—'}
            hint="Direct reports per manager"
          />
        </div>
      ) : null}

      {data && !data.includesRequisitions ? (
        <p className="text-xs text-muted">
          Open requisitions are hidden because your role cannot view Recruitment. Vacated seats are still shown.
        </p>
      ) : null}

      {data && data.nodes.length === 0 ? (
        <Card>
          <EmptyState
            icon={Network}
            title="No reporting structure yet"
            description="Add employees and set their manager to build the org chart."
            action={{ label: 'Go to Employee Directory', onClick: () => navigate('emp-directory'), icon: UserPlus }}
          />
        </Card>
      ) : data ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-base px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-1 rounded-lg bg-[rgb(var(--bg-muted))] p-1 self-start" role="tablist" aria-label="View">
              {(
                [
                  { key: 'chart', label: 'Chart', icon: Network },
                  { key: 'vacancies', label: `Vacancies (${vacancyNodeCount})`, icon: LayoutList },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={mode === tab.key}
                  onClick={() => setMode(tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    mode === tab.key ? 'surface text-primary shadow-card' : 'text-secondary hover:text-primary'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" /> {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchOpen(true);
                    setActiveHit(0);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (!hits.length) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveHit((i) => (i + 1) % hits.length);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveHit((i) => (i - 1 + hits.length) % hits.length);
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      pickHit(hits[activeHit]!.node.id);
                    } else if (e.key === 'Escape') {
                      setSearchOpen(false);
                    }
                  }}
                  placeholder="Find person, title or requisition"
                  aria-label="Find in org chart"
                  aria-autocomplete="list"
                  aria-expanded={searchOpen && hits.length > 0}
                  className="h-9 pl-9"
                />
                {searchOpen && query.trim() ? (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-base bg-[rgb(var(--bg-elevated))] py-1 shadow-elevated" role="listbox">
                    {hits.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted">No matches</p>
                    ) : (
                      hits.map((hit, i) => (
                        <button
                          key={hit.node.id}
                          type="button"
                          role="option"
                          aria-selected={i === activeHit}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickHit(hit.node.id)}
                          className={`flex w-full flex-col px-3 py-1.5 text-left ${
                            i === activeHit ? 'bg-[rgb(var(--bg-hover))]' : ''
                          }`}
                        >
                          <span className="text-sm text-primary">
                            {nodeLabel(hit.node)}
                            {hit.node.kind !== 'employee' ? (
                              <span className="ml-1.5 text-2xs text-warning-700 dark:text-warning-400">
                                {hit.node.kind === 'vacated' ? 'Vacated' : 'Open'}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-2xs text-muted">
                            {[hit.node.kind === 'requisition' ? hit.node.requisition?.referenceNumber : hit.node.title, hit.node.departmentName]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              {mode === 'chart' ? (
                <>
                  <Select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    aria-label="Highlight department"
                    className="h-9 w-full sm:w-48"
                  >
                    <option value="">All departments</option>
                    {departmentOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={String(levels)}
                    onChange={(e) => applyLevels(Number(e.target.value))}
                    aria-label="Levels to show"
                    className="h-9 w-full sm:w-36"
                  >
                    {LEVEL_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? 'Expand all' : `Show ${n} levels`}
                      </option>
                    ))}
                  </Select>
                </>
              ) : null}
              {data.includesRequisitions ? (
                <label className="inline-flex items-center gap-2 text-xs text-secondary select-none">
                  <input
                    type="checkbox"
                    checked={showRequisitions}
                    onChange={(e) => setShowRequisitions(e.target.checked)}
                    className="h-4 w-4 rounded border-base accent-accent-600"
                  />
                  Show open requisitions
                </label>
              ) : null}
            </div>
          </div>

          {mode === 'chart' && breadcrumb.length > 0 ? (
            <nav aria-label="Team focus" className="flex flex-wrap items-center gap-1 border-b border-base bg-[rgb(var(--bg-muted))] px-4 py-2 text-xs">
              <button type="button" onClick={() => setRootId(null)} className="text-accent-700 dark:text-accent-300 hover:underline">
                Whole organization
              </button>
              {breadcrumb.map((id) => {
                const entry = index.byId.get(id);
                if (!entry) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-muted" />
                    {id === rootId ? (
                      <span className="font-medium text-primary">{nodeLabel(entry.node)}'s team</span>
                    ) : (
                      <button type="button" onClick={() => setRootId(id)} className="text-accent-700 dark:text-accent-300 hover:underline">
                        {nodeLabel(entry.node)}
                      </button>
                    )}
                  </span>
                );
              })}
            </nav>
          ) : null}

          {mode === 'chart' ? (
            <div className="relative flex h-[68vh] min-h-[480px]">
              <div className="relative flex-1 min-w-0">
                <OrgChartCanvas
                  ref={canvasRef}
                  roots={displayRoots}
                  selectedId={selectedId}
                  highlightId={highlightId}
                  collapsed={collapsed}
                  isDimmed={isDimmed}
                  onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
                  onToggle={toggle}
                  layoutKey={`${companyId}:${rootId ?? 'all'}`}
                />
              </div>
              {selected ? (
                <aside
                  className="absolute inset-y-0 right-0 z-20 w-full max-w-sm border-l border-base surface shadow-elevated animate-slide-in-right lg:static lg:w-80 lg:shadow-none lg:animate-none"
                  aria-label="Position details"
                >
                  <OrgChartDetails
                    entry={selected}
                    index={index}
                    onSelect={locate}
                    onFocusHere={focusTeam}
                    onLocate={locate}
                    onOpenProfile={openEmployee}
                    onOpenRecruitment={() => navigate('recruitment')}
                    onClose={() => setSelectedId(null)}
                  />
                </aside>
              ) : null}
            </div>
          ) : (
            <OrgVacancyList index={index} onLocate={locate} />
          )}
        </Card>
      ) : null}
    </div>
  );
}

export function OrgChartPage() {
  return <OrgPageState>{(companyId) => <OrgChartContent companyId={companyId} />}</OrgPageState>;
}
