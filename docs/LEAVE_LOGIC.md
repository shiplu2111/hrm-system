# LEAVE_LOGIC.md

## 1. Leave Types

Company-configurable: Annual, Sick, Personal, Unpaid, Maternity/Paternity, Compassionate, and custom types. Each type has `is_paid` flag.

## 2. Leave Policy Fields

```
entitlement_days      -- e.g. 20 days/year
accrual_type          -- monthly | yearly | on-hire
carry_forward_max     -- max days that roll into next year
expiry_months         -- carried-forward days expire after N months (nullable = never)
encashment_allowed     -- boolean
probation_restriction  -- can/cannot apply during probation
allow_negative_balance -- boolean, with optional max negative cap
half_day_allowed       -- boolean
```

Policies are effective-dated (`effective_from`/`effective_to`) — see RULES.md §4.

## 3. Accrual Logic

**Monthly accrual example:**
```
monthly_accrual = entitlement_days / 12
On each accrual date: leave_balance += monthly_accrual (capped at entitlement_days unless policy allows overflow)
```

**Yearly accrual:** full entitlement credited on financial-year start or hire anniversary (company-configurable).

## 4. Carry-Forward & Expiry

At year-end:
```
carried = min(remaining_balance, carry_forward_max)
new_year_balance = new_entitlement + carried
```
If `expiry_months` is set, the carried portion is tracked separately and zeroed out after that many months if unused (FIFO: carried days are consumed before new-year days).

## 5. Leave Request & Approval

```
Employee submits request
   → Manager approval
   → HR approval (if required by policy)
   → Approved / Rejected
```

Approval chain is configurable per company via the Approval Workflow Engine (see ROLES_PERMISSIONS.md and MODULES.md §35). Leave requests support offline submission with `local_id` (see OFFLINE_SYNC.md) — approval always happens server-side once synced.

## 6. Balance Deduction

- Balance is deducted on **approval**, not on submission (to avoid holding balance hostage for pending/rejected requests).
- Half-day requests deduct 0.5 from the balance if `half_day_allowed`.
- Unpaid leave does not deduct from paid leave balance but does feed into payroll as an unpaid-leave deduction (see PAYROLL_LOGIC.md §4).

## 7. Negative Balance

If `allow_negative_balance` is true, employees may request leave beyond their balance up to a configured negative cap; this must be visibly flagged to the approver at approval time.

## 8. Leave Encashment

If `encashment_allowed`, unused balance (typically at year-end or exit) can be converted to a payroll earning component. This creates an entry in `salary_structures`/payroll inputs for the relevant period — never a silent balance adjustment.

## 9. Interaction with Attendance & Payroll

- Approved leave for a date automatically sets that day's attendance status to `Leave` (or `Half Day`).
- Unpaid leave days are excluded from "days worked" in payroll pro-ration and generate a deduction (see PAYROLL_LOGIC.md §4).

## 10. Public Holidays Interaction

If a public holiday falls within an approved leave range, that day is not deducted from the leave balance (configurable per company, default: not deducted). See holiday calendar in MODULES.md §14.
