import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { EmployeeCertificationRecord, EmployeeRecord, TrainingCourseRecord } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Banner, errorMessage } from '@/components/performance/performance-ui';
import {
  CERTIFICATE_FILE_ACCEPT,
  CERTIFICATE_FILE_MAX_BYTES,
  createCertification,
  updateCertification,
  uploadCertificationFile,
} from '@/lib/training-api';
import { addYears, formatFileSize, todayDateOnly } from './training-ui';

export type CertificationFormMode =
  | { kind: 'create'; employeeId?: string }
  | { kind: 'edit'; record: EmployeeCertificationRecord }
  | { kind: 'renew'; record: EmployeeCertificationRecord };

function validityYears(record: EmployeeCertificationRecord): number | null {
  if (!record.issuedAt || !record.expiryDate) return null;
  const years = Math.round(
    (new Date(record.expiryDate).getTime() - new Date(record.issuedAt).getTime()) / (365.25 * 86_400_000),
  );
  return years >= 1 ? years : null;
}

const TITLES = { create: 'Add certification', edit: 'Edit certification', renew: 'Renew certification' };

export function CertificationFormModal({
  mode,
  companyId,
  employees,
  courses,
  knownNames,
  canAttachFile,
  onClose,
  onSaved,
}: {
  /** Closed when null. */
  mode: CertificationFormMode | null;
  companyId: string;
  /** Employees who can be given a certificate (not terminated). */
  employees: EmployeeRecord[];
  courses: TrainingCourseRecord[];
  knownNames: string[];
  /** Uploading needs `training:edit`; offered when adding or renewing. */
  canAttachFile: boolean;
  onClose: () => void;
  onSaved: (record: EmployeeCertificationRecord, message: string) => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [issuer, setIssuer] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayDateOnly();

  useEffect(() => {
    if (!mode) return;
    setError(null);
    setFile(null);
    if (mode.kind === 'create') {
      setEmployeeId(mode.employeeId ?? '');
      setName('');
      setCourseId('');
      setIssuer('');
      setCertificateNumber('');
      setIssuedAt(today);
      setExpiryDate('');
      setNotes('');
      return;
    }
    const { record } = mode;
    setEmployeeId(record.employeeId);
    setName(record.name);
    setCourseId(record.courseId ?? '');
    setIssuer(record.issuer ?? '');
    if (mode.kind === 'edit') {
      setCertificateNumber(record.certificateNumber ?? '');
      setIssuedAt(record.issuedAt ?? '');
      setExpiryDate(record.expiryDate ?? '');
      setNotes(record.notes ?? '');
    } else {
      const years = validityYears(record);
      setCertificateNumber('');
      setIssuedAt(today);
      setExpiryDate(years ? addYears(today, years) : '');
      setNotes('');
    }
  }, [mode, today]);

  const employeeName = useMemo(() => {
    if (mode && mode.kind !== 'create') return mode.record.employeeName;
    return employees.find((row) => row.id === employeeId)?.fullName ?? null;
  }, [mode, employees, employeeId]);

  const dateError =
    issuedAt && issuedAt > today
      ? 'The issue date can’t be in the future.'
      : issuedAt && expiryDate && expiryDate <= issuedAt
        ? 'The expiry date must be after the issue date.'
        : null;
  const fileError = file && file.size > CERTIFICATE_FILE_MAX_BYTES ? 'The file must be 10 MB or smaller.' : null;
  const canSave = !!employeeId && name.trim().length > 0 && !dateError && !fileError && !saving;

  if (!mode) return null;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (mode.kind === 'edit') {
        const saved = await updateCertification(mode.record.id, {
          name: name.trim(),
          courseId: courseId || null,
          issuer: issuer.trim() || null,
          certificateNumber: certificateNumber.trim() || null,
          issuedAt: issuedAt || null,
          expiryDate: expiryDate || null,
          notes: notes.trim() || null,
        });
        onSaved(saved, `${saved.name} updated.`);
      } else {
        let saved = await createCertification(companyId, {
          employeeId,
          name: name.trim(),
          courseId: courseId || undefined,
          issuer: issuer.trim() || undefined,
          certificateNumber: certificateNumber.trim() || undefined,
          issuedAt: issuedAt || undefined,
          expiryDate: expiryDate || undefined,
          notes: notes.trim() || undefined,
        });
        let fileNote = '';
        if (file) {
          try {
            saved = await uploadCertificationFile(saved.id, file);
          } catch (err) {
            fileNote = ` The file wasn’t attached (${errorMessage(err, 'upload failed')}); attach it from the employee’s certificates.`;
          }
        }
        onSaved(
          saved,
          (mode.kind === 'renew'
            ? `${saved.name} renewed for ${saved.employeeName}. The previous certificate is kept as history.`
            : `${saved.name} added for ${saved.employeeName}.`) + fileNote,
        );
      }
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t save the certification'));
    } finally {
      setSaving(false);
    }
  };

  const presetBase = issuedAt || today;

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title={TITLES[mode.kind]}
      description={
        mode.kind === 'renew'
          ? `Record the new certificate for ${employeeName}. The current one stays in their history as renewed.`
          : employeeName ?? 'Record a certificate an employee holds.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!canSave}>
            {saving ? 'Saving…' : mode.kind === 'renew' ? 'Save renewal' : mode.kind === 'edit' ? 'Save changes' : 'Add certification'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {error ? (
          <Banner icon={AlertCircle} tone="error">
            {error}
          </Banner>
        ) : null}
        {mode.kind === 'create' && !mode.employeeId ? (
          <div>
            <Label htmlFor="cert-employee">Employee</Label>
            <Select id="cert-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Select an employee</option>
              {employees.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.fullName} · {row.employeeNumber}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div>
          <Label htmlFor="cert-name">Certificate</Label>
          <Input
            id="cert-name"
            list="cert-name-options"
            value={name}
            maxLength={150}
            disabled={mode.kind === 'renew'}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. First Aid at Work"
            autoFocus={mode.kind !== 'renew'}
          />
          <datalist id="cert-name-options">
            {knownNames.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cert-issuer">Issuing body</Label>
            <Input id="cert-issuer" value={issuer} maxLength={150} onChange={(e) => setIssuer(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cert-number">Certificate number</Label>
            <Input
              id="cert-number"
              value={certificateNumber}
              maxLength={100}
              onChange={(e) => setCertificateNumber(e.target.value)}
              autoFocus={mode.kind === 'renew'}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cert-issued">Issued</Label>
            <Input id="cert-issued" type="date" max={today} value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cert-expiry">Expires</Label>
            <Input
              id="cert-expiry"
              type="date"
              min={issuedAt || undefined}
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[1, 2, 3, 5].map((years) => (
                <button
                  key={years}
                  type="button"
                  onClick={() => setExpiryDate(addYears(presetBase, years))}
                  className="rounded-sm border border-base px-1.5 py-0.5 text-[11px] text-secondary hover:border-accent-400 hover:text-accent-700"
                >
                  +{years} yr
                </button>
              ))}
              <button
                type="button"
                onClick={() => setExpiryDate('')}
                className="rounded-sm border border-base px-1.5 py-0.5 text-[11px] text-secondary hover:border-accent-400 hover:text-accent-700"
              >
                No expiry
              </button>
            </div>
          </div>
        </div>
        {dateError ? <p className="text-xs text-error-600">{dateError}</p> : null}
        <div>
          <Label htmlFor="cert-course">Earned through course</Label>
          <Select id="cert-course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Not linked to a course</option>
            {courses.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title}
                {row.status === 'archived' ? ' (archived)' : ''}
              </option>
            ))}
          </Select>
        </div>
        {canAttachFile && mode.kind !== 'edit' ? (
          <div>
            <Label htmlFor="cert-file">Certificate file</Label>
            <input
              id="cert-file"
              type="file"
              accept={CERTIFICATE_FILE_ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-secondary file:mr-3 file:rounded-md file:border file:border-base file:bg-transparent file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary hover:file:bg-[rgb(var(--bg-hover))]"
            />
            <p className="mt-1 text-xs text-muted">
              {file ? `${file.name} · ${formatFileSize(file.size)}` : 'Optional. PDF, JPG or PNG, up to 10 MB.'}
            </p>
            {fileError ? <p className="mt-1 text-xs text-error-600">{fileError}</p> : null}
          </div>
        ) : null}
        <div>
          <Label htmlFor="cert-notes">Notes</Label>
          <Textarea id="cert-notes" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <p className="text-xs text-muted">
          Certificates turn amber 30 days before they expire, when the “Certification expiring” notification is sent,
          and red the day after the expiry date.
        </p>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
