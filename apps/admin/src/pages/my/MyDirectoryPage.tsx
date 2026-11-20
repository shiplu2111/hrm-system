import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Mail, MapPin, Phone, Search, ShieldCheck, Users } from 'lucide-react';
import type { EmployeeDirectoryEntry } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Form';
import { Skeleton } from '@/components/ui/Skeleton';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { useMyEmployee } from '@/components/my/useMyEmployee';
import { listColleagues } from '@/lib/my-api';
import { ApiError } from '@/lib/tenant-api-client';

export function MyDirectoryPage() {
  const { t } = useAppTranslation();
  const { employeeId, companyId, loading: empLoading, error: empError } = useMyEmployee();

  const [colleagues, setColleagues] = useState<EmployeeDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  useEffect(() => {
    if (empLoading) return;
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    listColleagues(companyId)
      .then((rows) => {
        if (!cancelled) setColleagues(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : t('errors.loadEmployeeData'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, empLoading, t]);

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of colleagues) {
      if (c.department) map.set(c.department.id, c.department.name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [colleagues]);

  const locations = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of colleagues) {
      if (c.workLocation) map.set(c.workLocation.id, c.workLocation.name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [colleagues]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return colleagues.filter((c) => {
      if (departmentFilter !== 'all' && c.department?.id !== departmentFilter) return false;
      if (locationFilter !== 'all' && c.workLocation?.id !== locationFilter) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        (c.designation?.name.toLowerCase().includes(q) ?? false) ||
        (c.department?.name.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [colleagues, search, departmentFilter, locationFilter]);

  const hasFilters = Boolean(search.trim()) || departmentFilter !== 'all' || locationFilter !== 'all';

  return (
    <MyPageLayout
      title={t('directory.title')}
      subtitle={t('directory.subtitle')}
      loading={empLoading}
      error={empError ?? error}
    >
      {companyId ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3.5 py-2.5 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
            <span>{t('directory.privacyNotice')}</span>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('directory.searchPlaceholder')}
                aria-label={t('directory.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <Select
              value={departmentFilter}
              aria-label={t('directory.allDepartments')}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">{t('directory.allDepartments')}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Select
              value={locationFilter}
              aria-label={t('directory.allLocations')}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="all">{t('directory.allLocations')}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </Select>
          </div>

          {!loading && (
            <div className="text-xs font-medium text-muted">
              {t('directory.colleagueCount', { count: filtered.length })}
            </div>
          )}

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Card key={i}>
                  <CardBody className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-3 w-44" />
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={Users}
                title={t('directory.empty')}
                action={
                  hasFilters
                    ? {
                        label: t('directory.clearFilters'),
                        onClick: () => {
                          setSearch('');
                          setDepartmentFilter('all');
                          setLocationFilter('all');
                        },
                      }
                    : undefined
                }
                compact
              />
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((colleague) => {
                const initials =
                  `${colleague.firstName[0] ?? ''}${colleague.lastName[0] ?? ''}`.toUpperCase() ||
                  '?';
                const isSelf = colleague.id === employeeId;
                return (
                  <Card key={colleague.id}>
                    <CardBody className="space-y-3 text-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-semibold text-accent-700 dark:bg-accent-950/50 dark:text-accent-300">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate font-semibold text-primary">
                              {colleague.fullName}
                            </span>
                            {isSelf && <Badge tone="accent">{t('directory.youBadge')}</Badge>}
                          </div>
                          <div className="truncate text-xs text-secondary">
                            {colleague.designation?.name ?? t('directory.noDesignation')}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 border-t border-base pt-2.5 text-xs">
                        <div className="flex items-center gap-1.5 text-secondary">
                          <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted" />
                          <span className="truncate">
                            {colleague.department?.name ?? t('directory.noDepartment')}
                          </span>
                        </div>
                        {colleague.workLocation?.name && (
                          <div className="flex items-center gap-1.5 text-secondary">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted" />
                            <span className="truncate">{colleague.workLocation.name}</span>
                          </div>
                        )}
                        {colleague.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-muted" />
                            <a
                              href={`mailto:${colleague.email}`}
                              className="truncate text-accent-600 hover:underline dark:text-accent-400"
                            >
                              {colleague.email}
                            </a>
                          </div>
                        ) : !colleague.phone ? (
                          <div className="text-muted">{t('directory.noContact')}</div>
                        ) : null}
                        {colleague.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-muted" />
                            <a
                              href={`tel:${colleague.phone}`}
                              className="truncate text-accent-600 hover:underline dark:text-accent-400"
                            >
                              {colleague.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </MyPageLayout>
  );
}

