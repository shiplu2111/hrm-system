import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, FileSignature, Loader2, Plus, X } from 'lucide-react';
import type { EmploymentContractRecord } from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ContractStatusBadge, ContractTypeBadge } from '@/components/contracts/ContractBadges';
import { ContractCreateModal } from '@/components/contracts/ContractCreateModal';
import { useNav } from '@/context/NavContext';
import { pathForPage } from '@/config/routes';
import { listEmploymentContracts, PAY_FREQUENCY_LABELS } from '@/lib/contracts-api';
import {
  canRenew,
  daysUntil,
  formatContractDate,
  formatContractPay,
  formatOvertimeRule,
  relativeDays,
} from '@/lib/contract-form';
import { ApiError } from '@/lib/tenant-api-client';

interface EmployeeProfileContractsTabProps {
  employeeId: string;
  employeeName: string;
  companyId: string;
}

/** The contract currently governing employment: active first, then the latest pending/draft. */
function currentContract(contracts: EmploymentContractRecord[]): EmploymentContractRecord | undefined {
  return contracts.find((c) => c.status === 'active') ?? contracts.find((c) => c.status === 'draft');
}

export function EmployeeProfileContractsTab({ employeeId, employeeName, companyId }: EmployeeProfileContractsTabProps) {
  const { openContract } = useNav();
  const routerNavigate = useNavigate();
  const canCreate = usePermission('employee', 'create');
  const [contracts, setContracts] = useState<EmploymentContractRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listEmploymentContracts(companyId, { employeeId });
      setContracts(rows.sort((a, b) => b.startDate.localeCompare(a.startDate)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load contracts');
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = useMemo(() => currentContract(contracts), [contracts]);
  const remaining = current?.status === 'active' ? daysUntil(current.endDate) : null;
  const expiring =
    remaining !== null && (remaining < 0 || current?.displayStatus === 'expiring_soon');
  const renewable = !!current && canCreate && canRenew(current, contracts);

  if (loading && contracts.length === 0) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (error && contracts.length === 0) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle className="h-6 w-6 text-error-500" />
          <p className="text-sm text-secondary">{error}</p>
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <div role="status" className="flex items-start gap-2 text-sm text-warning-800 dark:text-warning-300 bg-warning-50 dark:bg-warning-950/30 border border-warning-200 dark:border-warning-800/60 rounded-lg px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {contracts.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={FileSignature}
            title="No employment contract on file"
            description="Record this employee's contract so pay, leave, overtime and notice rules are tracked."
            action={canCreate ? { label: 'New contract', icon: Plus, onClick: () => setCreateOpen(true) } : undefined}
          />
        </Card>
      ) : (
        <>
          {current ? (
            <Card>
              <CardHeader className="flex items-center justify-between gap-3">
                <CardTitle>Current contract</CardTitle>
                <div className="flex gap-2">
                  {renewable ? (
                    <Button
                      variant={expiring ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() =>
                        routerNavigate(`${pathForPage('emp-contract-detail', { contractId: current.id })}?action=renew`)
                      }
                    >
                      Renew
                    </Button>
                  ) : null}
                  <Button variant="secondary" size="sm" onClick={() => openContract(current.id)}>
                    Open contract
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                {expiring ? (
                  <div className="flex items-start gap-2 text-sm text-warning-800 dark:text-warning-300 bg-warning-50 dark:bg-warning-950/30 border border-warning-200 dark:border-warning-800/60 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      {remaining < 0 ? 'Ended' : 'Ends'} {relativeDays(remaining)} ({formatContractDate(current.endDate)}).
                      {renewable ? ' Renew it so the employee stays covered.' : ''}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center gap-2 flex-wrap">
                  <ContractTypeBadge type={current.contractType} />
                  <ContractStatusBadge status={current.displayStatus} />
                </div>
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <dt className="text-xs text-muted">Term</dt>
                    <dd className="text-sm text-primary">
                      {formatContractDate(current.startDate)} – {formatContractDate(current.endDate, 'open-ended')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Pay</dt>
                    <dd className="text-sm text-primary">
                      {formatContractPay(current)}
                      {current.payFrequency ? (
                        <span className="text-xs text-muted"> · {PAY_FREQUENCY_LABELS[current.payFrequency]}</span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Leave & overtime</dt>
                    <dd className="text-sm text-primary">
                      {current.leaveEntitlementDays != null ? `${current.leaveEntitlementDays} days/year` : '—'}
                      <span className="block text-xs text-muted">{formatOvertimeRule(current.overtimeRule)}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Notice</dt>
                    <dd className="text-sm text-primary">
                      {current.noticePeriodDays != null ? `${current.noticePeriodDays} days` : '—'}
                      {current.employerNoticeDays != null ? (
                        <span className="block text-xs text-muted">Employer: {current.employerNoticeDays} days</span>
                      ) : null}
                    </dd>
                  </div>
                </dl>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>All contracts</CardTitle>
              {canCreate ? (
                <Button variant="secondary" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> New contract
                </Button>
              ) : null}
            </CardHeader>
            <CardBody className="p-0">
              <ul className="divide-y divide-[rgb(var(--border-base))]">
                {contracts.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openContract(c.id)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-[rgb(var(--bg-hover))] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-primary">
                          {formatContractDate(c.startDate)} – {formatContractDate(c.endDate, 'open-ended')}
                          {c.id === current?.id ? <span className="text-xs text-muted"> · current</span> : null}
                        </div>
                        <div className="text-xs text-muted truncate">
                          {formatContractPay(c)} · {c.documents.length}{' '}
                          {c.documents.length === 1 ? 'document' : 'documents'}
                          {c.renewedFromId ? ' · renewal' : ''}
                        </div>
                      </div>
                      <ContractTypeBadge type={c.contractType} />
                      <ContractStatusBadge status={c.displayStatus} />
                      <ChevronRight className="h-4 w-4 text-muted shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </>
      )}

      <ContractCreateModal
        open={createOpen}
        companyId={companyId}
        employee={{ id: employeeId, fullName: employeeName }}
        template={current ?? contracts[0]}
        onClose={() => setCreateOpen(false)}
        onCreated={(created, warning) => {
          setCreateOpen(false);
          if (warning) {
            setNotice(warning);
            void load();
          } else {
            openContract(created.id);
          }
        }}
      />
    </div>
  );
}
