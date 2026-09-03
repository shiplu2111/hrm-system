-- LEAVE_LOGIC.md policy fields, balance accrual tracking, request metadata

CREATE TYPE "yearly_accrual_anchor" AS ENUM ('financial_year', 'hire_anniversary');

ALTER TABLE "leave_policies"
  ADD COLUMN "encashment_allowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "probation_restricted" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allow_negative_balance" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "negative_balance_cap" DECIMAL(8,2),
  ADD COLUMN "half_day_allowed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deduct_public_holidays" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "approval_steps" JSONB NOT NULL DEFAULT '[{"roleName":"Manager"},{"roleName":"HR Admin"}]',
  ADD COLUMN "yearly_accrual_anchor" "yearly_accrual_anchor" NOT NULL DEFAULT 'financial_year';

ALTER TABLE "leave_balances"
  ADD COLUMN "carried_forward_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN "carried_forward_expires_at" DATE,
  ADD COLUMN "last_accrual_at" DATE;

ALTER TABLE "leave_requests"
  ADD COLUMN "half_day" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "total_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "deducted_at" TIMESTAMP(3);
