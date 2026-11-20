import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  EmployeeRecord,
  ProfileUpdateFieldKey,
  ProfileUpdateRequestRecord,
  ProfileUpdateRequestStatus,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { useAuth } from '@hrm/portal-ui';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Form';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusPill, type StatusPillTone } from '@/components/ui/StatusPill';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { ProfileUpdateRequestModal } from '@/components/my/ProfileUpdateRequestModal';
import { useMyEmployee } from '@/components/my/useMyEmployee';
import {
  cancelMyProfileUpdateRequest,
  listMyProfileUpdateRequests,
  updateMySelfProfile,
} from '@/lib/my-api';
import { ApiError } from '@/lib/tenant-api-client';

type EditableSection = 'contact' | 'emergency' | 'address';
type RequestFilter = 'all' | ProfileUpdateRequestStatus;

const REQUEST_STATUS_TONE: Record<ProfileUpdateRequestStatus, StatusPillTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'neutral',
};

const REQUEST_FILTERS: RequestFilter[] = ['all', 'pending', 'approved', 'rejected', 'cancelled'];

export function MyProfilePage() {
  const { t, i18n } = useAppTranslation();
  const { user } = useAuth();
  const { employeeId, profile, loading, error, reload } = useMyEmployee();
  const locale = i18n.language?.startsWith('bn') ? 'bn-BD' : 'en-GB';

  const [requests, setRequests] = useState<ProfileUpdateRequestRecord[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [editing, setEditing] = useState<EditableSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestFieldKey, setRequestFieldKey] = useState<ProfileUpdateFieldKey>('first_name');
  const [filter, setFilter] = useState<RequestFilter>('all');

  const [contactForm, setContactForm] = useState({ email: '', phone: '', mobile: '' });
  const [emergencyForm, setEmergencyForm] = useState({
    name: '',
    phone: '',
    relationship: '',
  });
  const [addressForm, setAddressForm] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  });

  const loadRequests = useCallback(async () => {
    if (!employeeId) {
      setRequestsLoading(false);
      return;
    }
    try {
      const list = await listMyProfileUpdateRequests(employeeId);
      setRequests(list);
    } catch {
      // Errors on main profile already surface in MyPageLayout
    } finally {
      setRequestsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  function startEdit(section: EditableSection, emp: EmployeeRecord) {
    setNotice(null);
    setActionError(null);
    if (section === 'contact') {
      setContactForm({
        email: emp.personalInfo?.contact?.email ?? '',
        phone: emp.personalInfo?.contact?.phone ?? '',
        mobile: emp.personalInfo?.contact?.mobile ?? '',
      });
    } else if (section === 'emergency') {
      setEmergencyForm({
        name: emp.personalInfo?.emergencyContact?.name ?? '',
        phone: emp.personalInfo?.emergencyContact?.phone ?? '',
        relationship: emp.personalInfo?.emergencyContact?.relationship ?? '',
      });
    } else {
      setAddressForm({
        line1: emp.personalInfo?.address?.line1 ?? '',
        line2: emp.personalInfo?.address?.line2 ?? '',
        city: emp.personalInfo?.address?.city ?? '',
        state: emp.personalInfo?.address?.state ?? '',
        postalCode: emp.personalInfo?.address?.postalCode ?? '',
        country: emp.personalInfo?.address?.country ?? '',
      });
    }
    setEditing(section);
  }

  async function saveSection(section: EditableSection) {
    if (!employeeId) return;
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      await updateMySelfProfile(
        employeeId,
        section === 'contact'
          ? { contact: contactForm }
          : section === 'emergency'
            ? { emergencyContact: emergencyForm }
            : { address: addressForm },
      );
      setEditing(null);
      setNotice(t('profile.actions.saved'));
      await reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : t('common.unknownError'));
    } finally {
      setSaving(false);
    }
  }

  function openRequestModal(fieldKey: ProfileUpdateFieldKey = 'first_name') {
    setNotice(null);
    setActionError(null);
    setRequestFieldKey(fieldKey);
    setRequestModalOpen(true);
  }

  function handleRequestSubmitted(created: ProfileUpdateRequestRecord) {
    setRequestModalOpen(false);
    setRequests((prev) => [created, ...prev]);
    setNotice(t('profile.requestModal.submitted'));
  }

  const pendingFields = new Set(
    requests.filter((r) => r.status === 'pending').map((r) => r.fieldKey),
  );

  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : user?.email ?? '';
  const initials = profile
    ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase()
    : '?';
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const filteredRequests =
    filter === 'all' ? requests : requests.filter((req) => req.status === filter);

  return (
    <MyPageLayout
      title={t('nav.profile')}
      subtitle={t('profile.subtitle')}
      loading={loading}
      error={error}
    >
      {profile ? (
        <div className="space-y-6">
          {notice && (
            <div className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-900/30 dark:text-success-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="flex-1">{notice}</span>
              <button
                type="button"
                className="opacity-70 hover:opacity-100"
                onClick={() => setNotice(null)}
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {actionError && (
            <div className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span className="flex-1">{actionError}</span>
              <button
                type="button"
                className="opacity-70 hover:opacity-100"
                onClick={() => setActionError(null)}
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <Card>
            <CardBody className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-100 text-lg font-semibold text-accent-700 dark:bg-accent-950/50 dark:text-accent-300">
                  {initials}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-primary">{displayName}</span>
                    {user?.roleName ? <Badge tone="neutral">{user.roleName}</Badge> : null}
                    <StatusPill
                      tone={profile.employmentStatus === 'active' ? 'success' : 'neutral'}
                    >
                      <span className="capitalize">
                        {profile.employmentStatus.replace(/_/g, ' ')}
                      </span>
                    </StatusPill>
                  </div>
                  <div className="text-xs text-muted">
                    {profile.employeeNumber}
                    {profile.designation?.name ? ` · ${profile.designation.name}` : ''}
                    {profile.department?.name ? ` · ${profile.department.name}` : ''}
                  </div>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="min-h-[40px] shrink-0"
                onClick={() => openRequestModal('first_name')}
              >
                <Clock className="h-4 w-4" />
                {t('profile.actions.requestUpdate')}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="grid gap-3 py-3.5 text-xs sm:grid-cols-3">
              <div className="flex items-start gap-2">
                <Badge tone="success" className="shrink-0">
                  <Pencil className="h-3 w-3" />
                  {t('profile.tiers.directEdit')}
                </Badge>
                <span className="text-muted">{t('profile.tiers.directEditHint')}</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge tone="warning" className="shrink-0">
                  <Clock className="h-3 w-3" />
                  {t('profile.tiers.hrApproval')}
                </Badge>
                <span className="text-muted">{t('profile.tiers.hrApprovalHint')}</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge tone="neutral" className="shrink-0">
                  <Lock className="h-3 w-3" />
                  {t('profile.tiers.readOnly')}
                </Badge>
                <span className="text-muted">{t('profile.tiers.readOnlyHint')}</span>
              </div>
            </CardBody>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-accent-600" />
                    {t('profile.sections.contact')}
                  </CardTitle>
                  <Badge tone="success">{t('profile.tiers.directEdit')}</Badge>
                </div>
                {editing !== 'contact' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit('contact', profile)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t('profile.actions.editSection')}
                  </Button>
                )}
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                {editing === 'contact' ? (
                  <>
                    <div>
                      <Label htmlFor="self-contact-email">{t('profile.fields.email')}</Label>
                      <Input
                        id="self-contact-email"
                        type="email"
                        value={contactForm.email}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, email: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="self-contact-phone">{t('profile.fields.phone')}</Label>
                      <Input
                        id="self-contact-phone"
                        value={contactForm.phone}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, phone: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="self-contact-mobile">{t('profile.fields.mobile')}</Label>
                      <Input
                        id="self-contact-mobile"
                        value={contactForm.mobile}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, mobile: e.target.value })
                        }
                      />
                    </div>
                    <SectionEditActions
                      saving={saving}
                      onCancel={() => setEditing(null)}
                      onSave={() => void saveSection('contact')}
                    />
                  </>
                ) : (
                  <>
                    <InfoField
                      icon={<Mail className="h-3.5 w-3.5 text-muted" />}
                      label={t('profile.fields.email')}
                      value={profile.personalInfo?.contact?.email}
                    />
                    <InfoField
                      label={t('profile.fields.phone')}
                      value={profile.personalInfo?.contact?.phone}
                    />
                    <InfoField
                      label={t('profile.fields.mobile')}
                      value={profile.personalInfo?.contact?.mobile}
                    />
                  </>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-accent-600" />
                    {t('profile.sections.emergency')}
                  </CardTitle>
                  <Badge tone="success">{t('profile.tiers.directEdit')}</Badge>
                </div>
                {editing !== 'emergency' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit('emergency', profile)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t('profile.actions.editSection')}
                  </Button>
                )}
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                {editing === 'emergency' ? (
                  <>
                    <div>
                      <Label htmlFor="self-emerg-name">{t('profile.fields.emergencyName')}</Label>
                      <Input
                        id="self-emerg-name"
                        value={emergencyForm.name}
                        onChange={(e) =>
                          setEmergencyForm({ ...emergencyForm, name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="self-emerg-phone">{t('profile.fields.emergencyPhone')}</Label>
                      <Input
                        id="self-emerg-phone"
                        value={emergencyForm.phone}
                        onChange={(e) =>
                          setEmergencyForm({ ...emergencyForm, phone: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="self-emerg-rel">{t('profile.fields.relationship')}</Label>
                      <Input
                        id="self-emerg-rel"
                        value={emergencyForm.relationship}
                        onChange={(e) =>
                          setEmergencyForm({ ...emergencyForm, relationship: e.target.value })
                        }
                      />
                    </div>
                    <SectionEditActions
                      saving={saving}
                      onCancel={() => setEditing(null)}
                      onSave={() => void saveSection('emergency')}
                    />
                  </>
                ) : (
                  <>
                    <InfoField
                      label={t('profile.fields.emergencyName')}
                      value={profile.personalInfo?.emergencyContact?.name}
                    />
                    <InfoField
                      label={t('profile.fields.emergencyPhone')}
                      value={profile.personalInfo?.emergencyContact?.phone}
                    />
                    <InfoField
                      label={t('profile.fields.relationship')}
                      value={profile.personalInfo?.emergencyContact?.relationship}
                    />
                  </>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-accent-600" />
                    {t('profile.sections.address')}
                  </CardTitle>
                  <Badge tone="success">{t('profile.tiers.directEdit')}</Badge>
                </div>
                {editing !== 'address' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit('address', profile)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t('profile.actions.editSection')}
                  </Button>
                )}
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                {editing === 'address' ? (
                  <>
                    <div>
                      <Label htmlFor="self-addr-line1">{t('profile.fields.line1')}</Label>
                      <Input
                        id="self-addr-line1"
                        value={addressForm.line1}
                        onChange={(e) =>
                          setAddressForm({ ...addressForm, line1: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="self-addr-line2">{t('profile.fields.line2')}</Label>
                      <Input
                        id="self-addr-line2"
                        value={addressForm.line2}
                        onChange={(e) =>
                          setAddressForm({ ...addressForm, line2: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="self-addr-city">{t('profile.fields.city')}</Label>
                        <Input
                          id="self-addr-city"
                          value={addressForm.city}
                          onChange={(e) =>
                            setAddressForm({ ...addressForm, city: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="self-addr-state">{t('profile.fields.state')}</Label>
                        <Input
                          id="self-addr-state"
                          value={addressForm.state}
                          onChange={(e) =>
                            setAddressForm({ ...addressForm, state: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="self-addr-postal">{t('profile.fields.postalCode')}</Label>
                        <Input
                          id="self-addr-postal"
                          value={addressForm.postalCode}
                          onChange={(e) =>
                            setAddressForm({ ...addressForm, postalCode: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="self-addr-country">{t('profile.fields.country')}</Label>
                        <Input
                          id="self-addr-country"
                          value={addressForm.country}
                          onChange={(e) =>
                            setAddressForm({ ...addressForm, country: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <SectionEditActions
                      saving={saving}
                      onCancel={() => setEditing(null)}
                      onSave={() => void saveSection('address')}
                    />
                  </>
                ) : (
                  <div className="space-y-1">
                    <div className="font-medium text-primary">
                      {profile.personalInfo?.address?.line1 || '—'}
                    </div>
                    {profile.personalInfo?.address?.line2 ? (
                      <div className="text-secondary">{profile.personalInfo.address.line2}</div>
                    ) : null}
                    <div className="text-secondary">
                      {[
                        profile.personalInfo?.address?.city,
                        profile.personalInfo?.address?.state,
                        profile.personalInfo?.address?.postalCode,
                      ]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </div>
                    {profile.personalInfo?.address?.country ? (
                      <div className="text-xs text-muted">
                        {profile.personalInfo.address.country}
                      </div>
                    ) : null}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{t('profile.sections.identity')}</CardTitle>
                  <Badge tone="warning">
                    <Clock className="h-3 w-3" />
                    {t('profile.tiers.hrApproval')}
                  </Badge>
                </div>
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                <ApprovalFieldRow
                  label={t('profile.fields.firstName')}
                  value={profile.firstName}
                  pending={pendingFields.has('first_name')}
                  pendingLabel={t('profile.requests.pendingExists')}
                  actionLabel={t('profile.actions.requestUpdate')}
                  onRequest={() => openRequestModal('first_name')}
                />
                <ApprovalFieldRow
                  label={t('profile.fields.lastName')}
                  value={profile.lastName}
                  pending={pendingFields.has('last_name')}
                  pendingLabel={t('profile.requests.pendingExists')}
                  actionLabel={t('profile.actions.requestUpdate')}
                  onRequest={() => openRequestModal('last_name')}
                />
                <div className="flex items-start justify-between gap-3 border-t border-base pt-3">
                  <div>
                    <div className="text-xs text-muted">{t('profile.fields.dependents')}</div>
                    {(profile.personalInfo?.dependents ?? []).length === 0 ? (
                      <div className="mt-0.5 text-secondary">
                        {t('profile.fields.noDependents')}
                      </div>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-primary">
                        {(profile.personalInfo.dependents ?? []).map((dep, idx) => (
                          <li key={idx}>
                            {dep.name}
                            {dep.relationship ? ` (${dep.relationship})` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <RequestShortcut
                    pending={pendingFields.has('dependents')}
                    pendingLabel={t('profile.requests.pendingExists')}
                    actionLabel={t('profile.actions.requestUpdate')}
                    onRequest={() => openRequestModal('dependents')}
                  />
                </div>
                <div className="flex items-start justify-between gap-3 border-t border-base pt-3">
                  <p className="text-xs text-muted">{t('profile.fields.bankTaxNote')}</p>
                  <RequestShortcut
                    pending={pendingFields.has('bank_or_tax')}
                    pendingLabel={t('profile.requests.pendingExists')}
                    actionLabel={t('profile.actions.requestUpdate')}
                    onRequest={() => openRequestModal('bank_or_tax')}
                  />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4 text-muted" />
                    {t('profile.sections.employment')}
                  </CardTitle>
                  <Badge tone="neutral">
                    <Lock className="h-3 w-3" />
                    {t('profile.tiers.readOnly')}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openRequestModal('work_location')}
                >
                  {t('profile.actions.requestUpdate')}
                </Button>
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <InfoField
                    label={t('profile.fields.employeeNumber')}
                    value={profile.employeeNumber}
                  />
                  <InfoField
                    label={t('profile.fields.employmentStatus')}
                    value={profile.employmentStatus.replace(/_/g, ' ')}
                    capitalize
                  />
                  <InfoField
                    label={t('profile.fields.designation')}
                    value={profile.designation?.name}
                  />
                  <InfoField
                    label={t('profile.fields.department')}
                    value={profile.department?.name}
                  />
                  <InfoField
                    label={t('profile.fields.employmentType')}
                    value={profile.employmentType?.name}
                  />
                  <InfoField
                    label={t('profile.fields.manager')}
                    value={profile.manager?.fullName}
                  />
                  <InfoField
                    label={t('profile.fields.workLocation')}
                    value={profile.workLocation?.name}
                  />
                  <InfoField
                    label={t('profile.fields.costCentre')}
                    value={
                      profile.costCentre
                        ? `${profile.costCentre.code} — ${profile.costCentre.name}`
                        : null
                    }
                  />
                  <InfoField label={t('profile.fields.hireDate')} value={profile.hireDate} />
                  <InfoField
                    label={t('profile.fields.probationEndDate')}
                    value={profile.probationEndDate}
                  />
                  <InfoField
                    label={t('profile.fields.confirmationDate')}
                    value={profile.confirmationDate}
                  />
                </div>
                <p className="border-t border-base pt-3 text-xs text-muted">
                  {t('profile.fields.compensationNote')}
                </p>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>{t('profile.sections.requests')}</CardTitle>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openRequestModal('first_name')}
              >
                {t('profile.actions.requestUpdate')}
              </Button>
            </CardHeader>
            <CardBody className="space-y-3">
              {requestsLoading ? (
                <div className="space-y-2">
                  {[0, 1].map((idx) => (
                    <Skeleton key={idx} className="h-14 w-full" />
                  ))}
                </div>
              ) : requests.length === 0 ? (
                <p className="text-sm text-muted">{t('profile.requests.empty')}</p>
              ) : (
                <>
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="tablist"
                    aria-label={t('profile.sections.requests')}
                  >
                    {REQUEST_FILTERS.map((status) => {
                      const count =
                        status === 'all'
                          ? requests.length
                          : requests.filter((r) => r.status === status).length;
                      if (status !== 'all' && count === 0) return null;
                      const active = filter === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setFilter(status)}
                          className={`min-h-[36px] rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            active
                              ? 'border-accent-500 bg-accent-50 text-accent-700 dark:border-accent-700 dark:bg-accent-950/50 dark:text-accent-300'
                              : 'border-base text-secondary hover:bg-[rgb(var(--bg-muted))]'
                          }`}
                        >
                          {t(`profile.requestStatus.${status}`)} ({count})
                        </button>
                      );
                    })}
                  </div>
                  {filteredRequests.length === 0 ? (
                    <p className="py-2 text-sm text-muted">
                      {t('profile.requests.emptyFiltered')}
                    </p>
                  ) : (
                    <ul className="divide-y divide-[rgb(var(--border-base))]">
                      {filteredRequests.map((req) => (
                        <ProfileUpdateRequestRow
                          key={req.id}
                          request={req}
                          dateLabel={dateFmt.format(new Date(req.createdAt))}
                          onCancelled={(updated) =>
                            setRequests((rows) =>
                              rows.map((r) => (r.id === updated.id ? updated : r)),
                            )
                          }
                        />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          <ProfileUpdateRequestModal
            open={requestModalOpen}
            employeeId={profile.id}
            profile={profile}
            initialFieldKey={requestFieldKey}
            onClose={() => setRequestModalOpen(false)}
            onSubmitted={handleRequestSubmitted}
          />
        </div>
      ) : null}
    </MyPageLayout>
  );
}

function SectionEditActions({
  saving,
  onCancel,
  onSave,
}: {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t } = useAppTranslation();
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button variant="secondary" size="sm" disabled={saving} onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button variant="primary" size="sm" disabled={saving} onClick={onSave}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {saving ? t('profile.actions.saving') : t('profile.actions.saveChanges')}
      </Button>
    </div>
  );
}

function InfoField({
  label,
  value,
  icon,
  capitalize = false,
}: {
  label: string;
  value: string | null | undefined;
  icon?: ReactNode;
  capitalize?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div
        className={`mt-0.5 flex items-center gap-1.5 font-medium text-primary ${
          capitalize ? 'capitalize' : ''
        }`}
      >
        {icon}
        <span>{value || '—'}</span>
      </div>
    </div>
  );
}

function RequestShortcut({
  pending,
  pendingLabel,
  actionLabel,
  onRequest,
}: {
  pending: boolean;
  pendingLabel: string;
  actionLabel: string;
  onRequest: () => void;
}) {
  if (pending) {
    return <Badge tone="warning">{pendingLabel}</Badge>;
  }
  return (
    <button
      type="button"
      onClick={onRequest}
      className="shrink-0 text-xs font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400"
    >
      {actionLabel}
    </button>
  );
}

function ApprovalFieldRow({
  label,
  value,
  pending,
  pendingLabel,
  actionLabel,
  onRequest,
}: {
  label: string;
  value: string;
  pending: boolean;
  pendingLabel: string;
  actionLabel: string;
  onRequest: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-xs text-muted">{label}</div>
        <div className="mt-0.5 font-medium text-primary">{value || '—'}</div>
      </div>
      <RequestShortcut
        pending={pending}
        pendingLabel={pendingLabel}
        actionLabel={actionLabel}
        onRequest={onRequest}
      />
    </div>
  );
}

function ProfileUpdateRequestRow({
  request,
  dateLabel,
  onCancelled,
}: {
  request: ProfileUpdateRequestRecord;
  dateLabel: string;
  onCancelled: (updated: ProfileUpdateRequestRecord) => void;
}) {
  const { t } = useAppTranslation();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCancel() {
    setCancelling(true);
    setErr(null);
    try {
      const updated = await cancelMyProfileUpdateRequest(request.id);
      setConfirming(false);
      onCancelled(updated);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t('common.unknownError'));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <li className="py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-primary">
              {t(`profile.requestTypes.${request.fieldKey}`)}
            </span>
            {request.appliedOnApproval && (
              <Badge tone="success">{t('profile.requests.appliedBadge')}</Badge>
            )}
          </div>
          <div className="text-secondary">
            {t('profile.requests.currentToRequested', {
              current: request.currentValue || t('profile.requestModal.emptyCurrent'),
              requested: request.requestedValue,
            })}
          </div>
          <div className="text-xs text-muted">
            {request.reason}
            {request.effectiveDate
              ? ` · ${t('profile.requests.effectiveFrom', { date: request.effectiveDate })}`
              : ''}
          </div>
          {request.reviewedByName && (
            <div className="text-xs text-secondary">
              {t('profile.requests.reviewedBy', { name: request.reviewedByName })}
              {request.reviewComment ? ` — “${request.reviewComment}”` : ''}
            </div>
          )}
          <div className="text-xs text-muted">
            {t('profile.requests.submittedOn', { date: dateLabel })}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusPill tone={REQUEST_STATUS_TONE[request.status]}>
            {t(`profile.requestStatus.${request.status}`)}
          </StatusPill>
          {request.status === 'pending' && !confirming && (
            <button
              type="button"
              className="text-xs font-medium text-secondary hover:text-error-600"
              onClick={() => setConfirming(true)}
            >
              {t('profile.actions.cancelRequest')}
            </button>
          )}
        </div>
      </div>

      {confirming && request.status === 'pending' && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs">
          <span className="mr-auto text-secondary">{t('profile.actions.confirmCancel')}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={cancelling}
            onClick={() => {
              setConfirming(false);
              setErr(null);
            }}
          >
            {t('profile.actions.keepRequest')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={cancelling}
            onClick={() => void handleCancel()}
          >
            {cancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('profile.actions.yesCancel')}
          </Button>
        </div>
      )}
      {err && <p className="mt-1 text-right text-xs text-error-600">{err}</p>}
    </li>
  );
}
