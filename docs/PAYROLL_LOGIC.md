# PAYROLL_LOGIC.md

## 1. Inputs to a Payroll Run

```
Attendance + Leave + Timesheet + Overtime + Salary Structure + Bonuses + Deductions
```

All inputs are pulled for the employee's assigned `payroll_period` (start_date → end_date).

## 2. Calculation Chain (Rule Resolver)

```
Payroll Engine
   → Rule Resolver
       → Country Rules (tax brackets, statutory minimums)
       → State/Province Rules (if applicable)
       → Company Policy (pay components, formulas)
       → Employee Contract (overrides, e.g. custom rate)
   → Effective-dated rule version matched to payroll_period.end_date
   → Calculation
```

This chain must be respected for every calculation — see RULES.md §2.

## 3. Earnings

Basic Salary, Hourly Rate, Overtime, Allowance, Bonus, Commission, Incentive, Transport, Housing, Meal, and admin-defined custom earnings. Each earning is either a fixed amount, a percentage, or a formula (see §5).

A fixed amount has a **pay basis** on the employee's salary structure row (`salary_structures.pay_basis`):

| Basis | Amount paid for the period |
|---|---|
| `monthly` (default) | The amount as entered |
| `daily` | amount × days attended in the period (present, late, early leave, WFH, business trip = 1; half day = 0.5) |
| `hourly` | amount × net worked hours in the period |

- Days and hours are rounded to 2 decimals before multiplying, so the payslip's `rate × units` reproduces the line amount.
- Attendance flagged as not payroll-eligible (e.g. geofence violations) and unpaid leave count as neither days nor hours.
- Paid leave is not included in daily/hourly pay; it needs its own component.
- Fixed earnings of any basis add up to `basic_salary`. The sum of hourly-basis fixed earnings is passed to formulas as `employee.hourly_rate`, so overtime uses the contracted rate.
- Percentage and formula components are always `monthly`.

## 4. Deductions

Tax, Loan installment, Advance recovery, Unpaid Leave, Late Deduction, Insurance, Pension/Superannuation, and admin-defined custom deductions.

## 5. Formula Engine

Admins define pay components without code changes:

```
IF employee.worked_hours > shift.standard_hours
THEN overtime_pay = (worked_hours - standard_hours) * hourly_rate * ot_multiplier

IF attendance.status == "unpaid_leave"
THEN deduction += (basic_salary / working_days_in_period) * unpaid_days
```

Formulas are stored as structured JSON (not raw code) and evaluated by a sandboxed rule interpreter — never `eval()` of user input.

Before a component's rule is changed, admins see a company-wide simulation: every employee with an assignment effective on the preview date is recalculated with and without the proposed rule. Nothing is written (§8). Totals are summed in the company base currency, and employees whose pay can't be calculated are listed separately.

## 6. Gross → Net Calculation

```
Gross Pay = Σ(earnings)
Total Deductions = Σ(deductions, including tax)
Net Pay = Gross Pay - Total Deductions
```

## 7. Payroll Status Flow

```
Draft → Calculated → Under Review → Approved → Finalized → Paid → Cancelled
```

- **Finalized** payroll is locked — no direct edits. Corrections after finalization go through a new **Adjustment** record referencing the original run.
- Only `Draft`/`Calculated`/`Under Review` states allow recalculation.

## 8. Payroll Simulation

A "what-if" calculation mode: runs the full calculation chain for a hypothetical salary/attendance change and returns the projected net pay **without** creating or modifying any payroll_run row. Used for scenarios like "what would net pay be if basic salary were $5,000."

## 9. Overtime Rules

Configurable multipliers per company/country: e.g. weekday OT = 1.5×, weekend OT = 2×, holiday OT = 2.5×. Maximum OT caps are enforced at calculation time and any breach is flagged, not silently capped, unless the company policy explicitly says to auto-cap.

## 10. Tax Calculation

See country_rules / tax_brackets in DATABASE_SCHEMA.md. Tax is calculated using the bracket set effective on the payroll period's date — never "today's" bracket set, so historical payroll remains correct after law changes.

## 11. Retroactive Adjustments

A retroactive salary change (e.g. a raise back-dated 2 months) does not rewrite historical `payroll_runs`. It generates a new adjustment payroll entry for the difference, applied in the current or next payroll cycle, fully audit-logged.

## 12. Audit Requirements

Every payroll-affecting create/update (salary structure change, manual adjustment, approval, finalization) MUST write to `audit_logs` (see AUDIT_LOG.md) with old value, new value, and the acting user. This is not optional — see RULES.md §3.
