import { useEffect, useState } from 'react';
import type { TenantRoleRecord } from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Form';
import { FieldError } from '@/components/ui/FieldError';
import { rolesCopy as copy } from '@/lib/roles-copy';
import { validateRoleName } from '@/lib/role-matrix';

interface Props {
  open: boolean;
  roles: TenantRoleRecord[];
  /** Pre-selected template, e.g. when duplicating a default role. */
  initialTemplateId?: string | null;
  onClose: () => void;
  onContinue: (input: { name: string; template: TenantRoleRecord | null }) => void;
}

export function CreateRoleModal({ open, roles, initialTemplateId, onClose, onContinue }: Props) {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setTemplateId(initialTemplateId ?? '');
    setTouched(false);
  }, [open, initialTemplateId]);

  const error = validateRoleName(name, roles);
  const submit = () => {
    setTouched(true);
    if (error) return;
    onContinue({ name: name.trim(), template: roles.find((role) => role.id === templateId) ?? null });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={copy.create.title}
      description={copy.create.description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {copy.create.cancel}
          </Button>
          <Button variant="primary" onClick={submit}>
            {copy.create.continue}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div>
          <Label htmlFor="new-role-name">{copy.editor.nameLabel}</Label>
          <Input
            id="new-role-name"
            value={name}
            autoFocus
            maxLength={100}
            placeholder={copy.create.placeholder}
            aria-invalid={touched && !!error}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          {touched && error ? <FieldError message={copy.editor[error]} /> : null}
        </div>
        <div>
          <Label htmlFor="new-role-template">{copy.create.startFrom}</Label>
          <Select id="new-role-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">{copy.create.blank}</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {copy.create.copyOf(role.name)}
              </option>
            ))}
          </Select>
        </div>
      </form>
    </Modal>
  );
}
