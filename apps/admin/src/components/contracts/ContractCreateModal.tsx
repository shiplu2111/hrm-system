import { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import type { EmploymentContractRecord } from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Form';
import { FieldError } from '@/components/ui/FieldError';
import { ContractTermsFields } from '@/components/contracts/ContractTermsFields';
import { listEmployees } from '@/lib/employees-api';
import { createEmploymentContract, uploadContractDocument } from '@/lib/contracts-api';
import {
  termsFormForNewContract,
  termsFormToCreateInput,
  validateTermsForm,
  type ContractTermsForm,
} from '@/lib/contract-form';
import { ApiError } from '@/lib/tenant-api-client';

interface Props {
  open: boolean;
  companyId: string;
  /** Fixes the employee (e.g. from their profile); otherwise the user picks one. */
  employee?: { id: string; fullName: string };
  /** Pay and rules are copied from this contract as a starting point. */
  template?: EmploymentContractRecord;
  onClose: () => void;
  /** `warning` is set when the contract saved but its document upload failed. */
  onCreated: (contract: EmploymentContractRecord, warning?: string) => void;
}

const DOCUMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg';

export function ContractCreateModal({ open, companyId, employee, template, onClose, onCreated }: Props) {
  const canUpload = usePermission('employee', 'edit');
  const [employees, setEmployees] = useState<{ id: string; fullName: string; employeeNumber: string }[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [terms, setTerms] = useState<ContractTermsForm>(() => termsFormForNewContract(template));
  const [activate, setActivate] = useState(false);
  const [docLabel, setDocLabel] = useState('Signed contract');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmployeeId(employee?.id ?? '');
    setTerms(termsFormForNewContract(template));
    setActivate(false);
    setDocLabel('Signed contract');
    setDocFile(null);
    setSubmitted(false);
    setError(null);
  }, [open, employee?.id, template]);

  useEffect(() => {
    if (!open || employee) return;
    let cancelled = false;
    listEmployees(companyId)
      .then((rows) => {
        if (!cancelled) {
          setEmployees(rows.map((e) => ({ id: e.id, fullName: e.fullName, employeeNumber: e.employeeNumber })));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load employees');
      });
    return () => {
      cancelled = true;
    };
  }, [open, employee, companyId]);

  const errors = validateTermsForm(terms);
  const employeeError = employeeId ? undefined : 'Choose an employee.';
  const invalid = Object.keys(errors).length > 0 || !!employeeError;

  const submit = async () => {
    setSubmitted(true);
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createEmploymentContract(companyId, termsFormToCreateInput(employeeId, terms, activate));
      let warning: string | undefined;
      if (docFile && canUpload) {
        try {
          await uploadContractDocument(created.id, docLabel.trim() || 'Contract document', docFile);
        } catch (err) {
          warning = `Contract created, but the document didn’t upload: ${
            err instanceof ApiError ? err.message : 'upload failed'
          }. Add it from the contract page.`;
        }
      }
      onCreated(created, warning);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the contract');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={employee ? `New contract for ${employee.fullName}` : 'New contract'}
      description={template ? 'Pay and rules are copied from the current contract — set the new dates.' : undefined}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {activate ? 'Create & activate' : 'Save as draft'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {error ? (
          <div className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        {!employee ? (
          <div className="max-w-sm">
            <Label htmlFor="contract-employee">Employee</Label>
            <Select
              id="contract-employee"
              value={employeeId}
              disabled={saving}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Select employee…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} ({e.employeeNumber})
                </option>
              ))}
            </Select>
            {submitted ? <FieldError message={employeeError} /> : null}
          </div>
        ) : null}

        <ContractTermsFields value={terms} onChange={setTerms} errors={submitted ? errors : {}} disabled={saving} />

        {canUpload ? (
          <fieldset>
            <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Contract document (optional)
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contract-doc-label">Label</Label>
                <Input
                  id="contract-doc-label"
                  value={docLabel}
                  disabled={saving}
                  onChange={(e) => setDocLabel(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="contract-doc-file">File (PDF or image)</Label>
                <Input
                  id="contract-doc-file"
                  type="file"
                  accept={DOCUMENT_ACCEPT}
                  disabled={saving}
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </fieldset>
        ) : null}

        <label className="flex items-start gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={activate}
            disabled={saving}
            onChange={(e) => setActivate(e.target.checked)}
          />
          <span>
            Activate now
            <span className="block text-xs text-muted">Leave unticked to save a draft you can review and activate later.</span>
          </span>
        </label>
      </form>
    </Modal>
  );
}
