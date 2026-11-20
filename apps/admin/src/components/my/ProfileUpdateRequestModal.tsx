import { useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import type {
  EmployeeRecord,
  ProfileUpdateFieldKey,
  ProfileUpdateRequestRecord,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { createMyProfileUpdateRequest } from '@/lib/my-api';
import { ApiError } from '@/lib/tenant-api-client';

const FIELD_KEYS: ProfileUpdateFieldKey[] = [
  'first_name',
  'last_name',
  'work_location',
  'department',
  'designation',
  'manager',
  'dependents',
  'bank_or_tax',
  'other',
];

function currentFieldDisplay(
  profile: EmployeeRecord,
  fieldKey: ProfileUpdateFieldKey,
  emptyLabel: string,
): string {
  switch (fieldKey) {
    case 'first_name':
      return profile.firstName || emptyLabel;
    case 'last_name':
      return profile.lastName || emptyLabel;
    case 'work_location':
      return profile.workLocation?.name || emptyLabel;
    case 'department':
      return profile.department?.name || emptyLabel;
    case 'designation':
      return profile.designation?.name || emptyLabel;
    case 'manager':
      return profile.manager?.fullName || emptyLabel;
    case 'dependents': {
      const deps = profile.personalInfo?.dependents ?? [];
      if (!deps.length) return emptyLabel;
      return deps.map((d) => d.name).filter(Boolean).join(', ') || emptyLabel;
    }
    case 'bank_or_tax':
    case 'other':
      return emptyLabel;
  }
}

interface ProfileUpdateRequestModalProps {
  open: boolean;
  employeeId: string;
  profile: EmployeeRecord;
  initialFieldKey?: ProfileUpdateFieldKey;
  onClose: () => void;
  onSubmitted: (created: ProfileUpdateRequestRecord) => void;
}

export function ProfileUpdateRequestModal(props: ProfileUpdateRequestModalProps) {
  if (!props.open) return null;
  return <RequestModalBody {...props} />;
}

function RequestModalBody({
  employeeId,
  profile,
  initialFieldKey = 'first_name',
  onClose,
  onSubmitted,
}: ProfileUpdateRequestModalProps) {
  const { t } = useAppTranslation();
  const [fieldKey, setFieldKey] = useState<ProfileUpdateFieldKey>(initialFieldKey);
  const [requestedValue, setRequestedValue] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentDisplay = currentFieldDisplay(
    profile,
    fieldKey,
    t('profile.requestModal.emptyCurrent'),
  );
  const autoApply = fieldKey === 'first_name' || fieldKey === 'last_name';
  const canSubmit =
    !submitting && requestedValue.trim().length > 0 && reason.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createMyProfileUpdateRequest(employeeId, {
        fieldKey,
        requestedValue: requestedValue.trim(),
        reason: reason.trim(),
        effectiveDate: effectiveDate || undefined,
      });
      onSubmitted(created);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.unknownError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={t('profile.requestModal.title')}
      description={t('profile.requestModal.description')}
      footer={
        <>
          <Button variant="secondary" className="min-h-[44px]" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            className="min-h-[44px]"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('profile.requestModal.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="profile-req-field">{t('profile.requestModal.fieldLabel')}</Label>
          <Select
            id="profile-req-field"
            value={fieldKey}
            onChange={(e) => setFieldKey(e.target.value as ProfileUpdateFieldKey)}
          >
            {FIELD_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(`profile.requestTypes.${key}`)}
              </option>
            ))}
          </Select>
        </div>

        <div className="rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs">
          <div className="text-muted">{t('profile.requestModal.currentValue')}</div>
          <div className="mt-0.5 font-medium text-primary">{currentDisplay}</div>
        </div>

        {autoApply && (
          <div className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-800 dark:border-accent-800 dark:bg-accent-950/40 dark:text-accent-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('profile.requestModal.autoApplyHint')}</span>
          </div>
        )}

        <div>
          <Label htmlFor="profile-req-value">{t('profile.requestModal.requestedValue')}</Label>
          <Input
            id="profile-req-value"
            maxLength={500}
            value={requestedValue}
            placeholder={t('profile.requestModal.requestedValuePlaceholder')}
            onChange={(e) => setRequestedValue(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="profile-req-date">{t('profile.requestModal.effectiveDate')}</Label>
          <Input
            id="profile-req-date"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="profile-req-reason">{t('profile.requestModal.reason')}</Label>
          <Textarea
            id="profile-req-reason"
            rows={3}
            maxLength={500}
            value={reason}
            placeholder={t('profile.requestModal.reasonPlaceholder')}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
