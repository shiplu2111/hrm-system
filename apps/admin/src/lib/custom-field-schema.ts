import type {
  CustomFieldDefinitionRecord,
  CustomFieldType,
  DocumentTypeFieldSchema,
} from '@hrm/shared-types';
import { customFieldsCopy } from './custom-fields-copy';

export const FIELD_TYPES: readonly CustomFieldType[] = [
  'text',
  'number',
  'date',
  'dropdown',
  'radio',
  'checkbox',
  'file',
  'image',
  'signature',
];

/** Editable state for one field definition before it is saved. */
export interface FieldDraft {
  uid: string;
  /** Present once saved; the server keeps it so stored values stay linked. */
  fieldKey?: string;
  /** Type as last saved, used to detect type changes on fields that hold data. */
  savedType?: CustomFieldType;
  label: string;
  fieldType: CustomFieldType;
  required: boolean;
  options: string[];
  isActive: boolean;
}

export interface FieldDraftErrors {
  label?: string;
  options?: string;
}

let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `draft-${uidCounter}`;
}

export function fieldTypeNeedsOptions(fieldType: CustomFieldType): boolean {
  return fieldType === 'dropdown' || fieldType === 'radio';
}

/** Mirrors `slugifyFieldKey` in the API so the key preview matches what is stored. */
export function slugifyFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

export function draftKey(draft: Pick<FieldDraft, 'fieldKey' | 'label'>): string {
  return draft.fieldKey ?? slugifyFieldKey(draft.label);
}

export function newFieldDraft(fieldType: CustomFieldType = 'text'): FieldDraft {
  return {
    uid: nextUid(),
    label: '',
    fieldType,
    required: false,
    options: [],
    isActive: true,
  };
}

export function draftFromField(
  field: DocumentTypeFieldSchema | CustomFieldDefinitionRecord,
): FieldDraft {
  return {
    uid: field.id ?? nextUid(),
    fieldKey: field.fieldKey,
    savedType: field.fieldType,
    label: field.label,
    fieldType: field.fieldType,
    required: field.required,
    options: [...field.options],
    isActive: field.isActive ?? true,
  };
}

export function normalizeOptions(options: string[]): string[] {
  return [...new Set(options.map((o) => o.trim()).filter(Boolean))];
}

export function validateFieldDraft(draft: FieldDraft): FieldDraftErrors {
  const errors: FieldDraftErrors = {};
  if (!draft.label.trim()) {
    errors.label = customFieldsCopy.validation.labelRequired;
  } else if (!draftKey(draft)) {
    errors.label = customFieldsCopy.validation.labelNeedsCharacters;
  }
  if (fieldTypeNeedsOptions(draft.fieldType) && normalizeOptions(draft.options).length === 0) {
    errors.options = customFieldsCopy.validation.optionsRequired;
  }
  return errors;
}

/**
 * Validates a whole field list, including key collisions between fields.
 * `takenKeys` holds keys already used by sibling records that are not part of the list.
 */
export function validateFieldDrafts(
  drafts: FieldDraft[],
  takenKeys: ReadonlySet<string> = new Set(),
): Record<string, FieldDraftErrors> {
  const result: Record<string, FieldDraftErrors> = {};
  const seen = new Map<string, number>();
  for (const draft of drafts) {
    const key = draftKey(draft);
    if (key) seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  for (const draft of drafts) {
    const errors = validateFieldDraft(draft);
    const key = draftKey(draft);
    if (!errors.label && key && ((seen.get(key) ?? 0) > 1 || takenKeys.has(key))) {
      errors.label = customFieldsCopy.validation.duplicateKey(key);
    }
    if (errors.label || errors.options) result[draft.uid] = errors;
  }
  return result;
}

export function hasFieldErrors(errors: Record<string, FieldDraftErrors>): boolean {
  return Object.keys(errors).length > 0;
}

/** API payload for the document type field list; never sends ids, which the endpoint rejects. */
export function draftsToFieldInput(drafts: FieldDraft[]): DocumentTypeFieldSchema[] {
  return drafts.map((draft, index) => ({
    ...(draft.fieldKey ? { fieldKey: draft.fieldKey } : {}),
    label: draft.label.trim(),
    fieldType: draft.fieldType,
    required: draft.required,
    options: fieldTypeNeedsOptions(draft.fieldType) ? normalizeOptions(draft.options) : [],
    sortOrder: index,
    isActive: draft.isActive,
  }));
}

export function fieldInputsEqual(a: FieldDraft[], b: FieldDraft[]): boolean {
  return JSON.stringify(draftsToFieldInput(a)) === JSON.stringify(draftsToFieldInput(b));
}

/** True when a saved field's type would change while records already hold values for it. */
export function isTypeLocked(draft: FieldDraft, hasStoredValues: boolean): boolean {
  return hasStoredValues && draft.savedType !== undefined;
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
