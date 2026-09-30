import type { FormEvent, ReactNode } from 'react';
import { AlertCircle, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { PermissionGate, usePermissions } from '@hrm/portal-ui';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Form';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dropdown, DropdownDivider, DropdownItem } from '@/components/ui/Dropdown';
import { CompanySelector } from '@/components/org/CompanySelector';

export function OrgPageHeader({
  title,
  description,
  actionLabel,
  onAction,
  actions,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Organization</p>
        <h1 className="text-xl font-bold text-primary">{title}</h1>
        <p className="text-sm text-secondary mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <CompanySelector />
        {actionLabel && onAction ? (
          <PermissionGate module="settings" action="create">
            <Button variant="primary" onClick={onAction}>
              <Plus className="h-4 w-4" /> {actionLabel}
            </Button>
          </PermissionGate>
        ) : null}
      </div>
    </div>
  );
}

export function OrgErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <span className="flex-1">{message}</span>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function OrgSearchInput({
  value,
  onChange,
  placeholder = 'Search…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9 h-9"
      />
    </div>
  );
}

/** Create/edit modal: Enter submits, errors from the API render above the fields. */
export function OrgFormModal({
  open,
  title,
  description,
  submitLabel,
  saving,
  error,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  submitLabel: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="org-entity-form" disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </Button>
        </>
      }
    >
      <form id="org-entity-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {error ? <OrgErrorBanner message={error} /> : null}
        {children}
      </form>
    </Modal>
  );
}

/** Edit/Delete menu gated by settings permissions; hidden when the user can do neither. */
export function OrgRowActions({
  label,
  onEdit,
  onDelete,
  deleteBlockedReason,
  extra,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
  /** When set, Delete is disabled and the reason shown instead. */
  deleteBlockedReason?: string | null;
  extra?: ReactNode;
}) {
  const { can } = usePermissions();
  const canEdit = can('settings', 'edit');
  const canDelete = can('settings', 'delete');
  if (!canEdit && !canDelete && !extra) return null;

  return (
    <Dropdown
      width="w-56"
      trigger={
        <button
          type="button"
          aria-label={`Actions for ${label}`}
          className="text-muted hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-muted))] transition-colors"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      }
    >
      {extra}
      {canEdit ? (
        <DropdownItem icon={<Pencil className="h-4 w-4" />} onClick={onEdit}>
          Edit
        </DropdownItem>
      ) : null}
      {canDelete ? (
        <>
          {canEdit || extra ? <DropdownDivider /> : null}
          <DropdownItem
            icon={<Trash2 className="h-4 w-4" />}
            onClick={onDelete}
            disabled={Boolean(deleteBlockedReason)}
            description={deleteBlockedReason ?? undefined}
          >
            Delete
          </DropdownItem>
        </>
      ) : null}
    </Dropdown>
  );
}

export function OrgTableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <div className="divide-y divide-[rgb(var(--border-base))]" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 px-5 py-3.5">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? 'w-40' : 'w-24'} ${c > 1 ? 'hidden sm:block' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function UsageBadge({ count, noun }: { count: number | null; noun: string }) {
  if (count === null) return <span className="text-muted">—</span>;
  return (
    <span className={count > 0 ? 'text-primary' : 'text-muted'}>
      {count} {noun}
      {count === 1 ? '' : 's'}
    </span>
  );
}
