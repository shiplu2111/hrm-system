import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronRight,
  Grid3X3,
  Loader2,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  ShieldX,
  Users,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type { EmployeeCertificationRecord, EmployeeRecord, TrainingCourseRecord } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Select } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { SummaryTile } from '@/components/ui/SummaryTile';
import { Avatar } from '@/components/ui/Toggle';
import { Banner, errorMessage } from '@/components/performance/performance-ui';
import { CertificationFormModal, type CertificationFormMode } from '@/components/training/CertificationFormModal';
import {
  EmployeeCertificationsPanel,
  type CertificationActions,
  type CertificationHolder,
} from '@/components/training/EmployeeCertificationsPanel';
import { RevokeCertificationModal } from '@/components/training/RevokeCertificationModal';
import {
  certificationExpiryText,
  certificationTone,
  compareCertificationUrgency,
} from '@/components/training/training-ui';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { formatDateOnly } from '@/lib/currency-display';
import { listEmployees } from '@/lib/employees-api';
import { deleteCertification, listCertifications, listTrainingCourses, updateCertification } from '@/lib/training-api';

type OverallState = 'expired' | 'expiring_soon' | 'valid' | 'none';
type StateFilter = 'all' | 'attention' | OverallState;

const OVERALL_RANK: Record<OverallState, number> = { expired: 0, expiring_soon: 1, valid: 2, none: 3 };

interface TrackerRow {
  employee: EmployeeRecord;
  /** Held certificates: not renewed and not revoked, most urgent first. */
  current: EmployeeCertificationRecord[];
  state: OverallState;
}

const MAX_CHIPS = 4;

function isCurrent(row: EmployeeCertificationRecord): boolean {
  return !row.supersededById && row.expiryState !== 'revoked';
}

function overallState(current: EmployeeCertificationRecord[]): OverallState {
  if (current.length === 0) return 'none';
  if (current.some((row) => row.expiryState === 'expired')) return 'expired';
  if (current.some((row) => row.expiryState === 'expiring_soon')) return 'expiring_soon';
  return 'valid';
}

function matchesState(state: OverallState, filter: StateFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'attention') return state === 'expired' || state === 'expiring_soon';
  return state === filter;
}

const LEGEND = [
  { dot: 'bg-success-500', label: 'Valid' },
  { dot: 'bg-warning-500', label: 'Expires within 30 days' },
  { dot: 'bg-error-500', label: 'Expired' },
  { dot: 'bg-slate-400', label: 'Renewed or revoked (in the employee’s history)' },
];

export function TrainingCertificationsPage() {
  const { companyId } = useCompany();
  const { navigate } = useNav();
  const { can } = usePermissions();
  const canCreate = can('training', 'create');
  const canEdit = can('training', 'edit');
  const [searchParams, setSearchParams] = useSearchParams();

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [certifications, setCertifications] = useState<EmployeeCertificationRecord[]>([]);
  const [courses, setCourses] = useState<TrainingCourseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [certName, setCertName] = useState('');
  const [includeFormer, setIncludeFormer] = useState(false);

  const [formMode, setFormMode] = useState<CertificationFormMode | null>(null);
  const [revoking, setRevoking] = useState<EmployeeCertificationRecord | null>(null);
  const [reinstating, setReinstating] = useState<EmployeeCertificationRecord | null>(null);
  const [deleting, setDeleting] = useState<EmployeeCertificationRecord | null>(null);

  const panelEmployeeId = searchParams.get('employee');

  const reloadCertifications = useCallback(async () => {
    if (!companyId) return;
    setCertifications(await listCertifications(companyId));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    Promise.all([listEmployees(companyId), listCertifications(companyId), listTrainingCourses(companyId)])
      .then(([employeeRows, certificationRows, courseRows]) => {
        setEmployees(employeeRows);
        setCertifications(certificationRows);
        setCourses(courseRows);
      })
      .catch((err) => setError(errorMessage(err, 'Couldn’t load certifications')))
      .finally(() => setLoading(false));
  }, [companyId]);

  const refresh = () =>
    void reloadCertifications().catch((err) => setError(errorMessage(err, 'Couldn’t refresh certifications')));

  /** Employees who can be given certificates. */
  const currentEmployees = useMemo(
    () =>
      employees
        .filter((row) => row.employmentStatus !== 'terminated')
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [employees],
  );
  const trackedEmployees = useMemo(
    () =>
      includeFormer ? [...employees].sort((a, b) => a.fullName.localeCompare(b.fullName)) : currentEmployees,
    [includeFormer, employees, currentEmployees],
  );
  const formerCount = employees.length - currentEmployees.length;

  const certsByEmployee = useMemo(() => {
    const map = new Map<string, EmployeeCertificationRecord[]>();
    for (const row of certifications) {
      const list = map.get(row.employeeId) ?? [];
      list.push(row);
      map.set(row.employeeId, list);
    }
    return map;
  }, [certifications]);

  const rows = useMemo<TrackerRow[]>(
    () =>
      trackedEmployees.map((employee) => {
        const current = (certsByEmployee.get(employee.id) ?? []).filter(isCurrent).sort(compareCertificationUrgency);
        return { employee, current, state: overallState(current) };
      }),
    [trackedEmployees, certsByEmployee],
  );

  const departments = useMemo(
    () =>
      [...new Set(trackedEmployees.map((row) => row.department?.name).filter((v): v is string => !!v))].sort(),
    [trackedEmployees],
  );
  const knownNames = useMemo(
    () => [...new Set(certifications.map((row) => row.name))].sort((a, b) => a.localeCompare(b)),
    [certifications],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .map((row) => {
        if (!certName) return row;
        const current = row.current.filter((cert) => cert.name === certName);
        return { ...row, current, state: overallState(current) };
      })
      .filter(
        (row) =>
          matchesState(row.state, stateFilter) &&
          (!department || row.employee.department?.name === department) &&
          (!term ||
            `${row.employee.fullName} ${row.employee.employeeNumber} ${row.current.map((c) => c.name).join(' ')}`
              .toLowerCase()
              .includes(term)),
      )
      .sort(
        (a, b) =>
          OVERALL_RANK[a.state] - OVERALL_RANK[b.state] ||
          (a.current[0]?.daysUntilExpiry ?? Infinity) - (b.current[0]?.daysUntilExpiry ?? Infinity) ||
          a.employee.fullName.localeCompare(b.employee.fullName),
      );
  }, [rows, search, department, stateFilter, certName]);

  const counts = useMemo(() => {
    const current = rows.filter((row) => row.employee.employmentStatus !== 'terminated');
    const held = current.flatMap((row) => row.current);
    return {
      employees: current.length,
      valid: held.filter((row) => row.expiryState === 'valid' || row.expiryState === 'no_expiry').length,
      expiring: held.filter((row) => row.expiryState === 'expiring_soon').length,
      expired: held.filter((row) => row.expiryState === 'expired').length,
      covered: current.filter((row) => row.state === 'valid' || row.state === 'expiring_soon').length,
    };
  }, [rows]);

  const panelEmployee = panelEmployeeId ? employees.find((row) => row.id === panelEmployeeId) ?? null : null;
  const holder: CertificationHolder | null = panelEmployee
    ? {
        id: panelEmployee.id,
        name: panelEmployee.fullName,
        detail: [panelEmployee.employeeNumber, panelEmployee.department?.name, panelEmployee.designation?.name]
          .filter(Boolean)
          .join(' · '),
        canReceive: panelEmployee.employmentStatus !== 'terminated',
      }
    : null;

  const openPanel = (employeeId: string | null) =>
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        if (employeeId) next.set('employee', employeeId);
        else next.delete('employee');
        return next;
      },
      { replace: true },
    );

  const actions: CertificationActions = {
    onAdd: () => setFormMode({ kind: 'create', employeeId: panelEmployeeId ?? undefined }),
    onEdit: (record) => setFormMode({ kind: 'edit', record }),
    onRenew: (record) => setFormMode({ kind: 'renew', record }),
    onRevoke: setRevoking,
    onReinstate: setReinstating,
    onDelete: setDeleting,
    onFileChanged: (_, message) => {
      setNotice(message);
      refresh();
    },
  };

  if (!companyId) {
    return <div className="p-6 text-sm text-secondary">Select a company to track certifications.</div>;
  }

  const filtersActive = !!(search || department || certName || stateFilter !== 'all' || includeFormer);
  const clearFilters = () => {
    setSearch('');
    setDepartment('');
    setCertName('');
    setStateFilter('all');
    setIncludeFormer(false);
  };
  const replacedByDeleting = deleting ? certifications.filter((row) => row.supersededById === deleting.id) : [];

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-bold text-primary">Certification tracker</h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            Every employee’s certificates and when they expire. Open an employee to add, renew or revoke a
            certificate.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate('training-skills')}>
            <Grid3X3 className="h-4 w-4" /> Skill matrix
          </Button>
          {canCreate ? (
            <Button onClick={() => setFormMode({ kind: 'create' })}>
              <Plus className="h-4 w-4" /> Add certification
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <Banner icon={AlertCircle} tone="error">
          {error}
        </Banner>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-900 dark:bg-success-950/30 dark:text-success-300"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="success"
          value={String(counts.valid)}
          label="Valid certificates"
          hint="Not expiring in the next 30 days"
          onClick={() => setStateFilter('valid')}
        />
        <SummaryTile
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="warning"
          value={String(counts.expiring)}
          label="Expiring within 30 days"
          hint="Renew before they lapse"
          onClick={() => setStateFilter('expiring_soon')}
        />
        <SummaryTile
          icon={<ShieldX className="h-5 w-5" />}
          tone="error"
          value={String(counts.expired)}
          label="Expired"
          hint="Not yet renewed"
          onClick={() => setStateFilter('expired')}
        />
        <SummaryTile
          icon={<Users className="h-5 w-5" />}
          tone="accent"
          value={`${counts.covered} / ${counts.employees}`}
          label="Employees covered"
          hint={`${counts.employees - counts.covered} without an in-date certificate`}
          onClick={() => setStateFilter('none')}
        />
      </div>

      <section className="surface rounded-xl border border-base shadow-card">
        <div className="flex flex-col gap-2 border-b border-base p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder="Search employees or certificates"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search employees or certificates"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
            <Select className="lg:w-44" value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department">
              <option value="">All departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Select className="lg:w-52" value={certName} onChange={(e) => setCertName(e.target.value)} aria-label="Certificate">
              <option value="">All certificates</option>
              {knownNames.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Select
              className="lg:w-48"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as StateFilter)}
              aria-label="Expiry status"
            >
              <option value="all">Any status</option>
              <option value="attention">Needs attention</option>
              <option value="expired">Expired</option>
              <option value="expiring_soon">Expiring within 30 days</option>
              <option value="valid">All in date</option>
              <option value="none">{certName ? 'Doesn’t hold it' : 'No certificates'}</option>
            </Select>
            {formerCount > 0 ? (
              <label className="flex items-center gap-2 whitespace-nowrap px-1 text-sm text-secondary">
                <input type="checkbox" checked={includeFormer} onChange={(e) => setIncludeFormer(e.target.checked)} />
                Include former employees
              </label>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-base px-5 py-2 text-xs text-secondary">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span aria-hidden className={`h-2 w-2 rounded-full ${item.dot}`} />
              {item.label}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-secondary">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading certifications…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <Award className="h-8 w-8 text-muted" />
            <p className="text-sm text-secondary">
              {trackedEmployees.length === 0
                ? 'No employees yet. Add employees before recording their certificates.'
                : certifications.length === 0
                  ? 'No certificates recorded yet.'
                  : 'No employees match the filters.'}
            </p>
            {filtersActive ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : certifications.length === 0 && canCreate && trackedEmployees.length > 0 ? (
              <Button onClick={() => setFormMode({ kind: 'create' })}>
                <Plus className="h-4 w-4" /> Add certification
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-3 py-3">Certificates</th>
                  <th className="px-3 py-3">Next action</th>
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {visible.map(({ employee, current }) => {
                  const urgent = current[0];
                  const nextExpiry = current.find((cert) => cert.expiryDate);
                  return (
                    <tr
                      key={employee.id}
                      onClick={() => openPanel(employee.id)}
                      className="cursor-pointer hover:bg-[rgb(var(--bg-hover))]"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={employee.fullName} size="sm" />
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="text-left font-medium text-primary hover:text-accent-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPanel(employee.id);
                              }}
                            >
                              {employee.fullName}
                            </button>
                            {employee.employmentStatus === 'terminated' ? (
                              <StatusPill tone="neutral" className="ml-2 align-middle">
                                Former
                              </StatusPill>
                            ) : null}
                            <p className="truncate text-xs text-muted">
                              {employee.employeeNumber}
                              {employee.department ? ` · ${employee.department.name}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {current.length === 0 ? (
                          <span className="text-xs text-muted">{certName ? `No ${certName}` : 'None on file'}</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {current.slice(0, MAX_CHIPS).map((cert) => (
                              <StatusPill key={cert.id} tone={certificationTone(cert)}>
                                <span
                                  className="flex items-center gap-1"
                                  title={`${certificationExpiryText(cert)}${cert.file ? ' · file attached' : ''}`}
                                >
                                  {cert.name}
                                  {cert.file ? <Paperclip className="h-3 w-3" aria-label="File attached" /> : null}
                                </span>
                              </StatusPill>
                            ))}
                            {current.length > MAX_CHIPS ? (
                              <span className="px-1 text-xs text-muted">+{current.length - MAX_CHIPS} more</span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {urgent && urgent.expiryState !== 'valid' && urgent.expiryState !== 'no_expiry' ? (
                          <div>
                            <p
                              className={`text-sm font-medium ${
                                urgent.expiryState === 'expired'
                                  ? 'text-error-700 dark:text-error-300'
                                  : 'text-warning-700 dark:text-warning-300'
                              }`}
                            >
                              {urgent.expiryState === 'expired' ? 'Renew' : 'Plan renewal'} · {urgent.name}
                            </p>
                            <p className="text-xs text-muted">{certificationExpiryText(urgent)}</p>
                          </div>
                        ) : urgent ? (
                          <p className="text-xs text-secondary">
                            {nextExpiry?.expiryDate
                              ? `Next expiry ${formatDateOnly(nextExpiry.expiryDate)} · ${nextExpiry.name}`
                              : 'Nothing expires'}
                          </p>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EmployeeCertificationsPanel
        holder={holder}
        certifications={panelEmployeeId ? certsByEmployee.get(panelEmployeeId) ?? [] : []}
        canCreate={canCreate}
        canEdit={canEdit}
        actions={actions}
        onClose={() => openPanel(null)}
      />

      <CertificationFormModal
        mode={formMode}
        companyId={companyId}
        employees={currentEmployees}
        courses={courses}
        knownNames={knownNames}
        canAttachFile={canEdit}
        onClose={() => setFormMode(null)}
        onSaved={(_, message) => {
          setFormMode(null);
          setNotice(message);
          refresh();
        }}
      />

      <RevokeCertificationModal
        certification={revoking}
        onClose={() => setRevoking(null)}
        onRevoked={(row) => {
          setRevoking(null);
          setNotice(`${row.name} revoked for ${row.employeeName}.`);
          refresh();
        }}
      />

      <ConfirmDialog
        open={reinstating != null}
        title="Reinstate certification?"
        description={
          reinstating
            ? `${reinstating.name} will count as held by ${reinstating.employeeName} again, with its original dates. The revocation note stays in its history.`
            : undefined
        }
        confirmLabel="Reinstate"
        tone="primary"
        onConfirm={async () => {
          if (!reinstating) return;
          const row = await updateCertification(reinstating.id, { status: 'active' });
          setNotice(`${row.name} reinstated for ${row.employeeName}.`);
          refresh();
        }}
        onClose={() => setReinstating(null)}
      />

      <ConfirmDialog
        open={deleting != null}
        title="Delete certification?"
        description={
          deleting
            ? `${deleting.name} will be removed from ${deleting.employeeName}’s record. ${
                replacedByDeleting.length > 0
                  ? 'The certificate it renewed becomes current again. '
                  : ''
              }Use Revoke instead if you need to keep it on record.`
            : undefined
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return;
          await deleteCertification(deleting.id);
          setNotice(`${deleting.name} deleted.`);
          refresh();
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
