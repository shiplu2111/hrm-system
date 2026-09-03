import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import type { LeavePolicyRecord, LeaveTypeRecord } from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { CompanySelector } from '@/components/org/CompanySelector';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { useCompany } from '@/context/CompanyContext';
import {
  createLeavePolicy,
  createLeaveType,
  deleteLeaveType,
  listLeavePolicies,
  listLeaveTypes,
} from '@/lib/leave-api';
import { ApiError } from '@/lib/tenant-api-client';

export function LeaveTypesPage() {
  const { companyId, loading: companyLoading, error: companyError } = useCompany();
  const [types, setTypes] = useState<LeaveTypeRecord[]>([]);
  const [policies, setPolicies] = useState<LeavePolicyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [isPaid, setIsPaid] = useState(true);
  const [entitlementDays, setEntitlementDays] = useState('20');
  const [accrualType, setAccrualType] = useState<'monthly' | 'yearly' | 'on_hire'>('monthly');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [typeRows, policyRows] = await Promise.all([
        listLeaveTypes(companyId),
        listLeavePolicies(companyId),
      ]);
      setTypes(typeRows);
      setPolicies(policyRows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load leave types');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const policyForType = (leaveTypeId: string) =>
    policies.find((p) => p.leaveTypeId === leaveTypeId && !p.effectiveTo);

  async function handleCreate() {
    if (!companyId || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const type = await createLeaveType(companyId, {
        name: name.trim(),
        isPaid,
      });
      await createLeavePolicy(companyId, {
        leaveTypeId: type.id,
        entitlementDays: Number(entitlementDays) || 0,
        accrualType,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        approvalSteps: [{ roleName: 'Manager' }, { roleName: 'HR Admin' }],
      });
      setModalOpen(false);
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create leave type');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(leaveTypeId: string) {
    if (!companyId) return;
    setError(null);
    try {
      await deleteLeaveType(companyId, leaveTypeId);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete leave type');
    }
  }

  if (companyLoading) return <PageLoadingState message="Loading company…" />;
  if (companyError) return <PageErrorState error={companyError} />;
  if (!companyId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        No company found for this tenant.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Leave Types Configuration</h1>
          <p className="text-sm text-secondary mt-0.5">{types.length} leave types configured</p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add Leave Type
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Leave Type</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Entitlement</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase hidden md:table-cell">Accrual</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Paid</th>
                    <th className="w-12 px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {types.map((lt) => {
                    const policy = policyForType(lt.id);
                    return (
                      <tr key={lt.id} className="hover:bg-[rgb(var(--bg-hover))] group">
                        <td className="px-5 py-3 font-medium text-primary">{lt.name}</td>
                        <td className="px-5 py-3 text-secondary">
                          {policy ? `${policy.entitlementDays} days/yr` : '—'}
                        </td>
                        <td className="px-5 py-3 text-secondary hidden md:table-cell capitalize">
                          {policy?.accrualType ?? '—'}
                        </td>
                        <td className="px-5 py-3">
                          {lt.isPaid ? (
                            <Badge tone="success">Paid</Badge>
                          ) : (
                            <Badge tone="neutral">Unpaid</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => void handleDelete(lt.id)}
                            className="text-muted hover:text-error-600 p-1 rounded opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Leave Type"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleCreate()} disabled={saving}>
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Leave Type Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Annual Leave" />
          </div>
          <div>
            <Label>Entitlement (days/year)</Label>
            <Input value={entitlementDays} onChange={(e) => setEntitlementDays(e.target.value)} />
          </div>
          <div>
            <Label>Accrual Type</Label>
            <Select value={accrualType} onChange={(e) => setAccrualType(e.target.value as typeof accrualType)}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="on_hire">On Hire</option>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Paid leave?</Label>
            <Select value={isPaid ? 'yes' : 'no'} onChange={(e) => setIsPaid(e.target.value === 'yes')}>
              <option value="yes">Paid</option>
              <option value="no">Unpaid</option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
