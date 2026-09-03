import { BadRequestException } from '@nestjs/common';
import type { CustomFieldDefinition, CustomFieldType } from '@prisma/client';

export function slugifyFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

export function validateCustomFieldValues(
  definitions: CustomFieldDefinition[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  const activeDefs = definitions.filter((d) => d.isActive);

  for (const def of activeDefs) {
    const raw = values[def.fieldKey];
    const hasValue =
      raw !== undefined &&
      raw !== null &&
      !(typeof raw === 'string' && raw.trim() === '');

    if (def.required && !hasValue) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Field "${def.label}" is required`,
        details: [{ field: def.fieldKey, message: 'Required field is missing' }],
      });
    }

    if (!hasValue) {
      continue;
    }

    normalized[def.fieldKey] = coerceFieldValue(def.fieldType, raw, def);
  }

  return normalized;
}

function coerceFieldValue(
  fieldType: CustomFieldType,
  raw: unknown,
  def: CustomFieldDefinition,
): unknown {
  const options = parseOptions(def.options);

  switch (fieldType) {
    case 'text':
    case 'signature':
      return String(raw).trim();

    case 'number': {
      const num = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(num)) {
        throw fieldError(def.fieldKey, def.label, 'Must be a number');
      }
      return num;
    }

    case 'date': {
      const str = String(raw);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        throw fieldError(def.fieldKey, def.label, 'Must be YYYY-MM-DD');
      }
      return str;
    }

    case 'dropdown':
    case 'radio': {
      const str = String(raw).trim();
      if (options.length > 0 && !options.includes(str)) {
        throw fieldError(def.fieldKey, def.label, 'Invalid option selected');
      }
      return str;
    }

    case 'checkbox':
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
      throw fieldError(def.fieldKey, def.label, 'Must be a boolean');

    case 'file':
    case 'image':
      return String(raw).trim();

    default:
      return raw;
  }
}

function parseOptions(optionsJson: unknown): string[] {
  if (!Array.isArray(optionsJson)) return [];
  return optionsJson.map((o) => String(o));
}

function fieldError(field: string, label: string, message: string): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: `Field "${label}": ${message}`,
    details: [{ field, message }],
  });
}

export function parseOptionsInput(options?: string[] | string): string[] {
  if (!options) return [];
  if (Array.isArray(options)) {
    return options.map((o) => o.trim()).filter(Boolean);
  }
  return options
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
