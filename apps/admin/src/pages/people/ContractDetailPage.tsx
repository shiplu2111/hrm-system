import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  FileText,
  Calendar,
  DollarSign,
  Clock,
  Briefcase,
  Download,
  AlertTriangle,
  Loader2,
  Upload,
} from 'lucide-react';
import type { EmploymentContractRecord } from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label } from '@/components/ui/Form';
import { useNav } from '@/context/NavContext';
import {
  CONTRACT_TYPE_LABELS,
  DISPLAY_STATUS_LABELS,
  activateEmploymentContract,
  approveContractRenewal,
  getContractDocumentFileUrl,
  getEmploymentContract,
  rejectContractRenewal,
  renewEmploymentContract,
  terminateEmploymentContract,
  uploadContractDocument,
} from '@/lib/contracts-api';
import { ApiError } from '@/lib/tenant-api-client';

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof FileText;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      {Icon && (
        <div className="h-8 w-8 rounded-lg bg-[rgb(var(--bg-muted))] flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-muted" />
        </div>
      )}
      <div className="flex-1">
        <div className="text-xs text-muted">{label}</div>
        <div className="text-sm text-primary font-medium">{value}</div>
      </div>
    </div>
  );
}

function formatPay(contract: EmploymentContractRecord): string {
  if (contract.payRate == null) return '—';
  const formatted = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: contract.currency,
    maximumFractionDigits: 2,
  }).format(contract.payRate);
  const suffix: Record<string, string> = {
    hourly: '/hr',
    weekly: '/wk',
    biweekly: '/fortnight',
    monthly: '/mo',
    annual: '/yr',
  };
  return contract.payFrequency
    ? `${formatted}${suffix[contract.payFrequency] ?? ''}`
    : formatted;
}

function formatOvertime(contract: EmploymentContractRecord): string {
  const rule = contract.overtimeRule;
  if (!rule || rule.type === 'none') return 'No overtime';
  if (rule.description) return rule.description;
  const mult = rule.multiplier ?? 1.5;
  if (rule.type === 'multiplier_after_weekly_hours') {
    return `${mult}x after ${rule.thresholdHours ?? 40} hrs/week`;
  }
  return `${mult}x after ${rule.thresholdHours ?? 8} hrs/day`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ContractDetailPage() {
  const { navigate, selectedContractId, openContract } = useNav();
  const [contract, setContract] = useState<EmploymentContractRecord | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [renewForm, setRenewForm] = useState({ startDate: '', endDate: '' });
  const [uploadForm, setUploadForm] = useState({
    label: 'Signed Contract',
    file: null as File | null,
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!selectedContractId) return;
    setLoading(true);
    setError(null);
    try {
      setContract(await getEmploymentContract(selectedContractId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load contract');
    } finally {
      setLoading(false);
    }
  }, [selectedContractId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = async (documentId: string) => {
    if (!contract) return;
    try {
      const { url } = await getContractDocumentFileUrl(contract.id, documentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Download failed');
    }
  };

  const handleActivate = async () => {
    if (!contract) return;
    setBusy(true);
    try {
      setContract(await activateEmploymentContract(contract.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Activation failed');
    } finally {
      setBusy(false);
    }
  };

  const handleTerminate = async () => {
    if (!contract || !window.confirm('Terminate this contract?')) return;
    setBusy(true);
    try {
      setContract(await terminateEmploymentContract(contract.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Termination failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRenew = async () => {
    if (!contract || !renewForm.startDate) return;
    setBusy(true);
    try {
      const renewed = await renewEmploymentContract(contract.id, {
        startDate: renewForm.startDate,
        endDate: renewForm.endDate || undefined,
        submit: true,
      });
      setRenewOpen(false);
      openContract(renewed.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Renewal failed');
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async () => {
    if (!contract || !uploadForm.file) return;
    setBusy(true);
    try {
      await uploadContractDocument(
        contract.id,
        uploadForm.label.trim() || 'Contract Document',
        uploadForm.file,
      );
      setUploadOpen(false);
      setUploadForm({ label: 'Signed Contract', file: null });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleApproveRenewal = async () => {
    if (!contract) return;
    setBusy(true);
    try {
      setContract(await approveContractRenewal(contract.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Approval failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRejectRenewal = async () => {
    if (!contract || !window.confirm('Reject this renewal request?')) return;
    setBusy(true);
    try {
      setContract(await rejectContractRenewal(contract.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Rejection failed');
    } finally {
      setBusy(false);
    }
  };

  if (!selectedContractId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        No contract selected.
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('emp-contracts')}>
            Back to Contracts
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        Contract not found.
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('emp-contracts')}>
            Back to Contracts
          </Button>
        </div>
      </div>
    );
  }

  const statusTone =
    contract.displayStatus === 'active'
      ? 'success'
      : contract.displayStatus === 'expiring_soon'
        ? 'warning'
        : contract.displayStatus === 'expired'
          ? 'error'
          : 'neutral';

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <button
        onClick={() => navigate('emp-contracts')}
        className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Contracts
      </button>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <Card>
        <CardBody className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center">
            <FileText className="h-6 w-6 text-accent-600 dark:text-accent-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-bold text-primary">
                {contract.employeeName ?? 'Employee'}
              </h1>
              <Badge tone="accent">
                {CONTRACT_TYPE_LABELS[contract.contractType]}
              </Badge>
              <Badge tone={statusTone} dot>
                {DISPLAY_STATUS_LABELS[contract.displayStatus]}
              </Badge>
            </div>
            <div className="text-sm text-secondary mt-0.5">
              {contract.employeeNumber ?? contract.employeeId} · Contract #
              {contract.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {contract.displayStatus === 'pending_approval' && (
              <>
                <Button
                  variant="primary"
                  size="md"
                  disabled={busy}
                  onClick={() => void handleApproveRenewal()}
                >
                  Approve Renewal
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={busy}
                  onClick={() => void handleRejectRenewal()}
                >
                  Reject
                </Button>
              </>
            )}
            {contract.status === 'draft' && !contract.renewalWorkflow && (
              <Button
                variant="primary"
                size="md"
                disabled={busy}
                onClick={() => void handleActivate()}
              >
                Activate
              </Button>
            )}
            {contract.status === 'active' && (
              <Button
                variant="secondary"
                size="md"
                disabled={busy}
                onClick={() => void handleTerminate()}
              >
                Terminate
              </Button>
            )}
            <Button variant="secondary" size="md" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Upload
            </Button>
          </div>
        </CardBody>
      </Card>

      {contract.renewalWorkflow?.status === 'pending' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-accent-50 dark:bg-accent-950/30 border border-accent-200 dark:border-accent-800/60">
          <AlertTriangle className="h-5 w-5 text-accent-600 dark:text-accent-400 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-primary">
              Renewal awaiting approval
            </div>
            <div className="text-xs text-secondary mt-0.5">
              Current step: {contract.renewalWorkflow.currentStep?.roleName ?? '—'}
            </div>
          </div>
        </div>
      )}

      {contract.displayStatus === 'expiring_soon' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-warning-50 dark:bg-warning-950/30 border border-warning-200 dark:border-warning-800/60">
          <AlertTriangle className="h-5 w-5 text-warning-600 dark:text-warning-400 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-warning-800 dark:text-warning-300">
              This contract is expiring soon
            </div>
            <div className="text-xs text-warning-700 dark:text-warning-400 mt-0.5">
              End date: {contract.endDate} — Initiate renewal before expiry.
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setRenewForm({
                startDate: contract.endDate
                  ? new Date(
                      new Date(contract.endDate).getTime() + 86400000,
                    )
                      .toISOString()
                      .slice(0, 10)
                  : '',
                endDate: '',
              });
              setRenewOpen(true);
            }}
          >
            Submit Renewal
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contract Terms</CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            <DetailRow
              label="Contract Type"
              value={CONTRACT_TYPE_LABELS[contract.contractType]}
              icon={Briefcase}
            />
            <DetailRow
              label="Start Date"
              value={contract.startDate}
              icon={Calendar}
            />
            <DetailRow
              label="End Date"
              value={contract.endDate ?? 'Open-ended'}
              icon={Calendar}
            />
            <DetailRow label="Pay Rate" value={formatPay(contract)} icon={DollarSign} />
            <DetailRow
              label="Pay Frequency"
              value={contract.payFrequency ?? '—'}
              icon={Clock}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Terms & Conditions</CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            <DetailRow
              label="Probation End Date"
              value={contract.probationEndDate ?? '—'}
              icon={Clock}
            />
            <DetailRow
              label="Working Hours"
              value={
                contract.workingHoursPerWeek != null
                  ? `${contract.workingHoursPerWeek} hrs/week`
                  : '—'
              }
              icon={Clock}
            />
            <DetailRow
              label="Leave Entitlement"
              value={
                contract.leaveEntitlementDays != null
                  ? `${contract.leaveEntitlementDays} days/year`
                  : '—'
              }
              icon={Calendar}
            />
            <DetailRow
              label="Overtime Rule"
              value={formatOvertime(contract)}
              icon={Clock}
            />
            <DetailRow
              label="Employee Notice"
              value={
                contract.noticePeriodDays != null
                  ? `${contract.noticePeriodDays} days`
                  : '—'
              }
              icon={FileText}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Termination</CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            <DetailRow
              label="Employer Notice"
              value={
                contract.employerNoticeDays != null
                  ? `${contract.employerNoticeDays} days`
                  : '—'
              }
              icon={FileText}
            />
            <DetailRow
              label="Conditions"
              value={contract.terminationConditions?.trim() || '—'}
              icon={FileText}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attached Documents</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {contract.documents.length === 0 ? (
              <p className="text-sm text-secondary">No documents uploaded yet.</p>
            ) : (
              contract.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[rgb(var(--bg-muted))] hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer"
                  onClick={() => void handleDownload(doc.id)}
                >
                  <FileText className="h-5 w-5 text-accent-600 dark:text-accent-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary truncate">
                      {doc.label} — {doc.originalName}
                    </div>
                    <div className="text-xs text-muted">
                      {formatBytes(doc.sizeBytes)} · {doc.uploadedAt.slice(0, 10)}
                    </div>
                  </div>
                  <Download className="h-4 w-4 text-muted" />
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={renewOpen}
        onClose={() => !busy && setRenewOpen(false)}
        title="Submit Contract Renewal"
        description="Creates a renewal draft and starts the approval workflow"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenewOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={busy || !renewForm.startDate}
              onClick={() => void handleRenew()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit for Approval'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>New Start Date</Label>
            <Input
              type="date"
              value={renewForm.startDate}
              onChange={(e) =>
                setRenewForm((f) => ({ ...f, startDate: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>New End Date</Label>
            <Input
              type="date"
              value={renewForm.endDate}
              onChange={(e) =>
                setRenewForm((f) => ({ ...f, endDate: e.target.value }))
              }
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={uploadOpen}
        onClose={() => !busy && setUploadOpen(false)}
        title="Upload Contract Document"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUploadOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={busy || !uploadForm.file}
              onClick={() => void handleUpload()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Label</Label>
            <Input
              value={uploadForm.label}
              onChange={(e) =>
                setUploadForm((f) => ({ ...f, label: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>File</Label>
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) =>
                setUploadForm((f) => ({
                  ...f,
                  file: e.target.files?.[0] ?? null,
                }))
              }
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
