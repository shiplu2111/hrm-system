-- Global → State → Company → Employee Contract rule chain (ARCHITECTURE.md §3)

CREATE TABLE "global_rules" (
    "id" UUID NOT NULL,
    "rule_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "state_province_rules" (
    "id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "state_code" VARCHAR(16) NOT NULL,
    "rule_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "state_province_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "rule_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_contract_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "rule_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_contract_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "global_rules_rule_type_effective_from_idx" ON "global_rules"("rule_type", "effective_from");

CREATE INDEX "state_province_rules_country_id_idx" ON "state_province_rules"("country_id");
CREATE INDEX "state_province_rules_country_id_state_code_rule_type_effect_idx" ON "state_province_rules"("country_id", "state_code", "rule_type", "effective_from");

CREATE INDEX "company_rules_tenant_id_idx" ON "company_rules"("tenant_id");
CREATE INDEX "company_rules_company_id_idx" ON "company_rules"("company_id");
CREATE INDEX "company_rules_tenant_id_company_id_rule_type_effective_from_idx" ON "company_rules"("tenant_id", "company_id", "rule_type", "effective_from");

CREATE INDEX "employee_contract_rules_tenant_id_idx" ON "employee_contract_rules"("tenant_id");
CREATE INDEX "employee_contract_rules_employee_id_idx" ON "employee_contract_rules"("employee_id");
CREATE INDEX "employee_contract_rules_tenant_id_employee_id_rule_type_eff_idx" ON "employee_contract_rules"("tenant_id", "employee_id", "rule_type", "effective_from");

ALTER TABLE "state_province_rules" ADD CONSTRAINT "state_province_rules_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_rules" ADD CONSTRAINT "company_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_rules" ADD CONSTRAINT "company_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_contract_rules" ADD CONSTRAINT "employee_contract_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_contract_rules" ADD CONSTRAINT "employee_contract_rules_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
