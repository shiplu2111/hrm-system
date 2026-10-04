import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type {
  CreateJobRequisitionInput,
  JobRequisitionRecord,
  RecruitmentLookups,
  UpdateJobRequisitionInput,
} from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { createJobRequisition, updateJobRequisition } from '@/lib/recruitment-api';
import { ApiError } from '@/lib/tenant-api-client';

interface FormState {
  title: string;
  departmentId: string;
  designationId: string;
  jobLevelId: string;
  employmentTypeId: string;
  locationId: string;
  headcount: string;
  requestedByEmployeeId: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  departmentId: '',
  designationId: '',
  jobLevelId: '',
  employmentTypeId: '',
  locationId: '',
  headcount: '1',
  requestedByEmployeeId: '',
  description: '',
};

function formFromRecord(record: JobRequisitionRecord): FormState {
  return {
    title: record.title,
    departmentId: record.departmentId ?? '',
    designationId: record.designationId ?? '',
    jobLevelId: record.jobLevelId ?? '',
    employmentTypeId: record.employmentTypeId ?? '',
    locationId: record.locationId ?? '',
    headcount: String(record.headcount),
    requestedByEmployeeId: record.requestedByEmployeeId ?? '',
    description: record.description,
  };
}

type FieldErrors = Partial<Record<'title' | 'headcount' | 'description', string>>;

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.title.trim()) errors.title = 'Job title is required';
  const headcount = Number(form.headcount);
  if (!Number.isInteger(headcount) || headcount < 1) {
    errors.headcount = 'Headcount must be a whole number of at least 1';
  }
  if (!form.description.trim()) errors.description = 'Job description is required';
  return errors;
}

export function RequisitionFormModal({
  open,
  onClose,
  companyId,
  lookups,
  requisition,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  lookups: RecruitmentLookups | null;
  /** When set, the modal edits this requisition; otherwise it creates a draft. */
  requisition: JobRequisitionRecord | null;
  onSaved: (record: JobRequisitionRecord) => void;
}) {
  const isEdit = requisition != null;
  const requesterLocked = isEdit && requisition.status !== 'draft';
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(requisition ? formFromRecord(requisition) : EMPTY_FORM);
    setErrors({});
    setSubmitError(null);
  }, [open, requisition]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const designations = useMemo(() => {
    const all = lookups?.designations ?? [];
    if (!form.departmentId) return all;
    return all.filter(
      (d) => d.departmentId == null || d.departmentId === form.departmentId,
    );
  }, [lookups, form.departmentId]);

  const handleDepartmentChange = (departmentId: string) => {
    setForm((current) => {
      const designation = lookups?.designations.find(
        (d) => d.id === current.designationId,
      );
      const keepDesignation =
        !designation ||
        designation.departmentId == null ||
        !departmentId ||
        designation.departmentId === departmentId;
      return {
        ...current,
        departmentId,
        designationId: keepDesignation ? current.designationId : '',
      };
    });
  };

  const handleSubmit = async () => {
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setSubmitError(null);
    try {
      let saved: JobRequisitionRecord;
      if (requisition) {
        const input: UpdateJobRequisitionInput = {
          title: form.title.trim(),
          departmentId: form.departmentId || null,
          designationId: form.designationId || null,
          jobLevelId: form.jobLevelId || null,
          employmentTypeId: form.employmentTypeId || null,
          locationId: form.locationId || null,
          headcount: Number(form.headcount),
          description: form.description.trim(),
          ...(requesterLocked
            ? {}
            : { requestedByEmployeeId: form.requestedByEmployeeId || null }),
        };
        saved = await updateJobRequisition(requisition.id, input);
      } else {
        const input: CreateJobRequisitionInput = {
          title: form.title.trim(),
          departmentId: form.departmentId || undefined,
          designationId: form.designationId || undefined,
          jobLevelId: form.jobLevelId || undefined,
          employmentTypeId: form.employmentTypeId || undefined,
          locationId: form.locationId || undefined,
          headcount: Number(form.headcount),
          description: form.description.trim(),
          requestedByEmployeeId: form.requestedByEmployeeId || undefined,
        };
        saved = await createJobRequisition(companyId, input);
      }
      onSaved(saved);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to save requisition');
    } finally {
      setSaving(false);
    }
  };

  const optionList = (items: { id: string; name: string }[] | undefined) =>
    (items ?? []).map((item) => (
      <option key={item.id} value={item.id}>
        {item.name}
      </option>
    ));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit ${requisition.referenceNumber}` : 'New job requisition'}
      description={
        isEdit
          ? requisition.status === 'pending_approval'
            ? 'This requisition is awaiting approval. Changes are visible to approvers immediately.'
            : 'Draft requisitions can be edited freely until submitted.'
          : 'Creates a draft. Submit it for approval, then publish a posting once it opens.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleSubmit()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create draft'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {submitError && (
          <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-3 py-2 text-sm text-error-700 dark:text-error-300">
            {submitError}
          </div>
        )}
        {!lookups && (
          <p className="text-xs text-secondary flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading organisation options…
          </p>
        )}
        <div>
          <Label htmlFor="req-title">Job title</Label>
          <Input
            id="req-title"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Senior Frontend Engineer"
          />
          <FieldError message={errors.title} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="req-dept">Department</Label>
            <Select
              id="req-dept"
              value={form.departmentId}
              onChange={(e) => handleDepartmentChange(e.target.value)}
            >
              <option value="">Not specified</option>
              {optionList(lookups?.departments)}
            </Select>
          </div>
          <div>
            <Label htmlFor="req-designation">Designation</Label>
            <Select
              id="req-designation"
              value={form.designationId}
              onChange={(e) => set('designationId', e.target.value)}
            >
              <option value="">Not specified</option>
              {optionList(designations)}
            </Select>
          </div>
          <div>
            <Label htmlFor="req-level">Job level</Label>
            <Select
              id="req-level"
              value={form.jobLevelId}
              onChange={(e) => set('jobLevelId', e.target.value)}
            >
              <option value="">Not specified</option>
              {optionList(lookups?.jobLevels)}
            </Select>
          </div>
          <div>
            <Label htmlFor="req-type">Employment type</Label>
            <Select
              id="req-type"
              value={form.employmentTypeId}
              onChange={(e) => set('employmentTypeId', e.target.value)}
            >
              <option value="">Not specified</option>
              {optionList(lookups?.employmentTypes)}
            </Select>
          </div>
          <div>
            <Label htmlFor="req-location">Location</Label>
            <Select
              id="req-location"
              value={form.locationId}
              onChange={(e) => set('locationId', e.target.value)}
            >
              <option value="">Not specified</option>
              {optionList(lookups?.locations)}
            </Select>
          </div>
          <div>
            <Label htmlFor="req-headcount">Headcount</Label>
            <Input
              id="req-headcount"
              type="number"
              min={1}
              step={1}
              value={form.headcount}
              onChange={(e) => set('headcount', e.target.value)}
            />
            <FieldError message={errors.headcount} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="req-requester">Requested by</Label>
            <Select
              id="req-requester"
              value={form.requestedByEmployeeId}
              disabled={requesterLocked}
              onChange={(e) => set('requestedByEmployeeId', e.target.value)}
            >
              <option value="">
                {isEdit ? 'Not set' : 'Me (my linked employee record)'}
              </option>
              {(lookups?.employees ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.employeeNumber}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted mt-1">
              {requesterLocked
                ? 'The requester is fixed once the requisition enters approval.'
                : 'The approval workflow routes to this employee’s manager chain.'}
            </p>
          </div>
        </div>
        <div>
          <Label htmlFor="req-desc">Job description</Label>
          <Textarea
            id="req-desc"
            rows={6}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Responsibilities, requirements, and anything candidates should know"
          />
          <FieldError message={errors.description} />
        </div>
      </div>
    </Modal>
  );
}
