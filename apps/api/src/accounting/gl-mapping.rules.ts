import {
  GL_COST_CENTRE_DEFAULT_SOURCE,
  GL_COST_CENTRE_SUPER_SOURCE,
  type GlAccountType,
} from '@hrm/shared-types';

export type CostCentreSource =
  | { kind: 'default' }
  | { kind: 'component'; payComponentId: string }
  | { kind: 'employer_super' };

export function parseCostCentreSourceKey(sourceKey: string): CostCentreSource | null {
  const key = sourceKey.trim();
  if (key === GL_COST_CENTRE_DEFAULT_SOURCE) return { kind: 'default' };
  if (key === GL_COST_CENTRE_SUPER_SOURCE) return { kind: 'employer_super' };
  if (key.startsWith('component:')) {
    const payComponentId = key.slice('component:'.length).toLowerCase();
    return payComponentId ? { kind: 'component', payComponentId } : null;
  }
  return null;
}

export function costCentreSourceKey(source: CostCentreSource): string {
  switch (source.kind) {
    case 'default':
      return GL_COST_CENTRE_DEFAULT_SOURCE;
    case 'employer_super':
      return GL_COST_CENTRE_SUPER_SOURCE;
    case 'component':
      return `component:${source.payComponentId}`;
  }
}

/** Cost-centre overrides re-route employee costs, so they must land on an expense account. */
export function costCentreAccountError(account: {
  code: string;
  name: string;
  accountType: GlAccountType;
  isActive: boolean;
}): string | null {
  if (!account.isActive) {
    return `GL account ${account.code} (${account.name}) is inactive`;
  }
  if (account.accountType !== 'expense') {
    return `Cost-centre overrides must post to an expense account — ${account.code} (${account.name}) is a ${account.accountType} account`;
  }
  return null;
}

export function findDuplicate<T>(items: T[], keyOf: (item: T) => string): string | null {
  const seen = new Set<string>();
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return null;
}
