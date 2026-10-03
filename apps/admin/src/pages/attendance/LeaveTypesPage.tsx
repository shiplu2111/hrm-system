import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Eye, Palmtree, Plus } from 'lucide-react';
import { PermissionGate, usePermission } from '@hrm/portal-ui';
import {
  findEffectiveLeavePolicy,
  type LeavePolicyRecord,
  type LeaveTypeRecord,
} from '@hrm/shared-types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import { DataTable, DataTableBody, DataTableHead } from '@/components/ui/DataTable';
import { DropdownItem } from '@/components/ui/Dropdown';
import { CompanySelector } from '@/components/org/CompanySelector';
import {
  OrgErrorBanner,
  OrgFormModal,
  OrgRowActions,
  OrgSearchInput,
  OrgTableSkeleton,
} from '@/components/org/OrgScreenParts';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { LeavePolicyPanel, type LeavePolicyPanelMode } from '@/components/leave/LeavePolicyPanel';
import { LeaveTypeDetailPanel } from '@/components/leave/LeaveTypeDetailPanel';
import { useCompany } from '@/context/CompanyContext';
import { useOrgForm } from '@/hooks/useOrgForm';
import { deleteLeaveType, listLeavePolicies, listLeaveTypes, updateLeaveType } from '@/lib/leave-api';
import {
  accrualSummary,
  carryForwardSummary,
  formatDays,
  formatIsoDate,
  todayIso,
} from '@/lib/leave-policy';
import { listTenantRoles } from '@/lib/roles-api';
import { ApiError } from '@/lib/tenant-api-client';

type TypeForm = { name: string; isPaid: boolean };

function RuleBadges({ policy }: { policy: LeavePolicyRecord }) {
  const rules = [
    policy.halfDayAllowed && 'Half-day',
    policy.encashmentAllowed && 'Encashable',
    policy.allowNegativeBalance &&
      (policy.negativeBalanceCap !== null ? `Negative to −${policy.negativeBalanceCap}` : 'Negative'),
    policy.probationRestricted && 'Blocked in probation',
  ].filter((r): r is string => Boolean(r));
  if (rules.length === 0) return <span className="text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {rules.map((r) => (
        <Badge key={r}>{r}</Badge>
      ))}
    </div>
  );
}

export function LeaveTypesPage() {
  const { companyId, loading: companyLoading, error: companyError } = useCompany();

  if (companyLoading) return <PageLoadingState message="Loading company…" />;
  if (companyError) return <PageErrorState error={companyError} />;
  if (!companyId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">No company found for this tenant.</div>
    );
  }
  return <LeaveTypesScreen key={companyId} companyId={companyId} />;
}

function LeaveTypesScreen({ companyId }: { companyId: string }) {
  const canCreate = usePermission('settings', 'create');
  const canEdit = usePermission('settings', 'edit');
  const [types, setTypes] = useState<LeaveTypeRecord[]>([]);
  const [policies, setPolicies] = useState<LeavePolicyRecord[]>([]);
  const [roleNames, setRoleNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [detailTypeId, setDetailTypeId] = useState<string | null>(null);
  const [policyPanel, setPolicyPanel] = useState<LeavePolicyPanelMode | null>(null);
  const [editingType, setEditingType] = useState<LeaveTypeRecord | null>(null);
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeSaveError, setTypeSaveError] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState<LeaveTypeRecord | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [typeRows, policyRows] = await Promise.all([
        listLeaveTypes(companyId),
        listLeavePolicies(companyId),
      ]);
      setTypes(typeRows);
      setPolicies(policyRows);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load leave types');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canCreate && !canEdit) return;
    listTenantRoles()
      .then((roles) => setRoleNames(roles.map((r) => r.name)))
      .catch(() => setRoleNames([]));
  }, [canCreate, canEdit]);

  const today = todayIso();
  const policiesByType = useMemo(() => {
    const map = new Map<string, LeavePolicyRecord[]>();
    for (const p of policies) map.set(p.leaveTypeId, [...(map.get(p.leaveTypeId) ?? []), p]);
    return map;
  }, [policies]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return types.filter((t) => !q || t.name.toLowerCase().includes(q));
  }, [types, search]);

  const versionsFor = (typeId: string) => policiesByType.get(typeId) ?? [];
  const latestFrom = (typeId: string) =>
    versionsFor(typeId).reduce<string | null>(
      (max, p) => (max === null || p.effectiveFrom > max ? p.effectiveFrom : max),
      null,
    );

  const openNewVersion = (type: LeaveTypeRecord) => {
    const versions = versionsFor(type.id);
    const latest = latestFrom(type.id);
    setDetailTypeId(null);
    setPolicyPanel({
      kind: 'new-version',
      leaveType: type,
      basedOn: versions.find((p) => p.effectiveFrom === latest) ?? null,
      latestEffectiveFrom: latest,
    });
  };

  const openEditVersion = (type: LeaveTypeRecord, policy: LeavePolicyRecord) => {
    setDetailTypeId(null);
    setPolicyPanel({ kind: 'edit-version', leaveType: type, policy });
  };

  const closePolicyPanel = () => {
    const typeId = policyPanel && policyPanel.kind !== 'create-type' ? policyPanel.leaveType.id : null;
    setPolicyPanel(null);
    if (typeId) setDetailTypeId(typeId);
  };

  const validateType = useCallback(
    (values: TypeForm) => {
      const name = values.name.trim();
      if (!name) return { name: 'Name is required' };
      if (name.length > 100) return { name: 'Name must be 100 characters or fewer' };
      const clash = types.some(
        (t) => t.id !== editingType?.id && t.name.trim().toLowerCase() === name.toLowerCase(),
      );
      return clash ? { name: `A leave type named "${name}" already exists` } : {};
    },
    [types, editingType],
  );
  const typeForm = useOrgForm<TypeForm>({ name: '', isPaid: true }, validateType);

  const openEditType = (type: LeaveTypeRecord) => {
    setTypeSaveError(null);
    typeForm.reset({ name: type.name, isPaid: type.isPaid });
    setEditingType(type);
  };

  const saveType = async () => {
    if (!editingType) return;
    typeForm.touchAll();
    if (!typeForm.isValid) return;
    setTypeSaving(true);
    setTypeSaveError(null);
    try {
      await updateLeaveType(companyId, editingType.id, {
        name: typeForm.values.name.trim(),
        isPaid: typeForm.values.isPaid,
      });
      setEditingType(null);
      await load();
    } catch (err) {
      setTypeSaveError(err instanceof ApiError ? err.message : 'Could not save the leave type');
    } finally {
      setTypeSaving(false);
    }
  };

  const deleteBlockedReason = (type: LeaveTypeRecord): string | null => {
    const usage = type.usage;
    if (!usage) return null;
    if (usage.requests > 0) return `Used by ${usage.requests} leave request(s)`;
    if (usage.policies > 0) return `Has ${usage.policies} policy version(s) kept for history`;
    return null;
  };

  const detailType = types.find((t) => t.id === detailTypeId) ?? null;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">Leave</p>
          <h1 className="text-xl font-bold text-primary">Leave Types & Policies</h1>
          <p className="text-sm text-secondary mt-0.5">
            Entitlement, accrual, carry-forward and request rules for each leave type.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <PermissionGate module="settings" action="create">
            <Button variant="primary" onClick={() => setPolicyPanel({ kind: 'create-type' })}>
              <Plus className="h-4 w-4" /> Add leave type
            </Button>
          </PermissionGate>
        </div>
      </div>

      {loadError ? <OrgErrorBanner message={loadError} onRetry={() => void load()} /> : null}

      <Card>
        <CardHeader>
          <OrgSearchInput value={search} onChange={setSearch} placeholder="Search leave types" />
        </CardHeader>
        {loading ? (
          <OrgTableSkeleton columns={5} />
        ) : types.length === 0 ? (
          <EmptyState
            compact
            icon={Palmtree}
            title="No leave types yet"
            description="Add Annual, Sick, Unpaid or custom leave types, each with its own entitlement and rules."
            action={
              canCreate
                ? { label: 'Add first leave type', onClick: () => setPolicyPanel({ kind: 'create-type' }), icon: Plus }
                : undefined
            }
          />
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">No leave types match “{search}”.</p>
        ) : (
          <DataTable>
            <DataTableHead>
              <tr className="text-left text-xs font-semibold text-secondary uppercase tracking-wide">
                <th className="px-5 py-2.5">Leave type</th>
                <th className="px-5 py-2.5">Entitlement</th>
                <th className="px-5 py-2.5 hidden md:table-cell">Accrual</th>
                <th className="px-5 py-2.5 hidden lg:table-cell">Carry-forward</th>
                <th className="px-5 py-2.5 hidden xl:table-cell">Rules</th>
                <th className="px-5 py-2.5">Policy</th>
                <th className="w-12" />
              </tr>
            </DataTableHead>
            <DataTableBody>
              {visible.map((type) => {
                const versions = versionsFor(type.id);
                const current = findEffectiveLeavePolicy(versions, type.id, today);
                const nextScheduled = versions
                  .filter((p) => p.effectiveFrom > today)
                  .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
                return (
                  <tr
                    key={type.id}
                    onClick={() => setDetailTypeId(type.id)}
                    className="hover:bg-[rgb(var(--bg-hover))] cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-primary">{type.name}</span>
                        {type.isPaid ? (
                          <Badge tone="success">Paid</Badge>
                        ) : (
                          <Badge tone="neutral">Unpaid</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-secondary tabular-nums whitespace-nowrap">
                      {current ? `${formatDays(current.entitlementDays)} / yr` : '—'}
                    </td>
                    <td className="px-5 py-3 text-secondary hidden md:table-cell">
                      {current ? accrualSummary(current) : '—'}
                    </td>
                    <td className="px-5 py-3 text-secondary hidden lg:table-cell">
                      {current ? carryForwardSummary(current) : '—'}
                    </td>
                    <td className="px-5 py-3 hidden xl:table-cell">
                      {current ? <RuleBadges policy={current} /> : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {current ? (
                          <span className="text-xs text-secondary whitespace-nowrap">
                            Since {formatIsoDate(current.effectiveFrom)}
                          </span>
                        ) : nextScheduled ? (
                          <Badge tone="warning">Starts {formatIsoDate(nextScheduled.effectiveFrom)}</Badge>
                        ) : (
                          <Badge tone="warning">No policy</Badge>
                        )}
                        {current && nextScheduled ? (
                          <Badge tone="info">Changes {formatIsoDate(nextScheduled.effectiveFrom)}</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <OrgRowActions
                        label={type.name}
                        onEdit={() => openEditType(type)}
                        onDelete={() => setDeletingType(type)}
                        deleteBlockedReason={deleteBlockedReason(type)}
                        extra={
                          <>
                            <DropdownItem
                              icon={<Eye className="h-4 w-4" />}
                              onClick={() => setDetailTypeId(type.id)}
                            >
                              View policy
                            </DropdownItem>
                            {canCreate ? (
                              <DropdownItem
                                icon={<CalendarPlus className="h-4 w-4" />}
                                onClick={() => openNewVersion(type)}
                              >
                                New policy version
                              </DropdownItem>
                            ) : null}
                          </>
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </DataTableBody>
          </DataTable>
        )}
        {!loading && types.length > 0 ? (
          <p className="px-5 py-2.5 text-xs text-muted border-t border-base">
            {visible.length === types.length
              ? `${types.length} leave type${types.length === 1 ? '' : 's'}`
              : `Showing ${visible.length} of ${types.length}`}
          </p>
        ) : null}
      </Card>

      <LeaveTypeDetailPanel
        open={detailType !== null}
        leaveType={detailType}
        policies={detailType ? versionsFor(detailType.id) : []}
        onClose={() => setDetailTypeId(null)}
        onEditVersion={(policy) => detailType && openEditVersion(detailType, policy)}
        onNewVersion={() => detailType && openNewVersion(detailType)}
      />

      {policyPanel ? (
        <LeavePolicyPanel
          open
          mode={policyPanel}
          companyId={companyId}
          leaveTypes={types}
          roleNames={roleNames}
          onClose={closePolicyPanel}
          onSaved={(typeId) => {
            setPolicyPanel(null);
            void load().then(() => setDetailTypeId(typeId));
          }}
        />
      ) : null}

      <OrgFormModal
        open={editingType !== null}
        title="Edit leave type"
        submitLabel="Save changes"
        saving={typeSaving}
        error={typeSaveError}
        onClose={() => setEditingType(null)}
        onSubmit={() => void saveType()}
      >
        <div>
          <Label htmlFor="edit-leave-type-name">Name *</Label>
          <Input
            id="edit-leave-type-name"
            autoFocus
            value={typeForm.values.name}
            onChange={(e) => typeForm.setField('name', e.target.value)}
            onBlur={() => typeForm.touch('name')}
            aria-invalid={Boolean(typeForm.showError('name'))}
          />
          <FieldError message={typeForm.showError('name')} />
        </div>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-base px-4 py-3">
          <div>
            <p className="text-sm font-medium text-primary">Paid leave</p>
            <p className="text-xs text-muted mt-0.5">
              Affects how leave approved from now on feeds into payroll.
            </p>
          </div>
          <Toggle
            checked={typeForm.values.isPaid}
            onChange={(v) => typeForm.setField('isPaid', v)}
            label="Paid leave"
          />
        </div>
      </OrgFormModal>

      <ConfirmDialog
        open={deletingType !== null}
        title="Delete leave type?"
        confirmLabel="Delete leave type"
        description={
          deletingType ? (
            <>
              <span className="font-medium text-primary">{deletingType.name}</span> will be
              permanently removed.
            </>
          ) : null
        }
        onConfirm={async () => {
          if (!deletingType) return;
          await deleteLeaveType(companyId, deletingType.id);
          await load();
        }}
        onClose={() => setDeletingType(null)}
      />
    </div>
  );
}
