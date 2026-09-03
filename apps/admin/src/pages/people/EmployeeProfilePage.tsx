import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Building2,
  UserCog,
  Loader2,
  Save,
} from 'lucide-react';
import type { EmployeePersonalInfo, EmployeeRecord, EmploymentStatus } from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Toggle';
import { Input, Label, Select } from '@/components/ui/Form';
import { useNav } from '@/context/NavContext';
import { getEmployee, listEmployees, updateEmployee } from '@/lib/employees-api';
import {
  listCostCentres,
  listDepartments,
  listDesignations,
  listEmploymentTypes,
} from '@/lib/organization-api';
import { useCompany } from '@/context/CompanyContext';
import { ApiError } from '@/lib/tenant-api-client';

type Tab = 'overview' | 'employment' | 'contact';

const tabs: { key: Tab; label: string; icon: typeof Briefcase }[] = [
  { key: 'overview', label: 'Overview', icon: UserCog },
  { key: 'employment', label: 'Employment', icon: Briefcase },
  { key: 'contact', label: 'Contact & Address', icon: Mail },
];

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
  const [emp, setEmp] = useState<EmployeeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editMode, setEditMode] = useState(false);
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

  if (loading || !emp) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
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
        <ArrowLeft className="h-4 w-4" /> Back to Directory
      </button>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardBody className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
          <Avatar name={emp.fullName} size="lg" />
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-primary">{emp.fullName}</h1>
              <Badge tone="success" dot>{statusLabel[emp.employmentStatus]}</Badge>
            </div>
            <p className="text-sm text-secondary mt-1">
              {emp.designation?.name ?? 'No designation'} · {emp.department?.name ?? 'No department'}
            </p>
            <p className="text-xs text-muted mt-1">{emp.employeeNumber}</p>
          </div>
          <div className="flex gap-2">
            {editMode ? (
              <>
                <Button variant="secondary" onClick={() => { setEditMode(false); applyEmployeeToForm(emp); }}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
                  <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={() => setEditMode(true)}>Edit Profile</Button>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="flex gap-1 border-b border-base">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? 'border-accent-600 text-accent-600'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Personal</CardTitle></CardHeader>
            <CardBody className="grid grid-cols-2 gap-4">
              {editMode ? (
                <>
                  <div><Label>First Name</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                  <div><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Employee Number</Label><Input value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} /></div>
                </>
              ) : (
                <>
                  <InfoRow label="Full Name" value={emp.fullName} />
                  <InfoRow label="Employee Number" value={emp.employeeNumber} />
                  <InfoRow label="Company" value={emp.company?.name ?? '—'} />
                  <InfoRow label="Status" value={statusLabel[emp.employmentStatus]} />
                </>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Quick Contact</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted" />
                {emp.personalInfo?.contact?.email ? String(emp.personalInfo.contact.email) : '—'}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted" />
                {emp.personalInfo?.contact?.phone ? String(emp.personalInfo.contact.phone) : '—'}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted" />
                {emp.personalInfo?.address?.city ? String(emp.personalInfo.address.city) : '—'}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'employment' && (
        <Card>
          <CardHeader><CardTitle>Employment Details</CardTitle></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {editMode ? (
              <>
                <div>
                  <Label>Department</Label>
                  <Select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                    <option value="">None</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Designation</Label>
                  <Select value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value })}>
                    <option value="">None</option>
                    {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Employment Type</Label>
                  <Select value={form.employmentTypeId} onChange={(e) => setForm({ ...form, employmentTypeId: e.target.value })}>
                    <option value="">None</option>
                    {employmentTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Manager</Label>
                  <Select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
                    <option value="">None</option>
                    {managers.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Cost Centre</Label>
                  <Select value={form.costCentreId} onChange={(e) => setForm({ ...form, costCentreId: e.target.value })}>
                    <option value="">None</option>
                    {costCentres.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.employmentStatus} onChange={(e) => setForm({ ...form, employmentStatus: e.target.value as EmploymentStatus })}>
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="inactive">Inactive</option>
                    <option value="terminated">Terminated</option>
                  </Select>
                </div>
                <div><Label>Hire Date</Label><Input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} /></div>
                <div><Label>Probation End</Label><Input type="date" value={form.probationEndDate} onChange={(e) => setForm({ ...form, probationEndDate: e.target.value })} /></div>
                <div><Label>Confirmation Date</Label><Input type="date" value={form.confirmationDate} onChange={(e) => setForm({ ...form, confirmationDate: e.target.value })} /></div>
              </>
            ) : (
              <>
                <InfoRow label="Department" value={emp.department?.name ?? '—'} />
                <InfoRow label="Designation" value={emp.designation?.name ?? '—'} />
                <InfoRow label="Employment Type" value={emp.employmentType?.name ?? '—'} />
                <InfoRow label="Manager" value={emp.manager?.fullName ?? '—'} />
                <InfoRow label="Cost Centre" value={emp.costCentre ? `${emp.costCentre.code} — ${emp.costCentre.name}` : '—'} />
                <InfoRow label="Work Location" value={emp.workLocation?.name ?? '—'} />
                <InfoRow label="Hire Date" value={emp.hireDate} />
                <InfoRow label="Probation End" value={emp.probationEndDate ?? '—'} />
                <InfoRow label="Confirmation" value={emp.confirmationDate ?? '—'} />
              </>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'contact' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              {editMode ? (
                <>
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>Mobile</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
                </>
              ) : (
                <>
                  <InfoRow label="Email" value={String(emp.personalInfo?.contact?.email ?? '')} />
                  <InfoRow label="Phone" value={String(emp.personalInfo?.contact?.phone ?? '')} />
                  <InfoRow label="Mobile" value={String(emp.personalInfo?.contact?.mobile ?? '')} />
                </>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Emergency & Address</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              {editMode ? (
                <>
                  <div><Label>Emergency Contact</Label><Input value={form.emergencyName} onChange={(e) => setForm({ ...form, emergencyName: e.target.value })} /></div>
                  <div><Label>Emergency Phone</Label><Input value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} /></div>
                  <div><Label>Relationship</Label><Input value={form.emergencyRelationship} onChange={(e) => setForm({ ...form, emergencyRelationship: e.target.value })} /></div>
                  <div><Label>Address Line 1</Label><Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                    <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Postal Code</Label><Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div>
                    <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                  </div>
                </>
              ) : (
                <>
                  <InfoRow label="Emergency Contact" value={String(emp.personalInfo?.emergencyContact?.name ?? '')} />
                  <InfoRow label="Emergency Phone" value={String(emp.personalInfo?.emergencyContact?.phone ?? '')} />
                  <InfoRow label="Relationship" value={String(emp.personalInfo?.emergencyContact?.relationship ?? '')} />
                  <InfoRow label="Address" value={String(emp.personalInfo?.address?.line1 ?? '')} />
                  <InfoRow label="City / State" value={[emp.personalInfo?.address?.city, emp.personalInfo?.address?.state].filter(Boolean).join(', ')} />
                  <InfoRow label="Postal / Country" value={[emp.personalInfo?.address?.postalCode, emp.personalInfo?.address?.country].filter(Boolean).join(' ')} />
                </>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted" />
          <CardTitle>Record Metadata</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-4 text-sm">
          <InfoRow label="Created" value={new Date(emp.createdAt).toLocaleString()} />
          <InfoRow label="Last Updated" value={new Date(emp.updatedAt).toLocaleString()} />
          <InfoRow label="Company" value={emp.company?.name ?? '—'} />
          <div className="flex items-center gap-2 text-muted">
            <Building2 className="h-4 w-4" /> Tenant-scoped employee record
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
