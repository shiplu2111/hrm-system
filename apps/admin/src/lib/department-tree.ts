import type { DepartmentTreeNode } from '@hrm/shared-types';

export interface FlatDepartment {
  node: DepartmentTreeNode;
  depth: number;
  /** Names from the root down to (and including) this department. */
  path: string[];
}

function byName(a: DepartmentTreeNode, b: DepartmentTreeNode): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

/** Depth-first, siblings sorted by name — the order the tree renders in. */
export function flattenDepartments(
  nodes: DepartmentTreeNode[],
  depth = 0,
  parentPath: string[] = [],
): FlatDepartment[] {
  const out: FlatDepartment[] = [];
  for (const node of [...nodes].sort(byName)) {
    const path = [...parentPath, node.name];
    out.push({ node, depth, path });
    out.push(...flattenDepartments(node.children, depth + 1, path));
  }
  return out;
}

export function sortDepartmentTree(nodes: DepartmentTreeNode[]): DepartmentTreeNode[] {
  return [...nodes].sort(byName).map((n) => ({ ...n, children: sortDepartmentTree(n.children) }));
}

export function collectIds(nodes: DepartmentTreeNode[]): string[] {
  return nodes.flatMap((n) => [n.id, ...collectIds(n.children)]);
}

/** The department itself plus everything beneath it — invalid parents when re-parenting. */
export function subtreeIds(node: DepartmentTreeNode): Set<string> {
  return new Set([node.id, ...collectIds(node.children)]);
}

export function subtreeEmployeeCount(node: DepartmentTreeNode): number {
  return node.employeeCount + node.children.reduce((sum, c) => sum + subtreeEmployeeCount(c), 0);
}

export function maxDepth(nodes: DepartmentTreeNode[]): number {
  if (nodes.length === 0) return 0;
  return 1 + Math.max(...nodes.map((n) => maxDepth(n.children)));
}

/**
 * Keeps matching departments and their ancestors (so matches stay in context).
 * Returns the ids of ancestors that must be expanded to reveal the matches.
 */
export function filterDepartmentTree(
  nodes: DepartmentTreeNode[],
  query: string,
): { nodes: DepartmentTreeNode[]; expandIds: Set<string> } {
  const q = query.trim().toLowerCase();
  const expandIds = new Set<string>();
  if (!q) return { nodes, expandIds };

  const visit = (list: DepartmentTreeNode[]): DepartmentTreeNode[] =>
    list.flatMap((node) => {
      const children = visit(node.children);
      const matches = node.name.toLowerCase().includes(q);
      if (!matches && children.length === 0) return [];
      if (children.length > 0) expandIds.add(node.id);
      return [{ ...node, children: matches && children.length === 0 ? node.children : children }];
    });

  return { nodes: visit(nodes), expandIds };
}
