import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Trash2, Upload, UserCheck } from 'lucide-react';
import type {
  CandidateHirePrefill,
  DocumentTypeRecord,
  JobApplicationRecord,
  EmployeePersonalInfo,
  EmployeeRecord,
  EmploymentStatus,
} from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Form';
import { FieldError } from '@/components/ui/FieldError';
import { StepProgress, type StepProgressItem } from '@/components/ui/StepProgress';
import { useNav } from '@/context/NavContext';
import { billingCopy } from '@/lib/billing-copy';
import {
  createDefaultEmployeeFormState,
  type EmployeeFormErrors,
  type EmployeeFormState,
  type EmployeeWizardStep,
  type PendingDocument,
  validateBankTaxStep,
  validateDocumentDraft,
  validateEmploymentStep,
  validatePersonalStep,
} from '@/lib/employee-form-validation';
import { createEmployee, getEmployee, updateEmployee } from '@/lib/employees-api';
import {
  createEmployeeDocument,
  uploadEmployeeDocumentFile,
} from '@/lib/employee-documents-api';
import {
  getEmployeeTaxProfile,
  updateEmployeeTaxProfile,
} from '@/lib/employee-tax-profiles-api';
import { listDocumentTypes } from '@/lib/documents-api';
import {
  listCostCentres,
  listDepartments,
  listDesignations,
  listEmploymentTypes,
} from '@/lib/organization-api';
import { listEmployees } from '@/lib/employees-api';
import { getHirePrefill, hireApplication } from '@/lib/recruitment-api';
import { ApiError } from '@/lib/tenant-api-client';

const WIZARD_STEPS: StepProgressItem[] = [
  { key: 'personal', label: 'Personal' },
  { key: 'employment', label: 'Employment' },
  { key: 'bankTax', label: 'Bank / Tax' },
  { key: 'documents', label: 'Documents' },
];

const STEP_KEYS: EmployeeWizardStep[] = ['personal', 'employment', 'bankTax', 'documents'];

interface EmployeeFormWizardProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  employeeId?: string | null;
  onSuccess?: (employee: EmployeeRecord) => void;
  /**
   * Convert to Employee: pre-fills from the candidate and accepted offer, and creates the
   * record through the recruitment hire endpoint so the application is linked and onboarding starts.
   */
  hireApplicationId?: string | null;
  /** Fires as soon as the hire succeeds (before the remaining optional steps). */
  onHired?: (application: JobApplicationRecord) => void;
}

function prefillToFormState(prefill: CandidateHirePrefill): EmployeeFormState {
  return {
    ...createDefaultEmployeeFormState(),
    firstName: prefill.firstName,
    lastName: prefill.lastName,
    email: prefill.email,
    phone: prefill.phone ?? '',
    employeeNumber: prefill.employeeNumber,
    hireDate: prefill.hireDate,
    departmentId: prefill.departmentId ?? '',
    designationId: prefill.designationId ?? '',
    employmentTypeId: prefill.employmentTypeId ?? '',
    managerId: prefill.managerId ?? '',
    probationEndDate: prefill.probationEndDate ?? '',
  };
}

function buildPersonalInfo(state: EmployeeFormState): EmployeePersonalInfo {
  return {
    contact: {
      email: state.email.trim() || undefined,
      phone: state.phone.trim() || undefined,
      mobile: state.mobile.trim() || undefined,
    },
    emergencyContact: {
      name: state.emergencyName.trim() || undefined,
      phone: state.emergencyPhone.trim() || undefined,
      relationship: state.emergencyRelationship.trim() || undefined,
    },
    address: {
      line1: state.addressLine1.trim() || undefined,
      line2: state.addressLine2.trim() || undefined,
      city: state.city.trim() || undefined,
      state: state.state.trim() || undefined,
      postalCode: state.postalCode.trim() || undefined,
      country: state.country.trim() || undefined,
    },
  };
}

function employeeToFormState(record: EmployeeRecord): EmployeeFormState {
  const base = createDefaultEmployeeFormState();
  const pi = record.personalInfo ?? {};
  const contact = pi.contact ?? {};
  const emergency = pi.emergencyContact ?? {};
  const address = pi.address ?? {};
  return {
    ...base,
    firstName: record.firstName,
    lastName: record.lastName,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    mobile: contact.mobile ?? '',
    emergencyName: emergency.name ?? '',
    emergencyPhone: emergency.phone ?? '',
    emergencyRelationship: emergency.relationship ?? '',
    addressLine1: address.line1 ?? '',
    addressLine2: address.line2 ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    postalCode: address.postalCode ?? '',
    country: address.country ?? '',
    employeeNumber: record.employeeNumber,
    hireDate: record.hireDate,
    employmentStatus: record.employmentStatus,
    departmentId: record.departmentId ?? '',
    designationId: record.designationId ?? '',
    employmentTypeId: record.employmentTypeId ?? '',
    managerId: record.managerId ?? '',
    costCentreId: record.costCentreId ?? '',
    probationEndDate: record.probationEndDate ?? '',
    confirmationDate: record.confirmationDate ?? '',
  };
}

function buildEmployeeFields(state: EmployeeFormState) {
  return {
    employeeNumber: state.employeeNumber.trim(),
    firstName: state.firstName.trim(),
    lastName: state.lastName.trim(),
    hireDate: state.hireDate,
    employmentStatus: state.employmentStatus,
    departmentId: state.departmentId || null,
    designationId: state.designationId || null,
    employmentTypeId: state.employmentTypeId || null,
    managerId: state.managerId || null,
    costCentreId: state.costCentreId || null,
    probationEndDate: state.probationEndDate || null,
    confirmationDate: state.confirmationDate || null,
    personalInfo: buildPersonalInfo(state),
  };
}

function buildCreateEmployeePayload(state: EmployeeFormState, companyId: string) {
  return {
    companyId,
    ...buildEmployeeFields(state),
  };
}

export function EmployeeFormWizard({
  open,
  onClose,
  companyId,
  employeeId: editEmployeeId,
  onSuccess,
  hireApplicationId,
  onHired,
}: EmployeeFormWizardProps) {
  const isEditMode = Boolean(editEmployeeId);
  const isHireMode = Boolean(hireApplicationId) && !isEditMode;
  const [hirePrefill, setHirePrefill] = useState<CandidateHirePrefill | null>(null);
  const canEditTax = usePermission('payroll', 'edit');
  const canViewTax = usePermission('payroll', 'view');

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<EmployeeFormState>(createDefaultEmployeeFormState);
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof EmployeeFormState, boolean>>>({});
  const [savedEmployeeId, setSavedEmployeeId] = useState<string | null>(editEmployeeId ?? null);
  const [savedEmployee, setSavedEmployee] = useState<EmployeeRecord | null>(null);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [docDraft, setDocDraft] = useState<PendingDocument>({
    localId: '',
    documentTypeId: '',
    expiryDate: '',
    fieldValues: {},
    file: null,
  });
  const [docDraftErrors, setDocDraftErrors] = useState<Record<string, string>>({});

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ id: string; name: string }[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<{ id: string; name: string }[]>([]);
  const [costCentres, setCostCentres] = useState<{ id: string; name: string; code: string }[]>([]);
  const [managers, setManagers] = useState<{ id: string; fullName: string }[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentTypeRecord[]>([]);
  const [taxIdMasked, setTaxIdMasked] = useState<string | null>(null);
  const [bankMasked, setBankMasked] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planLimitHit, setPlanLimitHit] = useState(false);
  const canViewPlan = usePermission('settings', 'view');
  const { navigate } = useNav();

  const showSaveError = (err: unknown, fallback: string) => {
    setError(err instanceof ApiError ? err.message : fallback);
    setPlanLimitHit(err instanceof ApiError && err.code === 'PLAN_EMPLOYEE_LIMIT_REACHED');
  };

  const currentStep = STEP_KEYS[stepIndex];
  const activeEmployeeId = savedEmployeeId ?? editEmployeeId ?? null;

  const employeeDocTypes = useMemo(
    () => docTypes.filter((t) => t.isActive && t.scope === 'employee'),
    [docTypes],
  );

  const selectedDocType = employeeDocTypes.find((t) => t.id === docDraft.documentTypeId);

  const resetWizard = useCallback(() => {
    setStepIndex(0);
    setForm(createDefaultEmployeeFormState());
    setErrors({});
    setTouched({});
    setSavedEmployeeId(editEmployeeId ?? null);
    setSavedEmployee(null);
    setPendingDocuments([]);
    setDocDraft({
      localId: '',
      documentTypeId: '',
      expiryDate: '',
      fieldValues: {},
      file: null,
    });
    setDocDraftErrors({});
    setTaxIdMasked(null);
    setBankMasked(null);
    setError(null);
    setPlanLimitHit(false);
    setHirePrefill(null);
  }, [editEmployeeId]);

  const loadReferenceData = useCallback(async () => {
    const [depts, desigs, types, centres, emps, typesDocs] = await Promise.all([
      listDepartments(companyId),
      listDesignations(companyId),
      listEmploymentTypes(companyId),
      listCostCentres(companyId),
      listEmployees(companyId),
      listDocumentTypes(companyId),
    ]);
    setDepartments(depts.map((d) => ({ id: d.id, name: d.name })));
    setDesignations(desigs.map((d) => ({ id: d.id, name: d.name })));
    setEmploymentTypes(types.map((t) => ({ id: t.id, name: t.name })));
    setCostCentres(centres.map((c) => ({ id: c.id, name: c.name, code: c.code })));
    setDocTypes(typesDocs);
    setManagers(
      emps
        .filter((e) => e.id !== editEmployeeId)
        .map((e) => ({ id: e.id, fullName: e.fullName })),
    );
  }, [companyId, editEmployeeId]);

  const loadEmployee = useCallback(async () => {
    if (!editEmployeeId) return;
    setLoading(true);
    setError(null);
    try {
      const record = await getEmployee(editEmployeeId);
      setForm(employeeToFormState(record));
      setSavedEmployee(record);
      setSavedEmployeeId(record.id);

      if (canViewTax) {
        try {
          const tax = await getEmployeeTaxProfile(editEmployeeId);
          setTaxIdMasked(tax.taxIdNumberMasked);
          setBankMasked(tax.bankAccountNumberMasked);
          const regime = tax.taxSettings?.regime;
          if (typeof regime === 'string') {
            setForm((prev) => ({ ...prev, taxRegime: regime }));
          }
        } catch {
          // Tax profile may not exist yet
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load employee');
    } finally {
      setLoading(false);
    }
  }, [editEmployeeId, canViewTax]);

  useEffect(() => {
    if (!open) return;
    resetWizard();
    void (async () => {
      setLoading(true);
      try {
        await loadReferenceData();
        if (editEmployeeId) {
          await loadEmployee();
        } else if (hireApplicationId) {
          const prefill = await getHirePrefill(hireApplicationId);
          setHirePrefill(prefill);
          setForm(prefillToFormState(prefill));
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load form data');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, editEmployeeId, hireApplicationId, resetWizard, loadReferenceData, loadEmployee]);

  const touchField = (field: keyof EmployeeFormState) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const updateForm = <K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (touched[key]) {
        const stepErrors =
          currentStep === 'personal'
            ? validatePersonalStep(next)
            : currentStep === 'employment'
              ? validateEmploymentStep(next)
              : currentStep === 'bankTax'
                ? validateBankTaxStep(next)
                : {};
        setErrors((prevErr) => ({ ...prevErr, [key]: stepErrors[key] }));
      }
      return next;
    });
  };

  const validateCurrentStep = (): boolean => {
    let stepErrors: EmployeeFormErrors = {};
    if (currentStep === 'personal') stepErrors = validatePersonalStep(form);
    else if (currentStep === 'employment') stepErrors = validateEmploymentStep(form);
    else if (currentStep === 'bankTax') stepErrors = validateBankTaxStep(form);

    setErrors(stepErrors);
    setTouched((prev) => ({
      ...prev,
      ...Object.fromEntries(Object.keys(stepErrors).map((k) => [k, true])),
    }));
    return Object.keys(stepErrors).length === 0;
  };

  const persistEmployee = async (): Promise<EmployeeRecord> => {
    if (activeEmployeeId) {
      return updateEmployee(activeEmployeeId, buildEmployeeFields(form));
    }
    if (isHireMode && hireApplicationId) {
      const application = await hireApplication(hireApplicationId, {
        ...buildEmployeeFields(form),
        workLocationId: hirePrefill?.workLocationId ?? null,
      });
      onHired?.(application);
      if (!application.hiredEmployeeId) throw new ApiError('The hire did not return an employee', 500);
      const hiredEmployee = await getEmployee(application.hiredEmployeeId);
      setSavedEmployeeId(hiredEmployee.id);
      setSavedEmployee(hiredEmployee);
      return hiredEmployee;
    }
    const created = await createEmployee(buildCreateEmployeePayload(form, companyId));
    setSavedEmployeeId(created.id);
    setSavedEmployee(created);
    return created;
  };

  const persistTaxProfile = async (employeeId: string) => {
    if (!canEditTax) return;
    const hasTaxInput =
      form.taxIdNumber.trim() ||
      form.bankAccountNumber.trim() ||
      form.taxRegime.trim();
    if (!hasTaxInput) return;

    const input: {
      taxIdNumber?: string | null;
      bankAccountNumber?: string | null;
      taxSettings?: Record<string, unknown>;
    } = {};

    if (form.taxIdNumber.trim()) {
      input.taxIdNumber = form.taxIdNumber.trim();
    }
    if (form.bankAccountNumber.trim()) {
      input.bankAccountNumber = form.bankAccountNumber.trim();
    }
    if (form.taxRegime.trim()) {
      input.taxSettings = { regime: form.taxRegime.trim() };
    }

    await updateEmployeeTaxProfile(employeeId, input);
  };

  const uploadPendingDocuments = async (employeeId: string) => {
    for (const doc of pendingDocuments) {
      const created = await createEmployeeDocument(employeeId, {
        documentTypeId: doc.documentTypeId,
        fields: doc.fieldValues,
        expiryDate: doc.expiryDate || null,
      });
      if (doc.file) {
        await uploadEmployeeDocumentFile(employeeId, created.id, doc.file);
      }
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) return;

    setSubmitting(true);
    setError(null);
    try {
      if (currentStep === 'employment') {
        const record = await persistEmployee();
        setSavedEmployee(record);
      } else if (currentStep === 'bankTax' && activeEmployeeId) {
        await persistTaxProfile(activeEmployeeId);
      }
      setStepIndex((i) => Math.min(i + 1, STEP_KEYS.length - 1));
    } catch (err) {
      showSaveError(err, 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let record = savedEmployee;
      if (!record) {
        record = await persistEmployee();
        setSavedEmployee(record);
      } else if (isEditMode) {
        record = await persistEmployee();
        setSavedEmployee(record);
      }

      const employeeId = record.id;
      if (currentStep === 'bankTax' || form.taxIdNumber || form.bankAccountNumber || form.taxRegime) {
        await persistTaxProfile(employeeId);
      }
      if (pendingDocuments.length > 0) {
        await uploadPendingDocuments(employeeId);
      }

      onSuccess?.(record);
      onClose();
    } catch (err) {
      showSaveError(err, 'Failed to save employee');
    } finally {
      setSubmitting(false);
    }
  };

  const addPendingDocument = () => {
    const fieldDefs =
      selectedDocType?.fields.map((f) => ({
        key: f.fieldKey ?? '',
        label: f.label,
        required: f.required,
      })) ?? [];
    const draftErrors = validateDocumentDraft(
      docDraft.documentTypeId,
      fieldDefs,
      docDraft.fieldValues,
    );
    setDocDraftErrors(draftErrors);
    if (Object.keys(draftErrors).length > 0) return;

    setPendingDocuments((prev) => [
      ...prev,
      {
        ...docDraft,
        localId: crypto.randomUUID(),
      },
    ]);
    setDocDraft({
      localId: '',
      documentTypeId: '',
      expiryDate: '',
      fieldValues: {},
      file: null,
    });
    setDocDraftErrors({});
  };

  const showError = (field: keyof EmployeeFormState) =>
    touched[field] ? errors[field] : undefined;

  const renderPersonalStep = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <Label>First name *</Label>
        <Input
          value={form.firstName}
          onChange={(e) => updateForm('firstName', e.target.value)}
          onBlur={() => touchField('firstName')}
          aria-invalid={Boolean(showError('firstName'))}
        />
        <FieldError message={showError('firstName')} />
      </div>
      <div>
        <Label>Last name *</Label>
        <Input
          value={form.lastName}
          onChange={(e) => updateForm('lastName', e.target.value)}
          onBlur={() => touchField('lastName')}
          aria-invalid={Boolean(showError('lastName'))}
        />
        <FieldError message={showError('lastName')} />
      </div>
      <div className="sm:col-span-2">
        <Label>Work email</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => updateForm('email', e.target.value)}
          onBlur={() => touchField('email')}
          aria-invalid={Boolean(showError('email'))}
        />
        <FieldError message={showError('email')} />
      </div>
      <div>
        <Label>Phone</Label>
        <Input
          value={form.phone}
          onChange={(e) => updateForm('phone', e.target.value)}
        />
      </div>
      <div>
        <Label>Mobile</Label>
        <Input
          value={form.mobile}
          onChange={(e) => updateForm('mobile', e.target.value)}
        />
      </div>
      <div className="sm:col-span-2 border-t border-base pt-4 mt-1">
        <p className="text-xs font-medium text-secondary mb-3">Emergency contact</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Name</Label>
            <Input
              value={form.emergencyName}
              onChange={(e) => updateForm('emergencyName', e.target.value)}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={form.emergencyPhone}
              onChange={(e) => updateForm('emergencyPhone', e.target.value)}
            />
          </div>
          <div>
            <Label>Relationship</Label>
            <Input
              value={form.emergencyRelationship}
              onChange={(e) => updateForm('emergencyRelationship', e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="sm:col-span-2 border-t border-base pt-4 mt-1">
        <p className="text-xs font-medium text-secondary mb-3">Address</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Line 1</Label>
            <Input
              value={form.addressLine1}
              onChange={(e) => updateForm('addressLine1', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Line 2</Label>
            <Input
              value={form.addressLine2}
              onChange={(e) => updateForm('addressLine2', e.target.value)}
            />
          </div>
          <div>
            <Label>City</Label>
            <Input value={form.city} onChange={(e) => updateForm('city', e.target.value)} />
          </div>
          <div>
            <Label>State / Province</Label>
            <Input value={form.state} onChange={(e) => updateForm('state', e.target.value)} />
          </div>
          <div>
            <Label>Postal code</Label>
            <Input
              value={form.postalCode}
              onChange={(e) => updateForm('postalCode', e.target.value)}
            />
          </div>
          <div>
            <Label>Country</Label>
            <Input
              value={form.country}
              onChange={(e) => updateForm('country', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderEmploymentStep = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <Label>Employee number *</Label>
        <Input
          value={form.employeeNumber}
          onChange={(e) => updateForm('employeeNumber', e.target.value)}
          onBlur={() => touchField('employeeNumber')}
          aria-invalid={Boolean(showError('employeeNumber'))}
        />
        <FieldError message={showError('employeeNumber')} />
      </div>
      <div>
        <Label>Hire date *</Label>
        <Input
          type="date"
          value={form.hireDate}
          onChange={(e) => updateForm('hireDate', e.target.value)}
          onBlur={() => touchField('hireDate')}
          aria-invalid={Boolean(showError('hireDate'))}
        />
        <FieldError message={showError('hireDate')} />
      </div>
      <div>
        <Label>Department</Label>
        <Select
          value={form.departmentId}
          onChange={(e) => updateForm('departmentId', e.target.value)}
        >
          <option value="">None</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Designation</Label>
        <Select
          value={form.designationId}
          onChange={(e) => updateForm('designationId', e.target.value)}
        >
          <option value="">None</option>
          {designations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Employment type</Label>
        <Select
          value={form.employmentTypeId}
          onChange={(e) => updateForm('employmentTypeId', e.target.value)}
        >
          <option value="">None</option>
          {employmentTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Reporting manager</Label>
        <Select
          value={form.managerId}
          onChange={(e) => updateForm('managerId', e.target.value)}
        >
          <option value="">None</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.fullName}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Cost centre</Label>
        <Select
          value={form.costCentreId}
          onChange={(e) => updateForm('costCentreId', e.target.value)}
        >
          <option value="">None</option>
          {costCentres.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Employment status</Label>
        <Select
          value={form.employmentStatus}
          onChange={(e) =>
            updateForm('employmentStatus', e.target.value as EmploymentStatus)
          }
        >
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </Select>
      </div>
      <div>
        <Label>Probation end date</Label>
        <Input
          type="date"
          value={form.probationEndDate}
          onChange={(e) => updateForm('probationEndDate', e.target.value)}
        />
      </div>
      <div>
        <Label>Confirmation date</Label>
        <Input
          type="date"
          value={form.confirmationDate}
          onChange={(e) => updateForm('confirmationDate', e.target.value)}
        />
      </div>
    </div>
  );

  const renderBankTaxStep = () => {
    if (!canViewTax) {
      return (
        <p className="text-sm text-secondary">
          You do not have permission to view bank or tax details. Skip this step or ask an
          administrator with payroll access to complete it later.
        </p>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-secondary">
          Payment and tax identifiers are encrypted at rest. Enter new values below to set or
          update them.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Tax ID / PAN</Label>
            {taxIdMasked ? (
              <p className="text-xs text-muted mb-1.5">Current: {taxIdMasked}</p>
            ) : null}
            <Input
              value={form.taxIdNumber}
              onChange={(e) => updateForm('taxIdNumber', e.target.value)}
              placeholder={taxIdMasked ? 'Enter new value to update' : 'Enter tax ID'}
              disabled={!canEditTax}
            />
          </div>
          <div>
            <Label>Bank account number</Label>
            {bankMasked ? (
              <p className="text-xs text-muted mb-1.5">Current: {bankMasked}</p>
            ) : null}
            <Input
              value={form.bankAccountNumber}
              onChange={(e) => updateForm('bankAccountNumber', e.target.value)}
              placeholder={bankMasked ? 'Enter new value to update' : 'Enter account number'}
              disabled={!canEditTax}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Tax regime / withholding notes</Label>
            <Input
              value={form.taxRegime}
              onChange={(e) => updateForm('taxRegime', e.target.value)}
              placeholder="e.g. Standard W-4, Old regime"
              disabled={!canEditTax}
            />
          </div>
        </div>
        {!canEditTax ? (
          <p className="text-xs text-muted">
            Payroll edit permission is required to update these fields.
          </p>
        ) : null}
      </div>
    );
  };

  const renderDocumentsStep = () => (
    <div className="space-y-5">
      <p className="text-sm text-secondary">
        Add optional documents now or upload them later from the employee profile.
        {!activeEmployeeId && !isEditMode
          ? ' The employee record will be created when you finish this wizard.'
          : null}
      </p>

      {pendingDocuments.length > 0 ? (
        <ul className="space-y-2">
          {pendingDocuments.map((doc) => {
            const typeName =
              employeeDocTypes.find((t) => t.id === doc.documentTypeId)?.name ?? 'Document';
            return (
              <li
                key={doc.localId}
                className="flex items-center gap-3 rounded-lg border border-base px-3 py-2"
              >
                <FileText className="h-4 w-4 text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{typeName}</p>
                  <p className="text-xs text-muted truncate">
                    {doc.file?.name ?? 'No file attached'}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-muted hover:text-error-600 p-1 rounded"
                  onClick={() =>
                    setPendingDocuments((prev) =>
                      prev.filter((d) => d.localId !== doc.localId),
                    )
                  }
                  aria-label={`Remove ${typeName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="rounded-xl border border-base p-4 space-y-4 bg-[rgb(var(--bg-muted))]/40">
        <p className="text-xs font-medium text-secondary flex items-center gap-1.5">
          <Upload className="h-3.5 w-3.5" /> Add document
        </p>
        <div>
          <Label>Document type</Label>
          <Select
            value={docDraft.documentTypeId}
            onChange={(e) =>
              setDocDraft({
                ...docDraft,
                documentTypeId: e.target.value,
                fieldValues: {},
              })
            }
          >
            <option value="">Select type…</option>
            {employeeDocTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <FieldError message={docDraftErrors.documentTypeId} />
        </div>
        {selectedDocType?.tracksExpiry ? (
          <div>
            <Label>Expiry date</Label>
            <Input
              type="date"
              value={docDraft.expiryDate}
              onChange={(e) => setDocDraft({ ...docDraft, expiryDate: e.target.value })}
            />
          </div>
        ) : null}
        {selectedDocType?.fields.map((field) => (
          <div key={field.id ?? field.fieldKey}>
            <Label>
              {field.label}
              {field.required ? ' *' : ''}
            </Label>
            {field.fieldType === 'dropdown' ? (
              <Select
                value={docDraft.fieldValues[field.fieldKey ?? ''] ?? ''}
                onChange={(e) =>
                  setDocDraft({
                    ...docDraft,
                    fieldValues: {
                      ...docDraft.fieldValues,
                      [field.fieldKey ?? '']: e.target.value,
                    },
                  })
                }
              >
                <option value="">Select…</option>
                {field.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            ) : field.fieldType === 'date' ? (
              <Input
                type="date"
                value={docDraft.fieldValues[field.fieldKey ?? ''] ?? ''}
                onChange={(e) =>
                  setDocDraft({
                    ...docDraft,
                    fieldValues: {
                      ...docDraft.fieldValues,
                      [field.fieldKey ?? '']: e.target.value,
                    },
                  })
                }
              />
            ) : (
              <Input
                type={field.fieldType === 'number' ? 'number' : 'text'}
                value={docDraft.fieldValues[field.fieldKey ?? ''] ?? ''}
                onChange={(e) =>
                  setDocDraft({
                    ...docDraft,
                    fieldValues: {
                      ...docDraft.fieldValues,
                      [field.fieldKey ?? '']: e.target.value,
                    },
                  })
                }
              />
            )}
            <FieldError message={docDraftErrors[field.fieldKey ?? '']} />
          </div>
        ))}
        <div>
          <Label>Attachment (PDF, JPG, PNG — max 10MB)</Label>
          <Input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(e) =>
              setDocDraft({ ...docDraft, file: e.target.files?.[0] ?? null })
            }
          />
        </div>
        <Button variant="secondary" size="md" onClick={addPendingDocument}>
          <Plus className="h-4 w-4" /> Add to queue
        </Button>
      </div>
    </div>
  );

  const stepContent = {
    personal: renderPersonalStep(),
    employment: renderEmploymentStep(),
    bankTax: renderBankTaxStep(),
    documents: renderDocumentsStep(),
  }[currentStep];

  const isLastStep = stepIndex === STEP_KEYS.length - 1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditMode ? 'Edit Employee' : isHireMode ? 'Convert to Employee' : 'Add Employee'}
      description={`Step ${stepIndex + 1} of ${WIZARD_STEPS.length} — ${WIZARD_STEPS[stepIndex].label}`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          {stepIndex > 0 ? (
            <Button variant="secondary" onClick={handleBack} disabled={submitting}>
              Back
            </Button>
          ) : null}
          {isLastStep ? (
            <Button variant="primary" onClick={() => void handleFinish()} disabled={submitting || loading}>
              {submitting ? 'Saving…' : isEditMode ? 'Save changes' : 'Create employee'}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void handleNext()} disabled={submitting || loading}>
              {submitting ? 'Saving…' : 'Next'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        <StepProgress steps={WIZARD_STEPS} currentIndex={stepIndex} />
        {isHireMode && hirePrefill ? (
          <div className="flex items-start gap-3 rounded-lg border border-accent-200 dark:border-accent-800/60 bg-accent-50 dark:bg-accent-950/30 px-4 py-3 text-sm">
            <UserCheck className="h-4 w-4 mt-0.5 text-accent-600 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium text-primary">
                Pre-filled from {hirePrefill.candidateName}&apos;s application and accepted offer
              </p>
              <p className="text-xs text-secondary mt-0.5">
                {hirePrefill.jobTitle}
                {hirePrefill.annualSalary != null
                  ? ` · ${hirePrefill.currency} ${hirePrefill.annualSalary.toLocaleString()} a year`
                  : ''}
                {hirePrefill.reportingTo && !hirePrefill.managerId
                  ? ` · "${hirePrefill.reportingTo}" didn't match an employee — pick the manager on the Employment step`
                  : ''}
                . {savedEmployee
                  ? 'The employee record is created and onboarding has started.'
                  : 'The employee is created when you finish the Employment step.'}
              </p>
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-error-600 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-2">
            <span className="flex-1">{error}</span>
            {planLimitHit && canViewPlan ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onClose();
                  navigate('billing');
                }}
              >
                {billingCopy.limitError.viewPlan}
              </Button>
            ) : null}
          </div>
        ) : null}
        {loading ? (
          <p className="text-sm text-secondary py-8 text-center">Loading employee data…</p>
        ) : (
          stepContent
        )}
      </div>
    </Modal>
  );
}
