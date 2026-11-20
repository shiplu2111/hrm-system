import { useEffect, useState } from 'react';
import { CalendarClock, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import type {
  ContractorBillingFrequency,
  ContractorContractRecord,
  ContractorPaymentStructure,
  ContractorPaymentTerms,
} from '@hrm/shared-types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import {
  BILLING_FREQUENCY_LABELS,
  CONTRACTOR_PAYMENT_STRUCTURE_LABELS,
  PAYMENT_TERMS_DAYS,
  PAYMENT_TERMS_LABELS,
  updateContractorContractPaymentTerms,
} from '@/lib/contractors-api';
import { ApiError } from '@/lib/tenant-api-client';
import { AP_PRIMARY_BUTTON_CLASS, formatContractorMoney } from './contractor-ui.utils';

interface MilestoneEditRow {
  id?: string;
  title: string;
  description: string;
  amount: string;
  targetDate: string;
  status: 'pending' | 'invoiced' | 'paid';
}

interface ContractorPaymentTermsModalProps {
  contract: ContractorContractRecord | null;
  onClose: () => void;
  onUpdated: (contract: ContractorContractRecord) => void | Promise<void>;
}

const STRUCTURE_OPTIONS: Array<{
  key: ContractorPaymentStructure;
  title: string;
  description: string;
}> = [
  {
    key: 'fixed_project_fee',
    title: 'Fixed Project Fee',
    description: 'Capped lump-sum project or retainer schedule; invoices validate against cap.',
  },
  {
    key: 'milestone',
    title: 'Milestone-Based',
    description: 'Invoices unlock per deliverable milestone and match exact milestone amounts.',
  },
  {
    key: 'hourly_invoice',
    title: 'Hourly Rate',
    description: 'Verified hours worked × contracted hourly rate determine payable amounts.',
  },
];

export function ContractorPaymentTermsModal({
  contract,
  onClose,
  onUpdated,
}: ContractorPaymentTermsModalProps) {
  const [paymentStructure, setPaymentStructure] =
    useState<ContractorPaymentStructure>('fixed_project_fee');
  const [paymentTerms, setPaymentTerms] = useState<ContractorPaymentTerms>('net_30');
  const [billingFrequency, setBillingFrequency] =
    useState<ContractorBillingFrequency>('monthly');
  const [fixedFeeAmount, setFixedFeeAmount] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [currency, setCurrency] = useState('AUD');
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [noticePeriodDays, setNoticePeriodDays] = useState('30');
  const [scopeDescription, setScopeDescription] = useState('');
  const [milestones, setMilestones] = useState<MilestoneEditRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contract) return;
    setPaymentStructure(contract.paymentStructure);
    setPaymentTerms(contract.paymentTerms);
    setBillingFrequency(contract.billingFrequency);
    setFixedFeeAmount(contract.fixedFeeAmount ?? contract.annualValue ?? '');
    setHourlyRate(contract.hourlyRate ?? '');
    setCurrency(contract.currency);
    setAutoRenewal(contract.autoRenewal);
    setNoticePeriodDays(String(contract.noticePeriodDays));
    setScopeDescription(contract.scopeDescription ?? '');
    setMilestones(
      contract.milestones.length > 0
        ? contract.milestones.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description ?? '',
            amount: m.amount,
            targetDate: m.targetDate ?? '',
            status: m.status,
          }))
        : [
            {
              title: '',
              description: '',
              amount: '',
              targetDate: '',
              status: 'pending',
            },
          ],
    );
    setError(null);
  }, [contract]);

  if (!contract) return null;

  const dueDays = PAYMENT_TERMS_DAYS[paymentTerms];

  const handleSave = async () => {
    if (paymentStructure === 'fixed_project_fee' && !fixedFeeAmount.trim()) {
      setError('Fixed fee / cap amount is required.');
      return;
    }
    if (paymentStructure === 'hourly_invoice' && !hourlyRate.trim()) {
      setError('Hourly rate is required.');
      return;
    }

    const cleanMilestones = milestones
      .filter((m) => m.title.trim() && m.amount.trim())
      .map((m, index) => ({
        id: m.id,
        title: m.title.trim(),
        description: m.description.trim() || undefined,
        amount: m.amount.trim(),
        targetDate: m.targetDate || undefined,
        sortOrder: index,
      }));

    if (paymentStructure === 'milestone' && cleanMilestones.length === 0) {
      setError('Milestone payment terms require at least one milestone.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateContractorContractPaymentTerms(contract.id, {
        paymentStructure,
        paymentTerms,
        billingFrequency: paymentStructure === 'milestone' ? 'milestone' : billingFrequency,
        fixedFeeAmount:
          paymentStructure === 'fixed_project_fee' ? fixedFeeAmount.trim() : undefined,
        annualValue:
          paymentStructure === 'fixed_project_fee' ? fixedFeeAmount.trim() : undefined,
        hourlyRate: paymentStructure === 'hourly_invoice' ? hourlyRate.trim() : undefined,
        currency: currency.trim().toUpperCase() || 'AUD',
        autoRenewal,
        noticePeriodDays: Number.parseInt(noticePeriodDays, 10) || 0,
        scopeDescription: scopeDescription.trim() || undefined,
        milestones: paymentStructure === 'milestone' ? cleanMilestones : undefined,
      });
      onClose();
      await onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update payment terms');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Configure payment terms · ${contract.contractNumber}`}
      description={`${contract.contractorName} — ${contract.title}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className={AP_PRIMARY_BUTTON_CLASS}
            disabled={submitting}
            onClick={() => void handleSave()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save payment terms'}
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

        <div>
          <Label>Billing model (Fixed / Milestone / Hourly)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-1">
            {STRUCTURE_OPTIONS.map((option) => {
              const selected = paymentStructure === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPaymentStructure(option.key)}
                  className={`text-left rounded-xl border p-3 transition-all ${
                    selected
                      ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/35 ring-1 ring-teal-600'
                      : 'border-base hover:border-strong'
                  }`}
                >
                  <p className="text-xs font-semibold text-primary">{option.title}</p>
                  <p className="text-[11px] text-secondary mt-1">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {paymentStructure === 'fixed_project_fee' && (
            <div>
              <Label>Fixed fee cap ({currency})</Label>
              <Input
                value={fixedFeeAmount}
                onChange={(e) => setFixedFeeAmount(e.target.value)}
                placeholder="25000.00"
                className="font-mono"
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
                className="font-mono"
              />
            </div>
          )}

          <div>
            <Label>Net settlement terms</Label>
            <Select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value as ContractorPaymentTerms)}
            >
              {(Object.keys(PAYMENT_TERMS_LABELS) as ContractorPaymentTerms[]).map((key) => (
                <option key={key} value={key}>
                  {PAYMENT_TERMS_LABELS[key]} (+{PAYMENT_TERMS_DAYS[key]} days)
                </option>
              ))}
            </Select>
          </div>

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
            />
          </div>

          <div>
            <Label>Notice period (days)</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={noticePeriodDays}
              onChange={(e) => setNoticePeriodDays(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-5">
            <input
              id="terms-auto-renewal"
              type="checkbox"
              checked={autoRenewal}
              onChange={(e) => setAutoRenewal(e.target.checked)}
              className="h-4 w-4 rounded border-strong text-teal-700 focus:ring-teal-500"
            />
            <label htmlFor="terms-auto-renewal" className="text-xs text-secondary">
              Auto-renewal enabled
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-teal-200 dark:border-teal-800/60 bg-teal-50/40 dark:bg-teal-950/25 px-3 py-2 flex items-center gap-2 text-xs text-teal-900 dark:text-teal-200">
          <CalendarClock className="h-4 w-4 text-teal-700 shrink-0" />
          <span>
            Rule preview: <strong>{CONTRACTOR_PAYMENT_STRUCTURE_LABELS[paymentStructure]}</strong>{' '}
            invoices issued against this agreement fall due{' '}
            <strong>{dueDays === 0 ? 'immediately on receipt' : `${dueDays} days after issue date`}</strong>.
          </span>
        </div>

        {paymentStructure === 'milestone' && (
          <div className="rounded-lg border border-teal-200 dark:border-teal-800/60 bg-teal-50/40 dark:bg-teal-950/20 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">
                Deliverable Milestone Schedule ({milestones.length})
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setMilestones((prev) => [
                    ...prev,
                    {
                      title: '',
                      description: '',
                      amount: '',
                      targetDate: '',
                      status: 'pending',
                    },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add milestone
              </Button>
            </div>
            {milestones.map((row, idx) => {
              const locked = row.status !== 'pending';
              return (
                <div
                  key={row.id ?? `new-${idx}`}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
                >
                  <div className="sm:col-span-5">
                    <Label className="text-[11px] flex items-center gap-1.5">
                      <span>Milestone title</span>
                      {locked && (
                        <Badge tone="neutral" className="text-[10px]">
                          <Lock className="h-2.5 w-2.5" /> {row.status}
                        </Badge>
                      )}
                    </Label>
                    <Input
                      value={row.title}
                      disabled={locked}
                      onChange={(e) =>
                        setMilestones((prev) =>
                          prev.map((m, i) => (i === idx ? { ...m, title: e.target.value } : m)),
                        )
                      }
                      placeholder={`Deliverable ${idx + 1}`}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-[11px]">
                      Amount ({locked ? formatContractorMoney(row.amount, currency) : currency})
                    </Label>
                    <Input
                      value={row.amount}
                      disabled={locked}
                      onChange={(e) =>
                        setMilestones((prev) =>
                          prev.map((m, i) =>
                            i === idx ? { ...m, amount: e.target.value } : m,
                          ),
                        )
                      }
                      placeholder="5000.00"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-[11px]">Target date</Label>
                    <Input
                      type="date"
                      value={row.targetDate}
                      disabled={locked}
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
                    {!locked && milestones.length > 1 && (
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
              );
            })}
          </div>
        )}

        <div>
          <Label>Scope &amp; commercial notes</Label>
          <Textarea
            value={scopeDescription}
            onChange={(e) => setScopeDescription(e.target.value)}
            rows={2}
            placeholder="Commercial terms, acceptance criteria, and invoice notes"
          />
        </div>
      </div>
    </Modal>
  );
}

