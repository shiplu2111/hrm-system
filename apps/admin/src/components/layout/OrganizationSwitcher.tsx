import { useMemo, useState } from 'react';
import { Building2, Check, ChevronDown, Loader2, Search } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import {
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
} from '@/components/ui/Dropdown';

function orgInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function OrgLogo({
  name,
  logoUrl,
  size = 'md',
}: {
  name: string;
  logoUrl?: string | null;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${dim} rounded-md object-cover shrink-0 border border-base`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-md bg-accent-600 flex items-center justify-center shrink-0 text-white text-xs font-semibold`}
    >
      {orgInitials(name) || <Building2 className="h-4 w-4" />}
    </div>
  );
}

function OrgDisplay({
  name,
  logoUrl,
  loading,
  interactive,
}: {
  name: string;
  logoUrl?: string | null;
  loading?: boolean;
  interactive?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg min-w-0 max-w-[220px] ${
        interactive
          ? 'hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer'
          : ''
      }`}
    >
      <OrgLogo name={name} logoUrl={logoUrl} />
      <div className="hidden sm:flex flex-col leading-tight text-left min-w-0">
        <span className="text-sm font-semibold text-primary truncate">
          {loading ? 'Loading…' : name}
        </span>
        <span className="text-[10px] text-muted">Organization</span>
      </div>
      {interactive && (
        <ChevronDown className="h-4 w-4 text-muted shrink-0 hidden sm:block" />
      )}
    </div>
  );
}

export function OrganizationSwitcher({
  onSwitched,
}: {
  onSwitched?: () => void;
}) {
  const { memberships, current, loading, switching, switchOrganization } =
    useTenant();
  const [query, setQuery] = useState('');

  const canSwitch = memberships.length > 1;
  const displayName = current?.tenantName ?? 'Organization';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return memberships;
    return memberships.filter(
      (m) =>
        m.tenantName.toLowerCase().includes(q) ||
        m.subdomain.toLowerCase().includes(q),
    );
  }, [memberships, query]);

  const handleSelect = async (tenantId: string) => {
    if (current?.tenantId === tenantId || switching) return;
    await switchOrganization(tenantId);
    setQuery('');
    onSwitched?.();
  };

  if (!canSwitch) {
    return (
      <div
        className="shrink-0"
        title={displayName}
        aria-label={`Current organization: ${displayName}`}
      >
        <OrgDisplay
          name={displayName}
          logoUrl={current?.logoUrl}
          loading={loading}
        />
      </div>
    );
  }

  return (
    <Dropdown
      width="w-72"
      align="right"
      onOpenChange={(open) => {
        if (!open) setQuery('');
      }}
      trigger={
        <div className="relative shrink-0" aria-label="Switch organization">
          <OrgDisplay
            name={displayName}
            logoUrl={current?.logoUrl}
            loading={loading || switching}
            interactive
          />
          {switching && (
            <Loader2 className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-accent-600 sm:hidden" />
          )}
        </div>
      }
    >
      <DropdownHeader>
        <div className="text-xs font-semibold text-muted uppercase tracking-wider">
          Switch organization
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search organizations…"
            className="w-full h-8 pl-8 pr-2 rounded-md border border-base surface text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </DropdownHeader>
      <DropdownDivider />
      <div className="max-h-64 overflow-y-auto scrollbar-thin py-1">
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-sm text-muted text-center">
            No organizations match your search
          </div>
        )}
        {filtered.map((m) => (
          <DropdownItem
            key={m.tenantId}
            active={m.isCurrent}
            onClick={() => void handleSelect(m.tenantId)}
          >
            <OrgLogo name={m.tenantName} logoUrl={m.logoUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{m.tenantName}</div>
              <div className="text-[10px] text-muted truncate">
                {m.subdomain} · {m.roleName}
              </div>
            </div>
            {m.isCurrent && (
              <Check className="h-4 w-4 text-accent-600 shrink-0" />
            )}
          </DropdownItem>
        ))}
      </div>
    </Dropdown>
  );
}
