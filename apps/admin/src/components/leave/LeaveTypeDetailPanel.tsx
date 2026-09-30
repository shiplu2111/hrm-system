import type { ReactNode } from 'react';
import { CalendarPlus, Pencil, Palmtree } from 'lucide-react';
import { usePermission } from '@hrm/portal-ui';
import {
  findEffectiveLeavePolicy,
  type LeavePolicyRecord,
  type LeaveTypeRecord,
} from '@hrm/shared-types';
import { SidePanel } from '@/components/ui/SidePanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  accrualSummary,
  approverLabel,
  carryForwardSummary,
  formatDays,
  formatIsoDate,
  negativeBalanceSummary,
  policyVersionStatus,
  todayIso,
  type PolicyVersionStatus,
} from '@/lib/leave-policy';

const STATUS_BADGE: Record<PolicyVersionStatus, { tone: 'success' | 'info' | 'neutral'; label: string }> = {
  current: { tone: 'success', label: 'In effect' },
  scheduled: { tone: 'info', label: 'Scheduled' },
  ended: { tone: 'neutral', label: 'Ended' },
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-5 gap-3 py-2">
      <dt className="col-span-2 text-xs text-muted">{label}</dt>
      <dd className="col-span-3 text-sm text-primary">{children}</dd>
    </div>
  );
}

export function PolicySummary({ policy }: { policy: LeavePolicyRecord }) {
  const yesNo = (v: boolean) => (v ? 'Yes' : 'No');
  return (
    <dl className="divide-y divide-[rgb(var(--border-base))]">
      <Row label="Entitlement">{formatDays(policy.entitlementDays)} per year</Row>
      <Row label="Accrual">{accrualSummary(policy)}</Row>
      <Row label="Carry-forward">{carryForwardSummary(policy)}</Row>
      <Row label="Encashment">{policy.encashmentAllowed ? 'Allowed' : 'Not allowed'}</Row>
      <Row label="Half-day requests">{yesNo(policy.halfDayAllowed)}</Row>
      <Row label="During probation">{policy.probationRestricted ? 'Blocked' : 'Allowed'}</Row>
      <Row label="Negative balance">{negativeBalanceSummary(policy)}</Row>
      <Row label="Public holidays">
        {policy.deductPublicHolidays ? 'Counted as leave' : 'Not deducted'}
      </Row>
      <Row label="Approval chain">
        {policy.approvalSteps.length
          ? policy.approvalSteps.map((s) => approverLabel(s.roleName)).join(' → ')
          : '—'}
      </Row>
    </dl>
  );
}

export function LeaveTypeDetailPanel({
  open,
  leaveType,
  policies,
  onClose,
  onEditVersion,
  onNewVersion,
}: {
  open: boolean;
  leaveType: LeaveTypeRecord | null;
  /** All versions for this leave type. */
  policies: LeavePolicyRecord[];
  onClose: () => void;
  onEditVersion: (policy: LeavePolicyRecord) => void;
  onNewVersion: () => void;
}) {
  const canEdit = usePermission('settings', 'edit');
  const canCreate = usePermission('settings', 'create');
  if (!leaveType) return null;

  const today = todayIso();
  const current = findEffectiveLeavePolicy(policies, leaveType.id, today);
  const versions = [...policies].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const requests = leaveType.usage?.requests ?? 0;

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={leaveType.name}
      description={`${leaveType.isPaid ? 'Paid' : 'Unpaid'} leave · ${requests} request${requests === 1 ? '' : 's'} on record`}
      size="lg"
    >
      <div className="space-y-7">
        <section>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <h3 className="text-sm font-semibold text-primary">Policy in effect today</h3>
              {current ? (
                <p className="text-xs text-muted mt-0.5">
                  Since {formatIsoDate(current.effectiveFrom)}
                  {current.effectiveTo ? ` until ${formatIsoDate(current.effectiveTo)}` : ''}
                </p>
              ) : null}
            </div>
            {current && canEdit ? (
              <Button variant="secondary" size="sm" onClick={() => onEditVersion(current)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            ) : null}
          </div>
          {current ? (
            <PolicySummary policy={current} />
          ) : (
            <EmptyState
              compact
              icon={Palmtree}
              title="No policy in effect"
              description="Employees accrue no balance for this leave type until a policy version covers today."
              action={canCreate ? { label: 'Add policy version', onClick: onNewVersion } : undefined}
            />
          )}
        </section>

        {versions.length > 0 ? (
          <section>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="text-sm font-semibold text-primary">Version history</h3>
              {canCreate ? (
                <Button variant="secondary" size="sm" onClick={onNewVersion}>
                  <CalendarPlus className="h-3.5 w-3.5" /> New policy version
                </Button>
              ) : null}
            </div>
            <ol className="space-y-2">
              {versions.map((v) => {
                const status = STATUS_BADGE[policyVersionStatus(v, today)];
                return (
                  <li
                    key={v.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-base px-4 py-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-primary">
                          {formatIsoDate(v.effectiveFrom)} – {v.effectiveTo ? formatIsoDate(v.effectiveTo) : 'open-ended'}
                        </span>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      <p className="text-xs text-secondary">
                        {formatDays(v.entitlementDays)}/yr · {accrualSummary(v)} · Carry-forward:{' '}
                        {carryForwardSummary(v).toLowerCase()}
                      </p>
                    </div>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => onEditVersion(v)}
                        aria-label={`Edit version from ${formatIsoDate(v.effectiveFrom)}`}
                        className="p-1.5 rounded text-muted hover:text-primary hover:bg-[rgb(var(--bg-hover))] shrink-0"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}
      </div>
    </SidePanel>
  );
}
