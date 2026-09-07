-- Multi-currency payroll (MODULES.md §46, RULES.md §4)

ALTER TABLE "companies" ADD COLUMN "payroll_base_currency" VARCHAR(3);

ALTER TABLE "payroll_runs" ADD COLUMN "pay_currency" VARCHAR(3) NOT NULL DEFAULT 'AUD';
ALTER TABLE "payroll_runs" ADD COLUMN "base_currency" VARCHAR(3) NOT NULL DEFAULT 'AUD';
ALTER TABLE "payroll_runs" ADD COLUMN "exchange_rate" DECIMAL(18,8);
ALTER TABLE "payroll_runs" ADD COLUMN "exchange_rate_id" UUID;
ALTER TABLE "payroll_runs" ADD COLUMN "exchange_rate_date" DATE;
ALTER TABLE "payroll_runs" ADD COLUMN "gross_pay_base" DECIMAL(14,2);
ALTER TABLE "payroll_runs" ADD COLUMN "total_deductions_base" DECIMAL(14,2);
ALTER TABLE "payroll_runs" ADD COLUMN "net_pay_base" DECIMAL(14,2);

CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "base_currency" VARCHAR(3) NOT NULL,
    "quote_currency" VARCHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exchange_rates_tenant_id_base_currency_quote_currency_effective_from_idx"
  ON "exchange_rates"("tenant_id", "base_currency", "quote_currency", "effective_from");

ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_exchange_rate_id_fkey"
  FOREIGN KEY ("exchange_rate_id") REFERENCES "exchange_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
