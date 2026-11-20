import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import type {
  ContractorBillingFrequency,
  ContractorContractRecord,
  ContractorPaymentStructure,
  ContractorPaymentTerms,
  ContractorRecord,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import {
  BILLING_FREQUENCY_LABELS,
  CONTRACTOR_PAYMENT_STRUCTURE_LABELS,
  createContractorContract,
  PAYMENT_TERMS_LABELS,
} from '@/lib/contractors-api';
import { ApiError } from '@/lib/tenant-api-client';
import { AP_PRIMARY_BUTTON_CLASS } from './contractor-ui.utils';

interface MilestoneDraft {
  title: string;
  amount: string;
  targetDate: string;
}

interface ContractorContractModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  contractor?: ContractorRecord | null;
  contractors?: ContractorRecord[];
  employees: Array<{ id: string; name: string }>;
  onCreated: (contract: ContractorContractRecord) => void | Promise<void>;
}

export function ContractorContractModal({
  open,
  onClose,
  companyId,
  contractor,
  contractors = [],
  employees,
  onCreated,
}: ContractorContractModalProps) {
  const [selectedContractorId, setSelectedContractorId] = useState(contractor?.id ?? '');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentStructure, setPaymentStructure] =
    useState<ContractorPaymentStructure>('fixed_project_fee');
  const [paymentTerms, setPaymentTerms] = useState<ContractorPaymentTerms>('net_30');
  const [billingFrequency, setBillingFrequency] =
    useState<ContractorBillingFrequency>('monthly');
  const [fixedFeeAmount, setFixedFeeAmount] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [currency, setCurrency] = useState('AUD');
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [ownerEmployeeId, setOwnerEmployeeId] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { title: '', amount: '', targetDate: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setStartDate('');
    setEndDate('');
    setPaymentStructure('fixed_project_fee');
    setPaymentTerms('net_30');
    setBillingFrequency('monthly');
    setFixedFeeAmount('');
    setHourlyRate('');
    setCurrency('AUD');
    setAutoRenewal(false);
    setOwnerEmployeeId('');
    setScopeDescription('');
    setMilestones([{ title: '', amount: '', targetDate: '' }]);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const targetContractorId = contractor?.id ?? selectedContractorId;
  const targetContractor =
    contractor ?? contractors.find((row) => row.id === selectedContractorId) ?? null;

  const handleSubmit = async () => {
    if (!targetContractorId) {
      setError('Select a contractor or vendor.');
      return;
    }
    if (!title.trim() || !startDate || !endDate) {
      setError('Contract title, start date, and end date are required.');
      return;
    }

    const validMilestones = milestones
      .filter((row) => row.title.trim() && row.amount.trim())
      .map((row, index) => ({
        title: row.title.trim(),
        amount: row.amount.trim(),
        targetDate: row.targetDate || undefined,
        sortOrder: index,
      }));

    if (paymentStructure === 'fixed_project_fee' && !fixedFeeAmount.trim()) {
      setError('Fixed project fee amount is required.');
      return;
    }
    if (paymentStructure === 'hourly_invoice' && !hourlyRate.trim()) {
      setError('Hourly rate is required for hourly contracts.');
      return;
    }
    if (paymentStructure === 'milestone' && validMilestones.length === 0) {
      setError('Add at least one milestone with title and amount.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await createContractorContract(companyId, {
        contractorId: targetContractorId,
        title: title.trim(),
        scopeDescription: scopeDescription.trim() || undefined,
        startDate,
        endDate,
        fixedFeeAmount:
          paymentStructure === 'fixed_project_fee' ? fixedFeeAmount.trim() : undefined,
        annualValue:
          paymentStructure === 'fixed_project_fee' ? fixedFeeAmount.trim() : undefined,
        hourlyRate: paymentStructure === 'hourly_invoice' ? hourlyRate.trim() : undefined,
        currency: currency.trim().toUpperCase() || 'AUD',
        paymentStructure,
        paymentTerms,
        billingFrequency: paymentStructure === 'milestone' ? 'milestone' : billingFrequency,
        milestones: paymentStructure === 'milestone' ? validMilestones : undefined,
        autoRenewal,
        ownerEmployeeId: ownerEmployeeId || undefined,
        status: 'active',
      });
      reset();
      onClose();
      await onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create contract');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New commercial contract"
      description={
        targetContractor
          ? `Bind payment structure, net terms, and milestones for ${targetContractor.displayName ?? targetContractor.legalName}.`
          : 'Select a contractor/vendor and configure payment structure, net terms, and milestones.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className={AP_PRIMARY_BUTTON_CLASS}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create contract'}
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
          {!contractor && (
            <div className="sm:col-span-2">
              <Label>Contractor / vendor</Label>
              <Select
                value={selectedContractorId}
                onChange={(e) => setSelectedContractorId(e.target.value)}
              >
                <option value="">Select contractor</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName ?? c.legalName} ({c.contractorNumber})
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="sm:col-span-2">
            <Label>Contract title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cloud Architecture Advisory MSA"
            />
          </div>
          <div>
            <Label>Start date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Expiry date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <Label>Payment structure</Label>
            <Select
              value={paymentStructure}
              onChange={(e) =>
                setPaymentStructure(e.target.value as ContractorPaymentStructure)
              }
            >
              {(
                Object.keys(
                  CONTRACTOR_PAYMENT_STRUCTURE_LABELS,
                ) as ContractorPaymentStructure[]
              ).map((key) => (
                <option key={key} value={key}>
                  {CONTRACTOR_PAYMENT_STRUCTURE_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Payment terms</Label>
            <Select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value as ContractorPaymentTerms)}
            >
              {(Object.keys(PAYMENT_TERMS_LABELS) as ContractorPaymentTerms[]).map((key) => (
                <option key={key} value={key}>
                  {PAYMENT_TERMS_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>

          {paymentStructure === 'fixed_project_fee' && (
            <div>
              <Label>Fixed project cap ({currency})</Label>
              <Input
                value={fixedFeeAmount}
                onChange={(e) => setFixedFeeAmount(e.target.value)}
                placeholder="25000.00"
              />
            </div>
          )}

          {paymentStructure === 'hourly_invoice' && (
            <div>
              <Label>Hourly rate ({currency}/hr)</Label>
              <Input
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="125.00"
              />
            </div>
          )}

          <div>
            <Label>Billing frequency</Label>
            <Select
              value={paymentStructure === 'milestone' ? 'milestone' : billingFrequency}
              disabled={paymentStructure === 'milestone'}
              onChange={(e) =>
                setBillingFrequency(e.target.value as ContractorBillingFrequency)
              }
            >
              {(Object.keys(BILLING_FREQUENCY_LABELS) as ContractorBillingFrequency[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {BILLING_FREQUENCY_LABELS[key]}
                  </option>
                ),
              )}
            </Select>
          </div>

          <div>
            <Label>Currency</Label>
            <Input
              value={currency}
              maxLength={3}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="AUD"
            />
          </div>

          <div>
            <Label>Internal owner</Label>
            <Select
              value={ownerEmployeeId}
              onChange={(e) => setOwnerEmployeeId(e.target.value)}
            >
              <option value="">Default from contractor</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-2 flex items-center gap-2 pt-1">
            <input
              id="contract-auto-renewal"
              type="checkbox"
              checked={autoRenewal}
              onChange={(e) => setAutoRenewal(e.target.checked)}
              className="h-4 w-4 rounded border-strong text-teal-700 focus:ring-teal-500"
            />
            <label htmlFor="contract-auto-renewal" className="text-xs text-secondary">
              Enable automatic contract renewal notice
            </label>
          </div>
        </div>

        {paymentStructure === 'milestone' && (
          <div className="rounded-lg border border-teal-200 dark:border-teal-800/60 bg-teal-50/40 dark:bg-teal-950/20 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">
                Deliverable Milestones
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setMilestones((prev) => [
                    ...prev,
                    { title: '', amount: '', targetDate: '' },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add milestone
              </Button>
            </div>
            {milestones.map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-5">
                  <Label className="text-[11px]">Milestone title</Label>
                  <Input
                    value={row.title}
                    onChange={(e) =>
                      setMilestones((prev) =>
                        prev.map((m, i) => (i === idx ? { ...m, title: e.target.value } : m)),
                      )
                    }
                    placeholder={`Phase ${idx + 1}`}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-[11px]">Amount ({currency})</Label>
                  <Input
                    value={row.amount}
                    onChange={(e) =>
                      setMilestones((prev) =>
                        prev.map((m, i) => (i === idx ? { ...m, amount: e.target.value } : m)),
                      )
                    }
                    placeholder="5000.00"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-[11px]">Target date</Label>
                  <Input
                    type="date"
                    value={row.targetDate}
                    onChange={(e) =>
                      setMilestones((prev) =>
                        prev.map((m, i) =>
                          i === idx ? { ...m, targetDate: e.target.value } : m,
                        ),
                      )
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setMilestones((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:text-error-600 hover:bg-error-50"
                      aria-label="Remove milestone"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <Label>Scope description</Label>
          <Textarea
            value={scopeDescription}
            onChange={(e) => setScopeDescription(e.target.value)}
            rows={2}
            placeholder="Commercial deliverables and acceptance criteria"
          />
        </div>
      </div>
    </Modal>
  );
}

