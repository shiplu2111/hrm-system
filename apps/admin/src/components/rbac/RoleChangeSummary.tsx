import { AlertTriangle, Minus, Plus } from 'lucide-react';
import { rolesCopy as copy } from '@/lib/roles-copy';
import { describeGrant, SENSITIVE_ACTIONS, splitGrantKey } from '@/lib/role-matrix';

interface Props {
  added: string[];
  removed: string[];
  userCount: number;
  rename?: { from: string; to: string };
  scopeChange?: { from: string; to: string };
}

function GrantList({ title, keys, tone }: { title: string; keys: string[]; tone: 'added' | 'removed' }) {
  if (keys.length === 0) return null;
  const Icon = tone === 'added' ? Plus : Minus;
  return (
    <div>
      <div className="text-xs font-semibold text-secondary uppercase tracking-wide mb-1.5">
        {title} ({keys.length})
      </div>
      <ul className="max-h-40 overflow-y-auto space-y-1 text-sm">
        {keys.map((key) => (
          <li key={key} className="flex items-center gap-2 text-primary">
            <Icon
              className={`h-3.5 w-3.5 shrink-0 ${tone === 'added' ? 'text-success-600' : 'text-error-600'}`}
              aria-hidden
            />
            {describeGrant(key)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RoleChangeSummary({ added, removed, userCount, rename, scopeChange }: Props) {
  const sensitive = added.some((key) => SENSITIVE_ACTIONS.has(splitGrantKey(key).action));
  return (
    <div className="space-y-4 text-left">
      <p className="text-sm text-secondary">{copy.review.affects(userCount)}</p>
      {rename ? <p className="text-sm text-primary">{copy.review.renamed(rename.from, rename.to)}</p> : null}
      {scopeChange ? <p className="text-sm text-primary">{copy.scope.changed(scopeChange.from, scopeChange.to)}</p> : null}
      <GrantList title={copy.review.added} keys={added} tone="added" />
      <GrantList title={copy.review.removed} keys={removed} tone="removed" />
      {sensitive ? (
        <p className="flex items-start gap-2 text-sm text-warning-700 dark:text-warning-300 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          {copy.review.sensitive}
        </p>
      ) : null}
      <p className="text-xs text-muted">{copy.editor.propagation}</p>
    </div>
  );
}
