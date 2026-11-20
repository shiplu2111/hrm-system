import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type {
  ContractorContractRecord,
  ContractorInvoiceLineItem,
  ContractorInvoiceRecord,
  ContractorRecord,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import {
  CONTRACTOR_PAYMENT_STRUCTURE_LABELS,
  createContractorInvoice,
  PAYMENT_TERMS_LABELS,
} from '@/lib/contractors-api';
import { ApiError } from '@/lib/tenant-api-client';
import {
  AP_PRIMARY_BUTTON_CLASS,
  computeHoursAmount,
  formatContractorMoney,
  sumMoneyStrings,
} from './contractor-ui.utils';

interface ContractorInvoiceFormModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  contractors: ContractorRecord[];
  contracts: ContractorContractRecord[];
  lockedContractorId?: string;
  onCreated: (invoice: ContractorInvoiceRecord) => void | Promise<void>;
}

export function ContractorInvoiceFormModal({
  open,
  onClose,
  companyId,
  contractors,
  contracts,
  lockedContractorId,
  onCreated,
}: ContractorInvoiceFormModalProps) {
  const [contractorId, setContractorId] = useState(lockedContractorId ?? '');
  const [contractId, setContractId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [amount, setAmount] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [description, setDescription] = useState('');
  const [issuedAt, setIssuedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [lineItems, setLineItems] = useState<ContractorInvoiceLineItem[]>([
    { description: '', amount: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableContracts = useMemo(
    () =>
      contracts.filter(
        (c) =>
          c.contractorId === contractorId &&
          c.status !== 'terminated',
      ),
    [contractorId, contracts],
  );

  const selectedContract = useMemo(
    () => availableContracts.find((c) => c.id === contractId) ?? null,
    [availableContracts, contractId],
  );

  useEffect(() => {
    if (!open) return;
    if (lockedContractorId) {
      setContractorId(lockedContractorId);
    } else if (!contractorId && contractors.length > 0) {
      setContractorId(contractors[0].id);
    }
  }, [contractors, contractorId, lockedContractorId, open]);

  useEffect(() => {
    if (!open) return;
    if (availableContracts.length > 0) {
      const stillValid = availableContracts.some((c) => c.id === contractId);
      if (!stillValid) {
        setContractId(availableContracts[0].id);
      }
    } else {
      setContractId('');
    }
  }, [availableContracts, contractId, open]);

  useEffect(() => {
    if (!selectedContract) return;
    setMilestoneId('');
    setHoursWorked('');
    if (selectedContract.paymentStructure === 'milestone') {
      const firstPending = selectedContract.milestones.find((m) => m.status === 'pending');
      if (firstPending) {
        setMilestoneId(firstPending.id);
        setAmount(firstPending.amount);
        setPeriodLabel(firstPending.title);
        setLineItems([{ description: firstPending.title, amount: firstPending.amount }]);
      } else {
        setAmount('');
      }
    } else {
      setAmount('');
      setLineItems([{ description: '', amount: '' }]);
    }
  }, [selectedContract]);

  const handleMilestoneChange = (nextMilestoneId: string) => {
    setMilestoneId(nextMilestoneId);
    const ms = selectedContract?.milestones.find((m) => m.id === nextMilestoneId);
    if (ms) {
      setAmount(ms.amount);
      if (!periodLabel) setPeriodLabel(ms.title);
      setLineItems([{ description: ms.title, amount: ms.amount }]);
    }
  };

  const handleHoursChange = (nextHours: string) => {
    setHoursWorked(nextHours);
    if (selectedContract?.hourlyRate) {
      const computed = computeHoursAmount(nextHours, selectedContract.hourlyRate);
      setAmount(computed);
      if (computed) {
        setLineItems([
          {
            description: description || `${selectedContract.title} (${nextHours} hrs)`,
            quantity: Number(nextHours),
            unitAmount: selectedContract.hourlyRate,
            amount: computed,
          },
        ]);
      }
    }
  };

  const updateLineItem = (
    idx: number,
    patch: Partial<ContractorInvoiceLineItem>,
  ) => {
    setLineItems((prev) => {
      const updated = prev.map((row, i) => (i === idx ? { ...row, ...patch } : row));
      if (selectedContract?.paymentStructure === 'fixed_project_fee') {
        const total = sumMoneyStrings(updated.map((r) => r.amount));
        if (Number(total) > 0) setAmount(total);
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!contractorId || !contractId || !amount || !issuedAt) {
      setError('Select contractor, contract, amount, and issue date.');
      return;
    }
    if (selectedContract?.paymentStructure === 'milestone' && !milestoneId) {
      setError('Select a pending contract milestone for milestone-based billing.');
      return;
    }
    if (selectedContract?.paymentStructure === 'hourly_invoice' && !hoursWorked.trim()) {
      setError('Enter hours worked to compute hourly contractor invoice.');
      return;
    }

    const cleanLineItems = lineItems
      .filter((item) => item.description.trim() && item.amount.trim())
      .map((item) => ({
        description: item.description.trim(),
        quantity: item.quantity,
        unitAmount: item.unitAmount,
        amount: item.amount.trim(),
      }));

    setSubmitting(true);
    setError(null);
    try {
      const created = await createContractorInvoice(companyId, {
        contractorId,
        contractId,
        milestoneId:
          selectedContract?.paymentStructure === 'milestone' ? milestoneId : undefined,
        periodLabel: periodLabel.trim() || undefined,
        description: description.trim() || undefined,
        lineItems: cleanLineItems.length > 0 ? cleanLineItems : undefined,
        hoursWorked:
          selectedContract?.paymentStructure === 'hourly_invoice'
            ? hoursWorked.trim()
            : undefined,
        amount: amount.trim(),
        currency: selectedContract?.currency ?? 'AUD',
        issuedAt,
      });
      setPeriodLabel('');
      setDescription('');
      setHoursWorked('');
      setAmount('');
      setLineItems([{ description: '', amount: '' }]);
      onClose();
      await onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create contractor invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create contractor invoice"
      description="Create a draft vendor payable tied to commercial contract terms (never linked to employee payroll)."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || !contractId}
            className={AP_PRIMARY_BUTTON_CLASS}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save draft invoice'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Contractor / vendor</Label>
            <Select
              value={contractorId}
              disabled={Boolean(lockedContractorId)}
              onChange={(e) => setContractorId(e.target.value)}
            >
              <option value="">Select contractor</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName ?? c.legalName} ({c.contractorNumber})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Commercial contract</Label>
            <Select value={contractId} onChange={(e) => setContractId(e.target.value)}>
              <option value="">Select contract</option>
              {availableContracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractNumber} — {c.title} (
                  {CONTRACTOR_PAYMENT_STRUCTURE_LABELS[c.paymentStructure]})
                </option>
              ))}
            </Select>
          </div>
        </div>

        {selectedContract && (
          <div className="rounded-lg border border-teal-200 dark:border-teal-800/70 bg-teal-50/50 dark:bg-teal-950/30 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-semibold text-teal-900 dark:text-teal-200">
                {CONTRACTOR_PAYMENT_STRUCTURE_LABELS[selectedContract.paymentStructure]}
              </span>
              <span className="text-secondary">
                {' '}
                · Terms: {PAYMENT_TERMS_LABELS[selectedContract.paymentTerms]} · Currency:{' '}
                {selectedContract.currency}
              </span>
            </div>
            {selectedContract.hourlyRate && (
              <span className="font-mono font-semibold text-teal-800 dark:text-teal-300">
                Rate: {formatContractorMoney(selectedContract.hourlyRate, selectedContract.currency)}/hr
              </span>
            )}
            {(selectedContract.fixedFeeAmount || selectedContract.annualValue) && (
              <span className="font-mono font-semibold text-teal-800 dark:text-teal-300">
                Cap:{' '}
                {formatContractorMoney(
                  selectedContract.fixedFeeAmount ?? selectedContract.annualValue ?? '0',
                  selectedContract.currency,
                )}
              </span>
            )}
          </div>
        )}

        {selectedContract?.paymentStructure === 'milestone' && (
          <div>
            <Label>Billable milestone</Label>
            <Select value={milestoneId} onChange={(e) => handleMilestoneChange(e.target.value)}>
              <option value="">Select pending milestone</option>
              {selectedContract.milestones.map((m) => (
                <option key={m.id} value={m.id} disabled={m.status !== 'pending'}>
                  {m.title} — {formatContractorMoney(m.amount, selectedContract.currency)} (
                  {m.status})
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {selectedContract?.paymentStructure === 'hourly_invoice' && (
            <div>
              <Label>Hours worked</Label>
              <Input
                value={hoursWorked}
                onChange={(e) => handleHoursChange(e.target.value)}
                placeholder="40.00"
              />
            </div>
          )}
          <div>
            <Label>Invoice amount ({selectedContract?.currency ?? 'AUD'})</Label>
            <Input
              value={amount}
              readOnly={
                selectedContract?.paymentStructure === 'milestone' ||
                selectedContract?.paymentStructure === 'hourly_invoice'
              }
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10000.00"
              className="font-mono"
            />
          </div>
          <div>
            <Label>Issued date</Label>
            <Input
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
            />
          </div>
          <div>
            <Label>Billing period / label</Label>
            <Input
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="e.g. Nov 2026 / Sprint 4"
            />
          </div>
        </div>

        <div>
          <Label>Invoice summary / memo</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Deliverables or service period covered by this vendor invoice"
          />
        </div>

        {selectedContract?.paymentStructure === 'fixed_project_fee' && (
          <div className="space-y-2 border-t border-base pt-3">
            <div className="flex items-center justify-between">
              <Label className="mb-0">Commercial line items</Label>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setLineItems((prev) => [...prev, { description: '', amount: '' }])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>
            {lineItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-8">
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateLineItem(idx, { description: e.target.value })
                    }
                    placeholder="Line item description"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    value={item.amount}
                    onChange={(e) => updateLineItem(idx, { amount: e.target.value })}
                    placeholder="5000.00"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLineItems((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:text-error-600"
                      aria-label="Remove line item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

