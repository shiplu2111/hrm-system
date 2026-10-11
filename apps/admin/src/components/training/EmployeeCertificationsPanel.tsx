import { Award, Pencil, Plus, RefreshCw, RotateCcw, ShieldOff, Trash2 } from 'lucide-react';
import type { EmployeeCertificationRecord } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { SidePanel } from '@/components/ui/SidePanel';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatDateOnly } from '@/lib/currency-display';
import { CertificateFileRow } from './CertificateFileRow';
import { certificationExpiryText, certificationTone, compareCertificationUrgency } from './training-ui';

export interface CertificationHolder {
  id: string;
  name: string;
  detail: string;
  /** Terminated employees can't be given new certificates. */
  canReceive: boolean;
}

export interface CertificationActions {
  onAdd: () => void;
  onEdit: (row: EmployeeCertificationRecord) => void;
  onRenew: (row: EmployeeCertificationRecord) => void;
  onRevoke: (row: EmployeeCertificationRecord) => void;
  onReinstate: (row: EmployeeCertificationRecord) => void;
  onDelete: (row: EmployeeCertificationRecord) => void;
  onFileChanged: (row: EmployeeCertificationRecord, message: string) => void;
}

function CertificationCard({
  row,
  renewedBy,
  canCreate,
  canEdit,
  canReceive,
  actions,
}: {
  row: EmployeeCertificationRecord;
  renewedBy?: EmployeeCertificationRecord;
  canCreate: boolean;
  canEdit: boolean;
  canReceive: boolean;
  actions: CertificationActions;
}) {
  const current = !row.supersededById && row.expiryState !== 'revoked';
  const facts = [
    row.issuer,
    row.certificateNumber ? `No. ${row.certificateNumber}` : null,
    row.courseTitle ? `via ${row.courseTitle}` : null,
  ].filter(Boolean);

  return (
    <li className="rounded-lg border border-base p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-primary">{row.name}</p>
          {facts.length > 0 ? <p className="mt-0.5 text-xs text-secondary">{facts.join(' · ')}</p> : null}
        </div>
        <StatusPill tone={certificationTone(row)}>{certificationExpiryText(row)}</StatusPill>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted">Issued</dt>
          <dd className="text-primary">{row.issuedAt ? formatDateOnly(row.issuedAt) : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted">Expires</dt>
          <dd className="text-primary">{row.expiryDate ? formatDateOnly(row.expiryDate) : 'No expiry'}</dd>
        </div>
      </dl>
      <CertificateFileRow row={row} canEdit={canEdit} onChanged={actions.onFileChanged} />
      {renewedBy ? (
        <p className="mt-2 text-xs text-muted">
          Replaced by the certificate issued {renewedBy.issuedAt ? formatDateOnly(renewedBy.issuedAt) : 'later'}.
        </p>
      ) : null}
      {row.notes ? <p className="mt-2 whitespace-pre-line text-xs text-secondary">{row.notes}</p> : null}
      {canEdit || (canCreate && current && canReceive) ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-base pt-2">
          {canCreate && current && canReceive ? (
            <Button size="sm" variant={row.expiryState === 'valid' || row.expiryState === 'no_expiry' ? 'ghost' : 'secondary'} onClick={() => actions.onRenew(row)}>
              <RefreshCw className="h-3.5 w-3.5" /> Renew
            </Button>
          ) : null}
          {canEdit ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => actions.onEdit(row)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              {row.expiryState === 'revoked' ? (
                <Button size="sm" variant="ghost" onClick={() => actions.onReinstate(row)}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reinstate
                </Button>
              ) : !row.supersededById ? (
                <Button size="sm" variant="ghost" onClick={() => actions.onRevoke(row)}>
                  <ShieldOff className="h-3.5 w-3.5" /> Revoke
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => actions.onDelete(row)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function EmployeeCertificationsPanel({
  holder,
  certifications,
  canCreate,
  canEdit,
  actions,
  onClose,
}: {
  holder: CertificationHolder | null;
  /** All of this employee's certificates, including renewed and revoked ones. */
  certifications: EmployeeCertificationRecord[];
  canCreate: boolean;
  canEdit: boolean;
  actions: CertificationActions;
  onClose: () => void;
}) {
  const current = certifications.filter((row) => !row.supersededById && row.expiryState !== 'revoked').sort(compareCertificationUrgency);
  const history = certifications
    .filter((row) => row.supersededById || row.expiryState === 'revoked')
    .sort((a, b) => (b.expiryDate ?? '').localeCompare(a.expiryDate ?? ''));
  const byId = new Map(certifications.map((row) => [row.id, row]));
  const cardProps = { canCreate, canEdit, canReceive: holder?.canReceive ?? false, actions };

  return (
    <SidePanel
      open={holder != null}
      onClose={onClose}
      title={holder?.name}
      description={holder?.detail}
      size="lg"
      footer={
        holder && canCreate && holder.canReceive ? (
          <Button size="sm" onClick={actions.onAdd}>
            <Plus className="h-3.5 w-3.5" /> Add certification
          </Button>
        ) : undefined
      }
    >
      {holder ? (
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-primary">Current certificates</h3>
            {current.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-base px-4 py-8 text-center">
                <Award className="h-6 w-6 text-muted" />
                <p className="text-sm text-secondary">No current certificates on file.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {current.map((row) => (
                  <CertificationCard key={row.id} row={row} {...cardProps} />
                ))}
              </ul>
            )}
          </section>
          {history.length > 0 ? (
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-primary">
                History <span className="font-normal text-muted">· {history.length} renewed or revoked</span>
              </summary>
              <ul className="mt-2 space-y-2">
                {history.map((row) => (
                  <CertificationCard
                    key={row.id}
                    row={row}
                    renewedBy={row.supersededById ? byId.get(row.supersededById) : undefined}
                    {...cardProps}
                  />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </SidePanel>
  );
}
