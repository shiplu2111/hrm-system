import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { EmployeeCertificationRecord } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Label, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Banner, errorMessage } from '@/components/performance/performance-ui';
import { updateCertification } from '@/lib/training-api';

export function RevokeCertificationModal({
  certification,
  onClose,
  onRevoked,
}: {
  /** Closed when null. */
  certification: EmployeeCertificationRecord | null;
  onClose: () => void;
  onRevoked: (record: EmployeeCertificationRecord) => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!certification) return;
    setReason('');
    setError(null);
  }, [certification]);

  if (!certification) return null;

  const canSave = reason.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      onRevoked(await updateCertification(certification.id, { status: 'revoked', revocationReason: reason.trim() }));
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t revoke the certification'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title="Revoke certification?"
      description={`${certification.name} · ${certification.employeeName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void save()} disabled={!canSave}>
            {saving ? 'Revoking…' : 'Revoke'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <Banner icon={AlertCircle} tone="error">
            {error}
          </Banner>
        ) : null}
        <p className="text-sm text-secondary">
          A revoked certificate no longer counts as held and stops expiry alerts. It stays on record with the reason,
          and you can reinstate it later.
        </p>
        <div>
          <Label htmlFor="revoke-reason">Reason</Label>
          <Textarea
            id="revoke-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Issuing body withdrew the certificate"
            autoFocus
          />
        </div>
      </div>
    </Modal>
  );
}
