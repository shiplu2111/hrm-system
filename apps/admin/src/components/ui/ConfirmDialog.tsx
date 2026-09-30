import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/tenant-api-client';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  /** Throwing keeps the dialog open and shows the error message. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={() => void handleConfirm()} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          {tone === 'danger' ? (
            <div className="h-9 w-9 rounded-full bg-error-50 dark:bg-error-950/40 text-error-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
          ) : null}
          <div className="text-sm text-secondary pt-1.5">{description}</div>
        </div>
        {error ? (
          <div className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
