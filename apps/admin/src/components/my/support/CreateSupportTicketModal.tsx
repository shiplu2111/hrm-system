import { useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, Send } from 'lucide-react';
import type { SupportTicketDetail, SupportTicketPriority } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { createSupportTicket } from '@/lib/support-api';
import { ApiError } from '@/lib/tenant-api-client';

const PRIORITIES: SupportTicketPriority[] = ['low', 'medium', 'high', 'urgent'];

interface CreateSupportTicketModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (ticket: SupportTicketDetail) => void;
}

export function CreateSupportTicketModal({
  open,
  onClose,
  onSuccess,
}: CreateSupportTicketModalProps) {
  const { t } = useAppTranslation();
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<SupportTicketPriority>('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanSubject = subject.trim();
    const cleanDesc = description.trim();

    if (!cleanSubject) {
      setError(t('support.subject') + ' is required');
      return;
    }
    if (cleanSubject.length < 3) {
      setError('Subject must be at least 3 characters long');
      return;
    }
    if (!cleanDesc) {
      setError(t('support.description') + ' is required');
      return;
    }
    if (cleanDesc.length < 10) {
      setError('Description must be at least 10 characters long');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await createSupportTicket({
        subject: cleanSubject,
        priority,
        description: cleanDesc,
      });
      setSubject('');
      setDescription('');
      setPriority('medium');
      onSuccess(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.submitTicket'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setError(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('support.newSupportTicket')}
      size="lg"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <Label htmlFor="support-ticket-subject">
            {t('support.subject')} <span className="text-error-500">*</span>
          </Label>
          <Input
            id="support-ticket-subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              if (error) setError(null);
            }}
            placeholder={t('support.ticketSubjectPlaceholder')}
            disabled={submitting}
            required
            maxLength={200}
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="support-ticket-priority">
            {t('support.priority')}
          </Label>
          <Select
            id="support-ticket-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}
            disabled={submitting}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`support.ticketPriority.${p}`)}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="support-ticket-desc">
            {t('support.description')} <span className="text-error-500">*</span>
          </Label>
          <Textarea
            id="support-ticket-desc"
            rows={5}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (error) setError(null);
            }}
            placeholder={t('support.ticketDescriptionPlaceholder')}
            disabled={submitting}
            required
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={submitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !subject.trim() || !description.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.submitting')}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {t('support.submitTicket')}
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
