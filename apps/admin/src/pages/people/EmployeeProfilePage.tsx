import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Save,
  User,
  FileText,
  History,
  Palmtree,
  Pencil,
  CheckCircle2,
  KeyRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  EmployeePersonalInfo,
  EmployeeRecord,
  EmploymentStatus,
  LifecycleEventRecord,
} from '@hrm/shared-types';
import { PermissionGate, usePermission } from '@hrm/portal-ui';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Toggle';
import { Input, Label, Select } from '@/components/ui/Form';
import { EmployeeProfileSkeleton } from '@/components/people/EmployeeProfileSkeleton';
import { EmployeeFormWizard } from '@/components/people/EmployeeFormWizard';
import { EmployeeProfileDocumentsTab } from '@/components/people/EmployeeProfileDocumentsTab';
import { EmployeeProfileLifecycleTab } from '@/components/people/EmployeeProfileLifecycleTab';
import { EmployeeLeaveBalances } from '@/components/leave/EmployeeLeaveBalances';
import { EmployeePortalAccessTab } from '@/components/people/EmployeePortalAccessTab';
import { LifecycleActionPanel } from '@/components/people/LifecycleActionPanel';
import { LifecycleActionsMenu } from '@/components/people/LifecycleActionsMenu';
import { useNav } from '@/context/NavContext';
import { EVENT_LABELS } from '@/lib/lifecycle-display';
import type { LifecycleActionKind } from '@/lib/lifecycle-actions';
import { getEmployee, listEmployees, updateEmployee } from '@/lib/employees-api';
import {
  listCostCentres,
  listDepartments,
  listDesignations,
  listEmploymentTypes,
} from '@/lib/organization-api';
import { useCompany } from '@/context/CompanyContext';
import { ApiError } from '@/lib/tenant-api-client';

type Tab = 'personal' | 'employment' | 'leave' | 'documents' | 'lifecycle' | 'access';

const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'personal', label: 'Personal Info', icon: User },
  { key: 'employment', label: 'Employment Info', icon: Briefcase },
  { key: 'leave', label: 'Leave', icon: Palmtree },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'lifecycle', label: 'Lifecycle History', icon: History },
  { key: 'access', label: 'Portal Access', icon: KeyRound },
];

const statusTone: Record<
  EmploymentStatus,
  'success' | 'warning' | 'accent' | 'error' | 'neutral'
> = {
  active: 'success',
  on_leave: 'warning',
  inactive: 'neutral',
  terminated: 'error',
};

const statusLabel: Record<EmploymentStatus, string> = {
  active: 'Active',
  on_leave: 'On Leave',
  inactive: 'Inactive',
  terminated: 'Terminated',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-primary">{value || '—'}</span>
    </div>
  );
}

export function EmployeeProfilePage() {
  const { navigate, selectedEmployeeId } = useNav();
  const { companyId } = useCompany();
  const canViewAccess = usePermission('settings', 'view');
  const canViewLeave = usePermission('leave', 'view');
  const visibleTabs = tabs.filter(
    (tab) =>
      (tab.key !== 'access' || canViewAccess) && (tab.key !== 'leave' || canViewLeave),
  );
  const [emp, setEmp] = useState<EmployeeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const [editMode, setEditMode] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleActionKind | null>(null);
  const [lifecycleRefreshKey, setLifecycleRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ id: string; name: string }[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<{ id: string; name: string }[]>([]);
  const [costCentres, setCostCentres] = useState<{ id: string; name: string; code: string }[]>([]);
  const [managers, setManagers] = useState<{ id: string; fullName: string }[]>([]);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    employeeNumber: '',
    employmentStatus: 'active' as EmploymentStatus,
    departmentId: '',
    designationId: '',
    employmentTypeId: '',
    managerId: '',
    costCentreId: '',
    hireDate: '',
    probationEndDate: '',
    confirmationDate: '',
    email: '',
    phone: '',
    mobile: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelationship: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  });

  const applyEmployeeToForm = useCallback((record: EmployeeRecord) => {
    const pi = record.personalInfo ?? {};
    const contact = pi.contact ?? {};
    const emergency = pi.emergencyContact ?? {};
    const address = pi.address ?? {};
    setForm({
      firstName: record.firstName,
      lastName: record.lastName,
      employeeNumber: record.employeeNumber,
      employmentStatus: record.employmentStatus,
      departmentId: record.departmentId ?? '',
      designationId: record.designationId ?? '',
      employmentTypeId: record.employmentTypeId ?? '',
      managerId: record.managerId ?? '',
      costCentreId: record.costCentreId ?? '',
      hireDate: record.hireDate,
      probationEndDate: record.probationEndDate ?? '',
      confirmationDate: record.confirmationDate ?? '',
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
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedEmployeeId || !companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [record, depts, desigs, types, centres, allEmps] = await Promise.all([
        getEmployee(selectedEmployeeId),
        listDepartments(companyId),
        listDesignations(companyId),
        listEmploymentTypes(companyId),
        listCostCentres(companyId),
        listEmployees(companyId),
      ]);
      setEmp(record);
      applyEmployeeToForm(record);
      setDepartments(depts.map((d) => ({ id: d.id, name: d.name })));
      setDesignations(desigs.map((d) => ({ id: d.id, name: d.name })));
      setEmploymentTypes(types.map((t) => ({ id: t.id, name: t.name })));
      setCostCentres(centres.map((c) => ({ id: c.id, name: c.name, code: c.code })));
      setManagers(
        allEmps
          .filter((e) => e.id !== selectedEmployeeId)
          .map((e) => ({ id: e.id, fullName: e.fullName })),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeId, companyId, applyEmployeeToForm]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleLifecycleRecorded = async (event: LifecycleEventRecord) => {
    setNotice(`${EVENT_LABELS[event.eventType]} recorded for ${event.effectiveDate}.`);
    setLifecycleRefreshKey((key) => key + 1);
    setActiveTab('lifecycle');
    setEditMode(false);
    if (!selectedEmployeeId) return;
    try {
      const record = await getEmployee(selectedEmployeeId);
      setEmp(record);
      applyEmployeeToForm(record);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to refresh profile');
    }
  };

  const buildPersonalInfo = (): EmployeePersonalInfo => ({
    contact: {
      email: form.email || undefined,
      phone: form.phone || undefined,
      mobile: form.mobile || undefined,
    },
    emergencyContact: {
      name: form.emergencyName || undefined,
      phone: form.emergencyPhone || undefined,
      relationship: form.emergencyRelationship || undefined,
    },
    address: {
      line1: form.addressLine1 || undefined,
      line2: form.addressLine2 || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      postalCode: form.postalCode || undefined,
      country: form.country || undefined,
    },
  });

  const handleSave = async () => {
    if (!selectedEmployeeId) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateEmployee(selectedEmployeeId, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        employeeNumber: form.employeeNumber.trim(),
        employmentStatus: form.employmentStatus,
        departmentId: form.departmentId || null,
        designationId: form.designationId || null,
        employmentTypeId: form.employmentTypeId || null,
        managerId: form.managerId || null,
        costCentreId: form.costCentreId || null,
        hireDate: form.hireDate,
        probationEndDate: form.probationEndDate || null,
        confirmationDate: form.confirmationDate || null,
        personalInfo: buildPersonalInfo(),
      });
      setEmp(updated);
      applyEmployeeToForm(updated);
      setEditMode(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const canEditCurrentTab =
    editMode && (activeTab === 'personal' || activeTab === 'employment');

  if (!selectedEmployeeId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        Select an employee from the directory.
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('emp-directory')}>
            Go to Directory
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <EmployeeProfileSkeleton />;
  }

  if (!emp) {
    return (
      <div className="p-8 text-center text-sm space-y-4">
        <p className="text-error-600">{error ?? 'Failed to load profile'}</p>
        <div className="flex justify-center gap-2">
          <Button variant="secondary" onClick={() => navigate('emp-directory')}>
            Go to Directory
          </Button>
          <Button variant="primary" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <button
        type="button"
        onClick={() => navigate('emp-directory')}
        className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Employees
      </button>

      {error ? (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-2">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-success-700 dark:text-success-400 bg-success-50 dark:bg-success-950/30 border border-success-200 dark:border-success-800 rounded-lg px-4 py-2"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="text-muted hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <Card>
        <CardBody className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
          <Avatar name={emp.fullName} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-primary">{emp.fullName}</h1>
              <Badge tone={statusTone[emp.employmentStatus]} dot>
                {statusLabel[emp.employmentStatus]}
              </Badge>
            </div>
            <p className="text-sm text-secondary mt-1">
              {emp.designation?.name ?? 'No designation'} ·{' '}
              {emp.department?.name ?? 'No department'}
            </p>
            <p className="text-xs text-muted mt-1">{emp.employeeNumber}</p>
          </div>
          {canEditCurrentTab ? (
            <div className="flex gap-2 shrink-0">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditMode(false);
                  applyEmployeeToForm(emp);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 shrink-0">
              <LifecycleActionsMenu employee={emp} onSelect={setLifecycleAction} />
              <PermissionGate module="employee" action="edit">
                <Button variant="secondary" onClick={() => setWizardOpen(true)}>
                  <Pencil className="h-4 w-4" /> Edit employee
                </Button>
                {(activeTab === 'personal' || activeTab === 'employment') && (
                  <Button variant="primary" onClick={() => setEditMode(true)}>
                    Quick edit {activeTab === 'personal' ? 'personal' : 'employment'}
                  </Button>
                )}
              </PermissionGate>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex gap-1 border-b border-base overflow-x-auto scrollbar-thin">
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setActiveTab(key);
              setEditMode(false);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap shrink-0 ${
              activeTab === key
                ? 'border-accent-600 text-accent-600'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'personal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
            </CardHeader>
            <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {editMode ? (
                <>
                  <div>
                    <Label>First name</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Last name</Label>
                    <Input
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Employee number</Label>
                    <Input
                      value={form.employeeNumber}
                      onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <InfoRow label="Full name" value={emp.fullName} />
                  <InfoRow label="Employee number" value={emp.employeeNumber} />
                  <InfoRow label="Company" value={emp.company?.name ?? '—'} />
                  <InfoRow label="Status" value={statusLabel[emp.employmentStatus]} />
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {editMode ? (
                <>
                  <div>
                    <Label>Work email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Mobile</Label>
                      <Input
                        value={form.mobile}
                        onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted shrink-0" />
                    {emp.personalInfo?.contact?.email
                      ? String(emp.personalInfo.contact.email)
                      : '—'}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted shrink-0" />
                    {emp.personalInfo?.contact?.phone
                      ? String(emp.personalInfo.contact.phone)
                      : '—'}
                  </div>
                  <InfoRow
                    label="Mobile"
                    value={String(emp.personalInfo?.contact?.mobile ?? '')}
                  />
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Emergency contact</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {editMode ? (
                <>
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={form.emergencyName}
                      onChange={(e) => setForm({ ...form, emergencyName: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={form.emergencyPhone}
                        onChange={(e) =>
                          setForm({ ...form, emergencyPhone: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Relationship</Label>
                      <Input
                        value={form.emergencyRelationship}
                        onChange={(e) =>
                          setForm({ ...form, emergencyRelationship: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <InfoRow
                    label="Name"
                    value={String(emp.personalInfo?.emergencyContact?.name ?? '')}
                  />
                  <InfoRow
                    label="Phone"
                    value={String(emp.personalInfo?.emergencyContact?.phone ?? '')}
                  />
                  <InfoRow
                    label="Relationship"
                    value={String(emp.personalInfo?.emergencyContact?.relationship ?? '')}
                  />
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Address</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {editMode ? (
                <>
                  <div>
                    <Label>Address line 1</Label>
                    <Input
                      value={form.addressLine1}
                      onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Address line 2</Label>
                    <Input
                      value={form.addressLine2}
                      onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>City</Label>
                      <Input
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>State</Label>
                      <Input
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Postal code</Label>
                      <Input
                        value={form.postalCode}
                        onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Country</Label>
                      <Input
                        value={form.country}
                        onChange={(e) => setForm({ ...form, country: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted shrink-0 mt-0.5" />
                    <div>
                      <div>{emp.personalInfo?.address?.line1 ?? '—'}</div>
                      {emp.personalInfo?.address?.line2 ? (
                        <div className="text-secondary">
                          {String(emp.personalInfo.address.line2)}
                        </div>
                      ) : null}
                      <div className="text-secondary mt-1">
                        {[
                          emp.personalInfo?.address?.city,
                          emp.personalInfo?.address?.state,
                          emp.personalInfo?.address?.postalCode,
                        ]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </div>
                      {emp.personalInfo?.address?.country ? (
                        <div className="text-muted text-xs mt-0.5">
                          {String(emp.personalInfo.address.country)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'employment' && (
        <Card>
          <CardHeader>
            <CardTitle>Employment details</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {editMode ? (
              <>
                <div>
                  <Label>Department</Label>
                  <Select
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
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
                    onChange={(e) => setForm({ ...form, designationId: e.target.value })}
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
                    onChange={(e) =>
                      setForm({ ...form, employmentTypeId: e.target.value })
                    }
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
                  <Label>Manager</Label>
                  <Select
                    value={form.managerId}
                    onChange={(e) => setForm({ ...form, managerId: e.target.value })}
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
                    onChange={(e) => setForm({ ...form, costCentreId: e.target.value })}
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
                  <Label>Status</Label>
                  <Select
                    value={form.employmentStatus}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        employmentStatus: e.target.value as EmploymentStatus,
                      })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="inactive">Inactive</option>
                    <option value="terminated">Terminated</option>
                  </Select>
                </div>
                <div>
                  <Label>Hire date</Label>
                  <Input
                    type="date"
                    value={form.hireDate}
                    onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Probation end</Label>
                  <Input
                    type="date"
                    value={form.probationEndDate}
                    onChange={(e) =>
                      setForm({ ...form, probationEndDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Confirmation date</Label>
                  <Input
                    type="date"
                    value={form.confirmationDate}
                    onChange={(e) =>
                      setForm({ ...form, confirmationDate: e.target.value })
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <InfoRow label="Department" value={emp.department?.name ?? '—'} />
                <InfoRow label="Designation" value={emp.designation?.name ?? '—'} />
                <InfoRow label="Employment type" value={emp.employmentType?.name ?? '—'} />
                <InfoRow label="Manager" value={emp.manager?.fullName ?? '—'} />
                <InfoRow
                  label="Cost centre"
                  value={
                    emp.costCentre ? `${emp.costCentre.code} — ${emp.costCentre.name}` : '—'
                  }
                />
                <InfoRow label="Work location" value={emp.workLocation?.name ?? '—'} />
                <InfoRow label="Hire date" value={emp.hireDate} />
                <InfoRow label="Probation end" value={emp.probationEndDate ?? '—'} />
                <InfoRow label="Confirmation" value={emp.confirmationDate ?? '—'} />
              </>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'leave' && canViewLeave && companyId ? (
        <EmployeeLeaveBalances
          employeeId={emp.id}
          companyId={companyId}
          probationEndDate={emp.probationEndDate}
        />
      ) : null}

      {activeTab === 'documents' && companyId ? (
        <EmployeeProfileDocumentsTab
          employeeId={selectedEmployeeId}
          companyId={companyId}
        />
      ) : null}

      {activeTab === 'lifecycle' ? (
        <EmployeeProfileLifecycleTab
          employeeId={selectedEmployeeId}
          refreshKey={lifecycleRefreshKey}
        />
      ) : null}

      {activeTab === 'access' && canViewAccess ? (
        <EmployeePortalAccessTab
          key={`${selectedEmployeeId}-${lifecycleRefreshKey}`}
          employeeId={selectedEmployeeId}
          employeeName={emp.fullName}
        />
      ) : null}

      {companyId ? (
        <>
          <EmployeeFormWizard
            open={wizardOpen}
            onClose={() => setWizardOpen(false)}
            companyId={companyId}
            employeeId={selectedEmployeeId}
            onSuccess={() => void load()}
          />
          <LifecycleActionPanel
            open={lifecycleAction !== null}
            kind={lifecycleAction}
            employee={emp}
            companyId={companyId}
            onClose={() => setLifecycleAction(null)}
            onRecorded={(event) => void handleLifecycleRecorded(event)}
          />
        </>
      ) : null}
    </div>
  );
}
