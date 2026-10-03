import { BadRequestException } from '@nestjs/common';
import type { CustomFieldDefinition } from '@prisma/client';
import {
  assertFieldOptions,
  findFieldTypeChanges,
  parseOptionsInput,
  slugifyFieldKey,
  validateCustomFieldValues,
} from './field-validation.utils';

function definition(
  overrides: Partial<CustomFieldDefinition>,
): CustomFieldDefinition {
  return {
    id: 'f1',
    companyId: 'c1',
    entityType: 'document',
    contextId: 't1',
    fieldKey: 'field',
    label: 'Field',
    fieldType: 'text',
    required: false,
    options: [],
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('field definition rules', () => {
  it('slugifies labels into stable keys', () => {
    expect(slugifyFieldKey('  Passport No. ')).toBe('passport_no');
    expect(slugifyFieldKey('!!!')).toBe('');
  });

  it('trims, drops blanks and de-duplicates options', () => {
    expect(parseOptionsInput([' A ', '', 'B', 'A'])).toEqual(['A', 'B']);
    expect(parseOptionsInput('x, y ,,x')).toEqual(['x', 'y']);
    expect(parseOptionsInput(undefined)).toEqual([]);
  });

  it('requires options for dropdown and radio fields only', () => {
    expect(() => assertFieldOptions('Blood group', 'dropdown', [])).toThrow(
      BadRequestException,
    );
    expect(() => assertFieldOptions('Shift', 'radio', ['  '])).toThrow(
      BadRequestException,
    );
    expect(() => assertFieldOptions('Shift', 'radio', ['Day'])).not.toThrow();
    expect(() => assertFieldOptions('Notes', 'text', [])).not.toThrow();
  });

  it('reports fields whose type changes under the same key', () => {
    const existing = [
      definition({ fieldKey: 'number', label: 'Number', fieldType: 'text' }),
      definition({ fieldKey: 'issued', label: 'Issued', fieldType: 'date' }),
    ];
    expect(
      findFieldTypeChanges(existing, [
        { fieldKey: 'number', fieldType: 'number' },
        { fieldKey: 'issued', fieldType: 'date' },
        { fieldType: 'checkbox' },
        { fieldKey: 'brand_new', fieldType: 'text' },
      ]),
    ).toEqual(['Number']);
  });
});

describe('validateCustomFieldValues', () => {
  it('ignores inactive definitions and enforces required active ones', () => {
    const defs = [
      definition({ fieldKey: 'number', label: 'Number', required: true }),
      definition({ fieldKey: 'old', label: 'Old', required: true, isActive: false }),
    ];
    expect(validateCustomFieldValues(defs, { number: ' A1 ' })).toEqual({
      number: 'A1',
    });
    expect(() => validateCustomFieldValues(defs, {})).toThrow(BadRequestException);
  });

  it('rejects values outside the configured options', () => {
    const defs = [
      definition({ fieldKey: 'grade', fieldType: 'dropdown', options: ['A', 'B'] }),
    ];
    expect(validateCustomFieldValues(defs, { grade: 'B' })).toEqual({ grade: 'B' });
    expect(() => validateCustomFieldValues(defs, { grade: 'C' })).toThrow(
      BadRequestException,
    );
  });
});
