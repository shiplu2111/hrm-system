# PAYROLL_LOGIC.md — Payroll Calculation Rules

This is the **source of truth** for payroll business logic. Per `RULES.md` §10, any code (human or AI-generated) implementing payroll calculation must match this document exactly — do not invent or assume tax/deduction formulas.

**Jurisdiction: Bangladesh.** Payroll is calculated under the **Bangladesh Labour Act 2006** (as amended, most recently 2026) for labor provisions (overtime, working hours, leave), and **National Board of Revenue (NBR)** rules under the **Finance Ordinance 2025** for individual income tax, applicable for Assessment Year 2025–26 (Income Year 2024–25). Currency: **BDT**. Timezone: `Asia/Dhaka` (per `ENV_SETUP.md`).

⚠️ Tax slabs and statutory rates below are correct as of this document's writing (August 2026) but **change almost every fiscal year via the national Budget/Finance Act** — this is normal and expected, not a documentation error. The tax calculation must be implemented as a versioned, swappable ruleset (§4.1) so future budget changes don't require rewriting payroll logic, only updating the active ruleset's figures. Before Phase 4 implementation, re-verify current figures against the latest NBR notification, since Finance Act changes can take effect between this doc's writing and actual build time.

Remaining 🔶 placeholders below are **company-policy decisions** (not jurisdiction-dependent) that still need sign-off before Phase 4 begins.

---

## 1. Core Concepts

- **Payroll Run:** One execution of payroll for a given month/year, covering all eligible employees. Table: `payroll_runs`.
- **Payslip:** The calculated result for one employee within one payroll run. Table: `payslips` + `payslip_line_items`.
- **Salary Structure:** An employee's current compensation definition, versioned by `effective_from`/`effective_to`. Table: `salary_structures` + `salary_components`.

---

## 2. Salary Structure

Each employee has an active `salary_structures` row (`effective_to IS NULL`) at any given time.

```
Gross Salary = Basic Salary + Σ(Allowances) + Bonus (if applicable this period)
```

- **Basic Salary:** Fixed base amount, stored directly on `salary_structures.basic_salary`.
- **Allowances:** Rows in `salary_components` where `component_type = 'allowance'`. Each is either:
  - A fixed `amount`, OR
  - A `percentage` of Basic Salary (e.g., HRA = 40% of Basic)
  - Never both — validate exactly one is set per component at creation time.
- **Bonus:** Also modeled as a `salary_components` row with `component_type = 'bonus'` — may be one-time (added to a specific payroll run manually) or recurring (attached to the structure).

### 2.1 Salary Revision
- A raise/change creates a **new** `salary_structures` row with a new `effective_from`, and sets `effective_to` on the previous row to the day before.
- Never edit an existing `salary_structures` row's `basic_salary` in place once it has been used in a `payroll_run` — this would corrupt historical payslip accuracy/audit trail.
- Mid-month revisions: the payroll run for that month must pro-rate between the two structures based on days effective under each (see §7).

---

## 3. Attendance-Based Adjustments

Payroll pulls from `attendance_records` and `leave_requests` for the payroll period (calendar month, per `PAYROLL_TIMEZONE` in `ENV_SETUP.md`).

### 3.1 Absence Deduction
```
Per-Day Salary = Gross Salary / Days in Month   (calendar days in that month, e.g., 30 or 31)
Absence Deduction = Per-Day Salary × Unapproved Absent Days
```
- **Calendar days, not working-days-only** — this is the conventional approach under Bangladesh payroll practice and keeps the formula stable regardless of how many weekly holidays fall in a given month.
- Basis is **Gross Salary** (Basic + Allowances), not Basic Salary alone — consistent with how Bangladeshi employers commonly compute daily-rate deductions, since allowances are part of the employee's regular monthly entitlement, not overtime-only compensation. 🔶 Confirm this matches company policy — some organizations compute daily rate on Basic only; if so, swap `Gross Salary` for `Basic Salary` here and in §3.3 consistently.
- "Unapproved Absent Days" = days with `attendance_records.status = 'absent'` and no covering approved `leave_requests` entry, and no approved `attendance_regularization_requests`.
- Days with `status = 'on_leave'` are **not** counted as absent — they are handled by §3.2 instead.

### 3.2 Unpaid Leave Deduction
```
Unpaid Leave Deduction = Per-Day Salary × Unpaid Leave Days Taken
```
- Comes from `leave_requests` where `leave_types.is_paid = false`, or approved leave beyond the employee's available `leave_balances` for a paid leave type.
- **Default behavior:** the Leave module rejects an application at submission time if it would exceed the available balance (`leave_balances.allocated_days − used_days`) — an employee cannot apply for more paid leave than they have. This means payroll should rarely encounter a negative-balance scenario from normal use; if it does occur (e.g., a manual HR override of a leave request bypassing the normal balance check), treat the excess as unpaid leave using this section's formula. 🔶 Confirm this reject-at-source approach matches company policy — the alternative (always allow, auto-convert excess to unpaid at payroll time) is also viable but was not chosen as the default here since it surfaces the cost to the employee earlier and avoids surprise deductions on payday.

### 3.3 Overtime

Per the **Bangladesh Labour Act 2006** (as amended): standard working hours are **8 hours/day, 48 hours/week**; any work beyond this is overtime, compensated at **2× (double) the ordinary hourly rate**. The Act permits overtime extending the day to 10 hours, with a weekly ceiling of 60 hours total (i.e., up to 12 overtime hours/week).

```
Ordinary Hourly Rate = (Basic Salary + Dearness Allowance, if any) / (Days in Month × Standard Shift Hours Per Day)
Overtime Hours = Σ(hours worked beyond shift.end_time, per attendance_records, where check_out_at is valid and within geofence)
Overtime Amount = Overtime Hours × Ordinary Hourly Rate × 2
```

- **"Ordinary rate of wages" for overtime = Basic Salary + Dearness Allowance only** (if the company's salary structure includes a Dearness Allowance component) — this excludes other allowances (transport, medical) and excludes discretionary bonuses, per standard Bangladesh payroll practice. If the company's `salary_components` don't include a separate Dearness Allowance line, this reduces to Basic Salary alone.
- **Weekly overtime cap: 12 hours/week** (60 total − 48 standard), per the Labour Act — the payroll calculation should flag (not silently truncate) any week where recorded overtime hours exceed this cap, since it likely indicates an attendance data issue (forgotten checkout) rather than legitimate overtime, and should route to HR for review rather than being paid out as-is.
- Overtime eligibility by role (e.g., whether certain salaried/managerial roles are excluded from hourly overtime under company policy) remains a company-policy decision 🔶 — the Labour Act's overtime provisions primarily target workers under its "worker" definition; confirm with company policy/legal counsel which roles are configured as `overtime_eligible = true` on `shifts` or at the employee level.

---

## 4. Deductions

### 4.1 Tax (Bangladesh — NBR, Finance Ordinance 2025, AY 2025–26)

**Step 1 — Annual Gross Salary Income**
```
Annual Gross Salary = (Basic Salary + Σ Allowances) × 12 + Festival Bonuses + any other cash benefits for the year
```

**Step 2 — Salary Income Exemption**
```
Salary Exemption = MIN(Annual Gross Salary / 3, BDT 450,000)
```
Employment income is exempt up to whichever is lower: one-third of total salary, or BDT 450,000/year.

**Step 3 — Taxable Income**
```
Taxable Income = Annual Gross Salary − Salary Exemption − Tax-Free Threshold
```

**Tax-Free Threshold (annual, by category — must be captured per employee, e.g., on the employee profile or tax-declaration record):**

| Category | Tax-Free Threshold |
|---|---|
| General (male) taxpayer | BDT 350,000 |
| Female taxpayer / Senior citizen (65+) | BDT 400,000 |
| Person with disability | BDT 475,000 |
| Gazetted war-wounded freedom fighter | BDT 500,000 |

**Step 4 — Apply Progressive Slabs (on Taxable Income, after the tax-free threshold is already excluded above — i.e., slabs apply starting from the first taka above the threshold):**

| Slab (on income above threshold) | Rate |
|---|---|
| First BDT 100,000 | 5% |
| Next BDT 400,000 | 10% |
| Next BDT 500,000 | 15% |
| Next BDT 500,000 | 20% |
| Next BDT 2,000,000 | 25% |
| Remaining balance | 30% |

**Step 5 — Minimum Tax**
Even if the slab-calculated tax is lower, a **minimum tax** applies once total income exceeds the tax-free threshold — for AY 2025–26 this varies by location (higher in city corporation areas); confirm the exact current minimum-tax figures against the live NBR notification at implementation time, since this specific sub-rule is more prone to mid-year administrative updates than the slab table itself. 🔶

**Step 6 — Monthly TDS (Tax Deducted at Source)**
```
Monthly Tax Deduction = Annual Tax Payable / 12
```
Deducted evenly across the 12 payroll runs of the tax year, adjusted in later months if mid-year salary changes alter the annual projection (recalculate the annual estimate whenever `salary_structures` changes, per §2.1, and adjust the remaining months' TDS accordingly rather than under/over-collecting silently).

**Implementation requirement:** implement as a **versioned, pluggable `TaxCalculatorService`** — e.g., `BangladeshTaxCalculator_AY2025_26` — so that next fiscal year's Budget/Finance Act changes (tax-free threshold, slab boundaries, rates all commonly change annually) are added as a new versioned strategy rather than mutating this one in place, preserving the ability to recompute historical payslips correctly under the rules that applied when they were issued (`PAYROLL_LOGIC.md` §5's snapshot principle).

- Tax calculation must be unit-tested against official NBR worked examples / the figures in this section, covering each tax-free-threshold category and at least one case in each slab tier, per `PAYROLL_LOGIC.md` §13.

### 4.2 Provident Fund (PF)

Per the **Bangladesh Labour Act 2006, Section 264(9)**: a permanent employee who has completed **one year of service** contributes between **7% and 8% of monthly Basic Salary** to the Provident Fund; the employer matches this contribution equally. PF is only mandatory for organizations that have established a fund (mandatory if ≥75% of workers formally request it) — 🔶 confirm whether the company operates a PF scheme and, if so, the exact contribution rate within the 7–8% legal band (company-configurable, stored per `salary_components` or a dedicated PF policy setting, not hardcoded).

```
Employee PF Contribution = Basic Salary × PF_Rate   (PF_Rate configurable, 7%–8%, default 7% unless company sets otherwise)
Employer PF Contribution = Basic Salary × PF_Rate    (matched equally)
```

- Employee PF contribution is a `salary_components` row with `component_type = 'deduction'`, and reduces net salary (§5).
- Employer PF contribution is tracked for payroll cost reporting (`PRD.md` §3.11) but does **not** reduce the employee's net salary — model this as a separate non-payslip-visible cost record, not a `payslip_line_items` deduction row (to avoid confusing employees on their payslip).
- **Eligibility gate:** the payroll calculation must check `employees.joining_date` — PF deduction only applies once the employee has completed one full year of service; before that, `Employee PF Contribution = 0`.
- PF fund income (interest/gains within the fund) is taxed at 15% at the fund level, not the individual's personal income tax — this is a fund-administration concern, not a per-payslip calculation, and does not affect §4.1's individual tax calculation.

### 4.3 Insurance
```
Insurance Deduction = 🔶 (fixed amount or % — per company policy, configurable in salary_components)
```
- Group insurance is only a *statutory* requirement under the Bangladesh Labour Act for establishments with 200+ workers — below that threshold it's entirely a company-policy benefit, not a legal one. Either way, the amount/structure remains a company decision, configured the same way regardless of whether it's statutory or voluntary — flag the 200+ worker threshold to HR/legal for confirmation of applicability, but the calculation mechanism itself doesn't change.

### 4.4 Loan / Salary Advance Recovery
```
Loan Recovery Deduction = configured installment amount for this period, from an employee's active loan/advance record
```
- 🔶 Loan/advance tracking is not yet in `DATABASE_SCHEMA.md` — needs a `loan_advances` table (principal, installment amount, remaining balance, start period) before this can be implemented. Flag as a schema gap.

---

## 5. Net Salary Formula

```
Gross Salary = Basic Salary + Σ(Allowances) + Bonus (if this period)

Total Deductions = Tax
                  + Employee PF Contribution
                  + Insurance Deduction
                  + Loan Recovery Deduction
                  + Absence Deduction
                  + Unpaid Leave Deduction

Net Salary = Gross Salary + Overtime Amount − Total Deductions
```

- `payslips.gross_salary`, `payslips.total_allowances`, `payslips.total_deductions`, `payslips.tax_amount`, `payslips.overtime_amount`, `payslips.net_salary` are all stored as calculated snapshots — **never recompute on read**, always store the result at calculation time so historical payslips remain accurate even if `salary_structures` or tax rules change later.
- Every individual earning/deduction line must also be written to `payslip_line_items` for full transparency (§ per `DATABASE_SCHEMA.md` §5) — the totals on `payslips` must always equal the sum of their corresponding `payslip_line_items`.

---

## 6. Rounding Rules

- All monetary calculations use `DECIMAL` arithmetic throughout (never floating point) per `RULES.md` §3.
- Round to 2 decimal places at the **final line-item level**, not at intermediate steps, to avoid compounding rounding errors.
- Rounding method: **round-half-up to the nearest whole taka** — standard convention in Bangladesh payroll practice (BDT has no commonly-used sub-unit in payroll contexts, unlike currencies with cents). Store as `DECIMAL(12,2)` per `DATABASE_SCHEMA.md` for calculation precision, but display/round to whole BDT on payslips.

---

## 7. Pro-Ration Rules

Applies when an employee:
- Joins or exits mid-month
- Has a salary revision mid-month (§2.1)
- Has unpaid leave spanning a partial month (already covered by §3.2's per-day formula)

```
Prorated Amount (for a given structure segment) =
    (Component Amount / Days in Month) × Days Applicable Under This Segment
```

- "Days Applicable" for a joiner: from `joining_date` to end of month.
- "Days Applicable" for an exiting employee: from start of month to `requested_last_working_day` (from `exit_requests`) — final month payroll should typically run as part of the Final Settlement process (§9), not the regular monthly run, to avoid double-processing.

---

## 8. Payroll Run Lifecycle

```
draft → pending_approval → approved → disbursed
                  │
                  └──► (any stage) → cancelled
```

1. **`draft`** — HR triggers payroll run for a period; system calculates all payslips for eligible active employees. Editable/re-runnable at this stage.
2. **`pending_approval`** — HR submits the draft for approval. No further edits without reverting to draft.
3. **`approved`** — A **different** user than `prepared_by` approves (maker-checker, `SECURITY.md` §5, `DATABASE_SCHEMA.md` §5 — enforced in `PayrollService`, not just at the DB level). Attempting self-approval throws `MAKER_CHECKER_VIOLATION` (`ERROR_HANDLING.md`).
4. **`disbursed`** — Bank export/disbursement action triggered; `disbursed_at` set. Payslips become visible to employees (self-service) only from this point onward — **do not show draft/pending payslip figures to employees**, to avoid confusion from numbers that may still change.
5. **`cancelled`** — Can occur from `draft` or `pending_approval` only, never from `approved`/`disbursed` (those require a correcting adjustment run instead, not a cancellation, to preserve audit history).

### 8.1 Eligible Employees
- Employees with `employment_status = 'active'` at any point during the payroll period.
- Employees who exited mid-period are **excluded from the regular run** and instead handled entirely via Final Settlement (§9, `run_type = 'settlement'`) — this is now the fixed default given the settlement run type resolves the schema question; there's no remaining need for a "partial-month payslip in the regular run" alternative, since settlement already covers the prorated final-month pay (§7) alongside encashment and closing deductions in one place.

---

## 9. Final Settlement (Offboarding Integration)

Triggered from an `exit_requests` record (`DATABASE_SCHEMA.md` §8) rather than the regular monthly `payroll_runs` cycle.

```
Final Settlement = Prorated Salary for Days Worked in Exit Month (§7)
                  + Unused Earned Leave Encashment (see below)
                  − Standard Deductions (Tax, PF, Loan recovery remaining balance)
                  − Any asset/property deductions 🔶 (if company policy deducts unreturned asset costs)
```

**Earned Leave Encashment:** Under the Bangladesh Labour Act, unused earned/annual leave is carried over (up to a statutory cap — commonly up to ~40 days for most establishments, higher in some sectors) rather than expiring, and unused balance must be settled/encashed on termination — an employer cannot simply forfeit accrued statutory leave by policy.
```
Leave Encashment Amount = Unused Earned Leave Days × Per-Day Salary (§3.1 formula)
```
🔶 Confirm the company's exact carryover cap and whether it differs from the common ~40-day figure for the applicable sector, and confirm whether Casual/Sick leave types (as opposed to Earned leave specifically) are also encashable on exit — statutory encashment obligation applies specifically to earned/annual leave, not necessarily all leave types.

**Schema handling (resolved):** the final settlement is modeled as its own `payroll_runs` row with `run_type = 'settlement'` (per `DATABASE_SCHEMA.md` §5, added to resolve this section's prior open item) — covering exactly one employee, going through the same `draft → pending_approval → approved → disbursed` lifecycle (§8) and the same maker-checker enforcement, just outside the regular monthly cycle's uniqueness constraint. Its single `payslips` row is linked via `exit_requests.final_settlement_payslip_id` as before.

---

## 10. Payslip Generation

- PDF generated only after `payroll_runs.status = 'approved'` (draft numbers should never be exported as a shareable PDF).
- Triggered as a background job (Bull queue, `ARCHITECTURE.md` §3.4) per employee, not synchronously in the approval request — approval should respond immediately, PDFs generate async.
- On generation failure for one employee, other employees' payslips must not be blocked — job runs per-payslip, retried independently (`ERROR_HANDLING.md` §8).

---

## 11. Bank Disbursement

- Export format: 🔶 — in Bangladesh, bulk salary disbursement is typically routed through **BEFTN (Bangladesh Electronic Funds Transfer Network)**, which most local banks support via a standardized batch file format for bulk credit transfers. The exact column layout still needs confirmation from the specific bank(s) the company uses, since some banks require their own template on top of the BEFTN standard — needs bank/payment-provider confirmation; see `ARCHITECTURE.md` §12 open decision on direct integration vs export file.
- Disbursement file/action only becomes available once `payroll_runs.status = 'approved'`.
- After disbursement is confirmed (manually marked, or via integration callback if direct integration is used later), status moves to `disbursed` and payslips become employee-visible (§8, step 4).

---

## 12. Error Codes Reference (this module)

| Code | HTTP | Meaning |
|---|---|---|
| `MAKER_CHECKER_VIOLATION` | 422 | Same user attempting to both prepare and approve a payroll run |
| `PAYROLL_ALREADY_APPROVED` | 409 | Attempting to edit/cancel a run that's already `approved` or `disbursed` |
| `PAYROLL_RUN_DUPLICATE_PERIOD` | 409 | A `payroll_runs` row already exists for this `period_month`/`period_year` |
| `SALARY_STRUCTURE_MISSING` | 422 | Employee has no active `salary_structures` row — cannot calculate payslip |
| `INVALID_SALARY_COMPONENT` | 400 | A `salary_components` row has both `amount` and `percentage` set, or neither |

(Registered in `common/constants/error-codes.ts` per `ERROR_HANDLING.md` §4.)

---

## 13. Testing Requirements (mandatory, per `RULES.md` §9 — no exceptions)

- Unit tests for: gross salary calculation, each deduction type independently, net salary formula, pro-ration (join/exit/mid-month revision), overtime calculation, rounding behavior.
- Test the maker-checker enforcement explicitly (same user cannot approve their own draft).
- Test that historical payslips remain unchanged when `salary_structures` or tax rules are later modified (snapshot behavior, §5).
- Test cases for tax calculation must be validated against official tax authority worked examples once 🔶 jurisdiction is finalized — do not approve tax logic based on assumptions.

---

## 14. Open Decisions

**Resolved (jurisdiction confirmed: Bangladesh):**
- [x] ~~Applicable country/jurisdiction~~ — Bangladesh; Labour Act 2006 (labor provisions) + NBR Finance Ordinance 2025 (tax), see document header
- [x] ~~Per-day salary basis~~ — calendar days, on Gross Salary (§3.1)
- [x] ~~Overtime rate~~ — 2× ordinary hourly rate, 12 hrs/week cap, per Labour Act (§3.3)
- [x] ~~PF contribution range~~ — 7–8% of Basic Salary, matched by employer, per Labour Act §264(9) (§4.2) — exact rate within that band still needs company sign-off
- [x] ~~Tax calculation~~ — NBR slabs for AY 2025–26 documented in full (§4.1) — needs re-verification against live NBR notification at implementation time due to annual Budget changes
- [x] ~~`loan_advances` table~~ — added to `DATABASE_SCHEMA.md` §5
- [x] ~~Final Settlement schema handling~~ — resolved via `payroll_runs.run_type` (§9)
- [x] ~~Rounding convention~~ — round-half-up to nearest whole BDT (§6)
- [x] ~~Earned leave encashment~~ — statutory obligation confirmed under Labour Act, formula added (§9)

**Still open (company-policy decisions, not jurisdiction-dependent — confirm before Phase 4):**
- [ ] Exact PF contribution rate within the legal 7–8% band, and whether the company operates a PF scheme at all (§4.2)
- [ ] Whether Gross Salary or Basic Salary alone is the basis for per-day/absence deduction calculations, if it differs from this doc's Gross Salary default (§3.1)
- [ ] Which roles are configured `overtime_eligible` (e.g., managerial/exempt roles excluded) (§3.3)
- [ ] Insurance deduction structure, and confirmation of whether the 200+ worker statutory group-insurance threshold applies to this company (§4.3)
- [ ] Company's earned leave carryover cap if it differs from the common ~40-day figure, and whether Casual/Sick leave are also encashable on exit (§9)
- [ ] Any asset/property deduction policy on offboarding (§9)
- [ ] Bank/BEFTN export column format — needs confirmation from the company's specific bank(s) (§11)
