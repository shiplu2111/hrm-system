import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  PayComponentFormula,
  PayComponentPercentageFormula,
  PayComponentPercentageBase,
  SalaryStructureAmountConfig,
} from '@hrm/shared-types';
import { isPayFormulaRule } from '@hrm/shared-types';
import {
  PayFormulaValidationError,
  parsePayFormulaRule,
} from './formula/formula-validator';

const MONEY_SCALE = 2;

export function parseMoney(value: string, field = 'amount'): Decimal {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${field} must be a decimal with up to 2 fractional digits`,
    });
  }
  return new Decimal(trimmed);
}

export function formatMoney(value: Decimal): string {
  return value.toFixed(MONEY_SCALE);
}

export function parsePercentage(value: number, field = 'percentage'): Decimal {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${field} must be between 0 and 100`,
    });
  }
  return new Decimal(value);
}

export function parseDateOnly(value: string, field = 'date'): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${field} must be an ISO date (YYYY-MM-DD)`,
    });
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `Invalid ${field}`,
    });
  }
  return date;
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isEffectiveOn(
  effectiveFrom: Date,
  effectiveTo: Date | null,
  asOf: Date,
): boolean {
  const day = asOf.getTime();
  const from = effectiveFrom.getTime();
  const to = effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  return day >= from && day <= to;
}

export function rangesOverlap(
  aFrom: Date,
  aTo: Date | null,
  bFrom: Date,
  bTo: Date | null,
): boolean {
  const aEnd = aTo ?? new Date('9999-12-31T00:00:00.000Z');
  const bEnd = bTo ?? new Date('9999-12-31T00:00:00.000Z');
  return aFrom.getTime() <= bEnd.getTime() && bFrom.getTime() <= aEnd.getTime();
}

export function parseFormulaConfig(
  raw: unknown,
): PayComponentPercentageFormula | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'formula must be an object',
    });
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version === 1) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Use parsePayComponentFormula for structured formula rules',
    });
  }
  const config: PayComponentPercentageFormula = {};
  if (obj.base !== undefined) {
    if (obj.base !== 'basic' && obj.base !== 'gross') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'formula.base must be "basic" or "gross"',
      });
    }
    config.base = obj.base;
  }
  if (obj.percentage !== undefined) {
    config.percentage = parsePercentage(Number(obj.percentage)).toNumber();
  }
  return config;
}

export function parsePayComponentFormula(raw: unknown): PayComponentFormula | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'formula must be an object',
    });
  }

  const obj = raw as Record<string, unknown>;
  if (obj.version === 1) {
    try {
      return parsePayFormulaRule(raw);
    } catch (error) {
      if (error instanceof PayFormulaValidationError) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: error.message,
        });
      }
      throw error;
    }
  }

  return parseFormulaConfig(raw);
}

export function parseAmountConfig(raw: unknown): SalaryStructureAmountConfig {
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'amountOrFormula must be an object',
    });
  }
  const obj = raw as Record<string, unknown>;
  const config: SalaryStructureAmountConfig = {};
  if (obj.amount !== undefined) {
    if (typeof obj.amount !== 'string') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'amountOrFormula.amount must be a string',
      });
    }
    parseMoney(obj.amount);
    config.amount = obj.amount.trim();
  }
  if (obj.percentage !== undefined) {
    config.percentage = parsePercentage(Number(obj.percentage)).toNumber();
  }
  if (obj.hourly_rate !== undefined) {
    if (typeof obj.hourly_rate !== 'string' && typeof obj.hourly_rate !== 'number') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'amountOrFormula.hourly_rate must be a number or decimal string',
      });
    }
    config.hourly_rate =
      typeof obj.hourly_rate === 'string'
        ? parseMoney(obj.hourly_rate, 'hourly_rate').toString()
        : new Decimal(obj.hourly_rate).toString();
  }
  if (obj.ot_multiplier !== undefined) {
    if (typeof obj.ot_multiplier !== 'number' || !Number.isFinite(obj.ot_multiplier)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'amountOrFormula.ot_multiplier must be a finite number',
      });
    }
    config.ot_multiplier = obj.ot_multiplier;
  }
  return config;
}

export function resolvePercentageBase(
  formula: PayComponentPercentageFormula | null,
): PayComponentPercentageBase {
  return formula?.base === 'gross' ? 'gross' : 'basic';
}

export function parseFormulaRuleFromComponent(
  raw: unknown,
): import('@hrm/shared-types').PayFormulaRule {
  const parsed = parsePayComponentFormula(raw);
  if (!parsed || !isPayFormulaRule(parsed)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Pay component is missing a valid structured formula rule',
    });
  }
  return parsed;
}

export function resolvePercentageRate(
  amountConfig: SalaryStructureAmountConfig,
  formula: PayComponentPercentageFormula | null,
): Decimal {
  const rate =
    amountConfig.percentage ?? formula?.percentage ?? undefined;
  if (rate === undefined) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Percentage rate is required on salary structure or pay component',
    });
  }
  return parsePercentage(rate);
}
