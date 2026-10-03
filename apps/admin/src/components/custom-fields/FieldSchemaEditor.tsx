import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Lock, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { customFieldsCopy } from '@/lib/custom-fields-copy';
import {
  draftKey,
  isTypeLocked,
  moveItem,
  newFieldDraft,
  type FieldDraft,
  type FieldDraftErrors,
} from '@/lib/custom-field-schema';
import { FieldDefinitionForm } from './FieldDefinitionForm';
import { fieldTypeIcons } from './fieldTypeIcons';

interface FieldSchemaEditorProps {
  fields: FieldDraft[];
  onChange: (fields: FieldDraft[]) => void;
  errors: Record<string, FieldDraftErrors>;
  /** Records already store values for saved fields, so their types are locked. */
  hasStoredValues: boolean;
  disabled?: boolean;
}

export function FieldSchemaEditor({
  fields,
  onChange,
  errors,
  hasStoredValues,
  disabled = false,
}: FieldSchemaEditorProps) {
  const copy = customFieldsCopy.editor;
  const [expanded, setExpanded] = useState<string | null>(null);

  const update = (uid: string, patch: Partial<FieldDraft>) =>
    onChange(fields.map((f) => (f.uid === uid ? { ...f, ...patch } : f)));

  const addField = () => {
    const draft = newFieldDraft();
    onChange([...fields, draft]);
    setExpanded(draft.uid);
  };

  return (
    <div className="space-y-2">
      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-base px-4 py-6 text-center text-sm text-muted">
          {copy.noFields}
        </p>
      )}

      <ol className="space-y-2">
        {fields.map((field, index) => {
          const Icon = fieldTypeIcons[field.fieldType];
          const fieldErrors = errors[field.uid];
          const isOpen = expanded === field.uid || Boolean(fieldErrors);
          const locked = isTypeLocked(field, hasStoredValues);
          const key = draftKey(field);

          return (
            <li
              key={field.uid}
              className={`rounded-xl border ${fieldErrors ? 'border-error-400 dark:border-error-700' : 'border-base'} surface`}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : field.uid)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? copy.collapse : copy.expand}
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                  )}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/50 dark:text-accent-300">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-medium ${field.label.trim() ? 'text-primary' : 'text-muted italic'}`}>
                      {field.label.trim() || copy.untitled}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-muted">
                      {key || '—'} · {customFieldsCopy.fieldTypes[field.fieldType].label}
                    </span>
                  </span>
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  {locked && <Lock className="h-3.5 w-3.5 text-muted" aria-label={copy.typeLocked} />}
                  {field.required && <Badge tone="error">{copy.required}</Badge>}
                  {!field.isActive && <Badge tone="neutral">{copy.inactive}</Badge>}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled || index === 0}
                    onClick={() => onChange(moveItem(fields, index, index - 1))}
                    aria-label={copy.moveUp}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled || index === fields.length - 1}
                    onClick={() => onChange(moveItem(fields, index, index + 1))}
                    aria-label={copy.moveDown}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    onClick={() => onChange(fields.filter((f) => f.uid !== field.uid))}
                    aria-label={copy.remove}
                    title={locked ? copy.removeWarning : copy.remove}
                    className="hover:text-error-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-base px-4 py-4">
                  <FieldDefinitionForm
                    idPrefix={field.uid}
                    draft={field}
                    errors={fieldErrors}
                    typeLocked={locked}
                    disabled={disabled}
                    onChange={(patch) => update(field.uid, patch)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <Button type="button" variant="outline" size="sm" onClick={addField} disabled={disabled}>
        <Plus className="h-4 w-4" /> {copy.addField}
      </Button>
    </div>
  );
}
