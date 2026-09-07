-- Employee recognition / kudos (MODULES.md §29)

CREATE TYPE "employee_kudos_type" AS ENUM ('peer', 'manager');

CREATE TABLE "employee_kudos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "from_employee_id" UUID NOT NULL,
    "to_employee_id" UUID NOT NULL,
    "kudos_type" "employee_kudos_type" NOT NULL,
    "message" TEXT NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_kudos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_kudos_tenant_id_idx" ON "employee_kudos"("tenant_id");
CREATE INDEX "employee_kudos_company_id_created_at_idx" ON "employee_kudos"("company_id", "created_at");
CREATE INDEX "employee_kudos_to_employee_id_idx" ON "employee_kudos"("to_employee_id");
CREATE INDEX "employee_kudos_from_employee_id_idx" ON "employee_kudos"("from_employee_id");

ALTER TABLE "employee_kudos" ADD CONSTRAINT "employee_kudos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_kudos" ADD CONSTRAINT "employee_kudos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_kudos" ADD CONSTRAINT "employee_kudos_from_employee_id_fkey" FOREIGN KEY ("from_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_kudos" ADD CONSTRAINT "employee_kudos_to_employee_id_fkey" FOREIGN KEY ("to_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
