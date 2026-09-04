import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AUS_PAYROLL_REGRESSION_FIXTURE,
  BGD_PAYROLL_REGRESSION_FIXTURE,
} from './payroll-regression.fixtures';
import { runPayrollRegression } from './payroll-regression.runner';
import type { PayslipGoldenOutput } from './payroll-regression.types';

const GOLDEN_DIR = path.join(__dirname, 'golden');

function loadGolden(filename: string): PayslipGoldenOutput {
  const raw = fs.readFileSync(path.join(GOLDEN_DIR, filename), 'utf8');
  return JSON.parse(raw) as PayslipGoldenOutput;
}

describe('Payroll regression golden files (TESTING.md §5)', () => {
  it('Australia (AUS): attendance + leave + salary → payslip output matches golden file', async () => {
    const actual = await runPayrollRegression(AUS_PAYROLL_REGRESSION_FIXTURE);
    const expected = loadGolden('aus.payslip.golden.json');

    expect(actual).toEqual(expected);
  });

  it('Bangladesh (BGD): attendance + leave + salary → payslip output matches golden file', async () => {
    const actual = await runPayrollRegression(BGD_PAYROLL_REGRESSION_FIXTURE);
    const expected = loadGolden('bgd.payslip.golden.json');

    expect(actual).toEqual(expected);
  });
});
