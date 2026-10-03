import { Lock } from 'lucide-react';
import type { CustomFieldType } from '@hrm/shared-types';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import { customFieldsCopy } from '@/lib/custom-fields-copy';
import {
  FIELD_TYPES,
  fieldTypeNeedsOptions,
  slugifyFieldKey,
  type FieldDraft,
  type FieldDraftErrors,
} from '@/lib/custom-field-schema';
import { fieldTypeIcons } from './fieldTypeIcons';
import { OptionsEditor } from './OptionsEditor';

interface FieldDefinitionFormProps {
  idPrefix: string;
  draft: FieldDraft;
  errors?: FieldDraftErrors;
  typeLocked?: boolean;
  disabled?: boolean;
  showActive?: boolean;
  onChange: (patch: Partial<FieldDraft>) => void;
}

export function FieldDefinitionForm({
  idPrefix,
  draft,
  errors,
  typeLocked = false,
  disabled = false,
  showActive = true,
  onChange,
}: FieldDefinitionFormProps) {
  const copy = customFieldsCopy.editor;
  const labelId = `${idPrefix}-label`;
  const optionsId = `${idPrefix}-options`;

  const selectType = (fieldType: CustomFieldType) => {
    if (typeLocked || disabled) return;
    onChange({ fieldType });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={labelId}>{copy.fieldLabel}</Label>
        <Input
          id={labelId}
          value={draft.label}
          disabled={disabled}
          maxLength={120}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={copy.fieldLabelPlaceholder}
          aria-invalid={errors?.label ? true : undefined}
          className={errors?.label ? 'border-error-500 focus:ring-error-500/30' : ''}
        />
        <FieldError message={errors?.label} />
        <p className="mt-1 text-[11px] text-muted">
          {draft.fieldKey ? (
            <>
              {copy.fieldKey}: <span className="font-mono text-secondary">{draft.fieldKey}</span> — {copy.fieldKeyHint}
            </>
          ) : (
            copy.newKeyPreview(slugifyFieldKey(draft.label))
          )}
        </p>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-secondary">
          {copy.fieldType}
          {typeLocked && <Lock className="h-3 w-3" />}
        </div>
        <div role="radiogroup" aria-label={copy.fieldType} className="grid grid-cols-3 gap-1.5">
          {FIELD_TYPES.map((type) => {
            const Icon = fieldTypeIcons[type];
            const selected = draft.fieldType === type;
            const unavailable = (typeLocked && !selected) || disabled;
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={unavailable}
                title={customFieldsCopy.fieldTypes[type].hint}
                onClick={() => selectType(type)}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300'
                    : 'border-base text-secondary hover:bg-[rgb(var(--bg-hover))]'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {customFieldsCopy.fieldTypes[type].label}
              </button>
            );
          })}
        </div>
        {typeLocked && <p className="mt-1.5 text-[11px] text-warning-700 dark:text-warning-300">{copy.typeLocked}</p>}
      </div>

      {fieldTypeNeedsOptions(draft.fieldType) && (
        <div>
          <Label htmlFor={optionsId}>{copy.options}</Label>
          <OptionsEditor
            id={optionsId}
            options={draft.options}
            disabled={disabled}
            invalid={Boolean(errors?.options)}
            onChange={(options) => onChange({ options })}
          />
          <FieldError message={errors?.options} />
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2.5">
          <span className="text-sm text-primary">{copy.required}</span>
          <Toggle
            size="sm"
            checked={draft.required}
            disabled={disabled}
            label={copy.required}
            onChange={(required) => onChange({ required })}
          />
        </div>
        {showActive && (
          <div className="flex items-center justify-between rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2.5" title={copy.activeHint}>
            <span className="text-sm text-primary">{copy.active}</span>
            <Toggle
              size="sm"
              checked={draft.isActive}
              disabled={disabled}
              label={copy.active}
              onChange={(isActive) => onChange({ isActive })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
